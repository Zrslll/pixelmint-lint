import { Violation, LintResult, RuleInfo, Category, Severity } from '../types';
import { LintContext, flattenNodes } from './collectStyles';
import { styleRules } from './rules/styleRules';
import { structureRules } from './rules/structureRules';
import { namingRules } from './rules/namingRules';
import { layoutRules } from './rules/layoutRules';
import { a11yRules } from './rules/a11yRules';
import { cleanupRules } from './rules/cleanupRules';

// ============================================================
// Lint Rule interface (plugin-side only, uses Figma types)
// ============================================================

export interface LintRule {
  id: string;
  name: string;
  description: string;
  category: Category;
  severity: Severity;
  defaultEnabled: boolean;
  run(nodes: SceneNode[], context: LintContext): Violation[] | Promise<Violation[]>;
}

// All rules combined
export const ALL_RULES: LintRule[] = [
  ...styleRules,
  ...structureRules,
  ...namingRules,
  ...layoutRules,
  ...a11yRules,
  ...cleanupRules,
];

export function getRuleInfos(): RuleInfo[] {
  return ALL_RULES.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    severity: r.severity,
    defaultEnabled: r.defaultEnabled,
  }));
}

// #11 — Score calculation with caps per severity to prevent info-spam
export function calculateScore(violations: Violation[]): number {
  let criticals = 0;
  let warnings = 0;
  let infos = 0;
  for (const v of violations) {
    switch (v.severity) {
      case 'critical':
        criticals++;
        break;
      case 'warning':
        warnings++;
        break;
      case 'info':
        infos++;
        break;
    }
  }
  const warningPenalty =
    Math.min(warnings * 2, 30) + (warnings > 15 ? Math.log2(warnings - 14) * 2 : 0);
  const infoPenalty = Math.min(infos * 0.5, 10) + (infos > 20 ? Math.log2(infos - 19) * 0.5 : 0);
  const deductions = criticals * 5 + warningPenalty + infoPenalty;
  return Math.max(0, Math.round(100 - deductions));
}

export interface AbortSignal {
  aborted: boolean;
}

type ProgressCallback = (current: number, total: number, ruleName: string) => void;

// Yield control to event loop so postMessage is delivered and Cancel works
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// #4 — AbortController pattern instead of global mutable state
export async function runLint(
  selection: readonly SceneNode[],
  context: LintContext,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<LintResult> {
  const startTime = Date.now();
  const nodes = flattenNodes(selection);
  const violations: Violation[] = [];

  const enabledRules = ALL_RULES.filter((r) => {
    if (!r.defaultEnabled) {
      return Boolean(context.settings.enabledRules?.includes(r.id));
    }
    return !context.settings.disabledRules.includes(r.id);
  });
  const total = enabledRules.length;

  for (let i = 0; i < enabledRules.length; i++) {
    if (signal?.aborted) break;

    const rule = enabledRules[i];
    if (onProgress) {
      onProgress(i + 1, total, rule.name);
    }

    // Yield between rules so progress messages reach UI and Cancel is responsive
    await yieldToUI();

    if (signal?.aborted) break;

    try {
      const ruleViolations = await rule.run(nodes, context);
      violations.push(...ruleViolations);
    } catch (e) {
      // #27 — Report failed rules as info-level violations
      violations.push({
        ruleId: rule.id,
        nodeId: '',
        nodeName: '',
        severity: 'info',
        message: `Rule "${rule.name}" failed: ${e instanceof Error ? e.message : 'unknown error'}`,
        fixable: false,
        category: rule.category,
      });
    }
  }

  // Post-process: protect Main Components and Instances from unsafe fixes.
  // Rule-specific component fixes are allowed explicitly.
  const protectedFixRules = new Set(['noComponentDescription']);
  const nodeTypeMap = new Map<string, string>();
  for (const n of nodes) nodeTypeMap.set(n.id, n.type);

  for (const v of violations) {
    if (!v.nodeId) continue;
    const nodeType = nodeTypeMap.get(v.nodeId);
    if (nodeType === 'COMPONENT') {
      if (!protectedFixRules.has(v.ruleId)) {
        v.fixable = false;
        v.suggestedFixData = undefined;
        v.suggestedCreateData = undefined;
      }
      v.isMainComponent = true;
    } else if (nodeType === 'INSTANCE') {
      v.fixable = false;
      v.suggestedFixData = undefined;
      v.suggestedCreateData = undefined;
      v.isInstance = true;
    }
  }

  return {
    violations,
    score: calculateScore(violations),
    duration: Date.now() - startTime,
    nodeCount: nodes.length,
  };
}
