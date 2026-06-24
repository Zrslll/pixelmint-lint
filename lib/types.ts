// ============================================================
// Shared types between Plugin Sandbox and UI iframe
// Do NOT import Figma-specific types here (SceneNode, etc.)
// ============================================================

export type Severity = 'critical' | 'warning' | 'info';

export type Category = 'style' | 'structure' | 'naming' | 'layout' | 'a11y' | 'cleanup';

export interface Violation {
  ruleId: string;
  nodeId: string;
  nodeName: string;
  severity: Severity;
  message: string;
  current?: string;
  expected?: string;
  fixable: boolean;
  suggestedFixData?: string;
  suggestedCreateData?: string;
  category: Category;
  isMainComponent?: boolean;
  isInstance?: boolean;
}

export type FixAction =
  | 'default'
  | 'applyExistingStyle'
  | 'createStyle'
  | 'removeNode'
  | 'unwrapFrame'
  | 'convertGroup'
  | 'changeVisibility';

export interface FixFailure {
  violation: Violation;
  action: FixAction;
  reason: string;
}

export interface FixResult {
  fixedViolations: Violation[];
  failedFixes: FixFailure[];
  pendingConfirmationFixes: FixFailure[];
  fixedCount: number;
  failedCount: number;
  pendingConfirmationCount: number;
}

export interface RuleInfo {
  id: string;
  name: string;
  description: string;
  category: Category;
  severity: Severity;
  defaultEnabled: boolean;
}

export interface LintResult {
  violations: Violation[];
  score: number;
  duration: number;
  nodeCount: number;
}

export interface LintSettings {
  disabledRules: string[];
  enabledRules?: string[];
  spacingBase: number;
  nestingDepthLimit: number;
  iconSizes: number[];
  minFontSize: number;
  touchTargetMin: number;
}

// Messages: UI -> Plugin Sandbox
export type PluginMessage =
  | { type: 'LINT_RUN' }
  | { type: 'LINT_CANCEL' }
  | {
      type: 'LINT_FIX';
      fixType: 'all' | 'critical' | 'warnings';
      violations: Violation[];
    }
  | { type: 'LINT_FIX_SINGLE'; violation: Violation; fixAction?: FixAction; confirmed?: boolean }
  | { type: 'LINT_NAVIGATE'; nodeId: string }
  | { type: 'SETTINGS_LOAD' }
  | { type: 'SETTINGS_SAVE'; settings: LintSettings };

// Messages: Plugin Sandbox -> UI
export type UIMessage =
  | {
      type: 'LINT_PROGRESS';
      current: number;
      total: number;
      ruleName: string;
    }
  | { type: 'LINT_RESULT'; result: LintResult; ruleInfos: RuleInfo[] }
  | { type: 'LINT_ERROR'; error: string }
  | ({ type: 'LINT_FIX_DONE' } & FixResult)
  | { type: 'SETTINGS_DATA'; settings: LintSettings; ruleInfos: RuleInfo[] }
  | { type: 'SELECTION_EMPTY' };

export const DEFAULT_SETTINGS: LintSettings = {
  disabledRules: [],
  enabledRules: [],
  spacingBase: 4,
  nestingDepthLimit: 5,
  iconSizes: [16, 20, 24, 32],
  minFontSize: 12,
  touchTargetMin: 44,
};
