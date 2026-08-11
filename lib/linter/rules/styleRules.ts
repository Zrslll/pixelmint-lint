import { Violation } from '../../types';
import { LintContext, rgbToHex } from '../collectStyles';
import { LintRule } from '../engine';
import { buildLABCache, findClosestPaintStyle, LABCache, MAX_SIMILAR_COLOR_DELTA_E } from '../colorMatch';
import { matchPaintStyle, matchTextStyle, matchEffectStyle } from '../styleMatch';

// ============================================================
// P0 — Style rules (#1–#5)
// ============================================================

function hasFills(
  node: SceneNode
): node is SceneNode & {
  fills: readonly Paint[] | typeof figma.mixed;
  fillStyleId: string | typeof figma.mixed;
} {
  return 'fills' in node && 'fillStyleId' in node;
}

function hasStrokes(
  node: SceneNode
): node is SceneNode & { strokes: readonly Paint[]; strokeStyleId: string | typeof figma.mixed } {
  return 'strokes' in node && 'strokeStyleId' in node;
}

function hasEffects(
  node: SceneNode
): node is SceneNode & { effects: readonly Effect[]; effectStyleId: string | typeof figma.mixed } {
  return 'effects' in node && 'effectStyleId' in node;
}

function getFirstSolidHex(paints: readonly Paint[]): string | null {
  for (const p of paints) {
    if (p.type === 'SOLID' && p.visible !== false) {
      return rgbToHex((p as SolidPaint).color.r, (p as SolidPaint).color.g, (p as SolidPaint).color.b);
    }
  }
  return null;
}

// Shared LAB cache — built once per lint run
let cachedLabData: LABCache | null = null;
let cachedPaintStylesRef: unknown = null;

function getLabCache(context: LintContext): LABCache {
  if (cachedLabData && cachedPaintStylesRef === context.paintStyles) {
    return cachedLabData;
  }
  cachedLabData = buildLABCache(context.paintStyles);
  cachedPaintStylesRef = context.paintStyles;
  return cachedLabData;
}

// #1 — Fill without style
const missingFillStyle: LintRule = {
  id: 'missingFillStyle',
  name: 'Missing fill style',
  description: 'Fills should use a local paint style',
  category: 'style',
  severity: 'critical',
  defaultEnabled: true,
  run(nodes, context) {
    const violations: Violation[] = [];
    const labCache = getLabCache(context);

    for (const node of nodes) {
      if (!hasFills(node)) continue;
      if (node.type === 'TEXT') continue; // Text fills handled separately
      const fills = node.fills;
      if (fills === figma.mixed) continue;
      if (!Array.isArray(fills) || fills.length === 0) continue;
      const visibleFills = (fills as Paint[]).filter((f) => f.visible !== false);
      if (visibleFills.length === 0) continue;

      const styleId = node.fillStyleId;
      if (styleId === figma.mixed || (typeof styleId === 'string' && styleId)) continue;

      // Check if bound to variable
      try {
        const bindings = (node as any).boundVariables?.fills;
        if (bindings && bindings.length > 0) continue;
      } catch {}

      const match = matchPaintStyle(visibleFills, context.paintStyles, labCache);
      const hex = getFirstSolidHex(visibleFills);
      violations.push({
        ruleId: 'missingFillStyle',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'critical',
        message: 'Fill without a paint style',
        expected: match ? match.styleName : undefined,
        fixable: !!(match || hex),
        suggestedFixData: match?.styleId,
        suggestedCreateData: match ? undefined : hex || node.name,
        category: 'style',
      });
    }
    return violations;
  },
};

// #2 — Text without text style
const missingTextStyle: LintRule = {
  id: 'missingTextStyle',
  name: 'Missing text style',
  description: 'Text nodes should use a local text style',
  category: 'style',
  severity: 'critical',
  defaultEnabled: true,
  run(nodes, context) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'TEXT') continue;
      const textNode = node as TextNode;
      const styleId = textNode.textStyleId;

      if (styleId === figma.mixed) {
        violations.push({
          ruleId: 'missingTextStyle',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'critical',
          message: 'Text has mixed styles — some segments are unstyled',
          fixable: false,
          category: 'style',
        });
      } else if (!styleId) {
        // Try to match text style
        let match: { styleId: string; styleName: string; score: number } | null = null;
        let createName: string | undefined;
        if (textNode.fontName !== figma.mixed && typeof textNode.fontSize === 'number') {
          const safeLH: LineHeight = textNode.lineHeight === figma.mixed
            ? { unit: 'AUTO' }
            : textNode.lineHeight;
          const safeLS: LetterSpacing = textNode.letterSpacing === figma.mixed
            ? { unit: 'PIXELS', value: 0 }
            : textNode.letterSpacing;
          match = matchTextStyle(
            textNode.fontName,
            textNode.fontSize,
            safeLH,
            safeLS,
            context.textStyles
          );
          createName = `${textNode.fontName.family}/${textNode.fontSize}`;
        }

        violations.push({
          ruleId: 'missingTextStyle',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'critical',
          message: 'Text without a text style',
          expected: match ? match.styleName : undefined,
          fixable: !!(match || createName),
          suggestedFixData: match?.styleId,
          suggestedCreateData: createName,
          category: 'style',
        });
      }
    }
    return violations;
  },
};

// #3 — Stroke without style
const missingStrokeStyle: LintRule = {
  id: 'missingStrokeStyle',
  name: 'Missing stroke style',
  description: 'Strokes should use a local paint style',
  category: 'style',
  severity: 'critical',
  defaultEnabled: true,
  run(nodes, context) {
    const violations: Violation[] = [];
    const labCache = getLabCache(context);

    for (const node of nodes) {
      if (!hasStrokes(node)) continue;
      if (node.strokes.length === 0) continue;
      const visibleStrokes = node.strokes.filter((s) => s.visible !== false);
      if (visibleStrokes.length === 0) continue;

      const styleId = node.strokeStyleId;
      if (styleId === figma.mixed || (typeof styleId === 'string' && styleId)) continue;

      const match = matchPaintStyle(visibleStrokes, context.paintStyles, labCache);
      const hex = getFirstSolidHex(visibleStrokes);
      violations.push({
        ruleId: 'missingStrokeStyle',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'critical',
        message: 'Stroke without a paint style',
        expected: match ? match.styleName : undefined,
        fixable: !!(match || hex),
        suggestedFixData: match?.styleId,
        suggestedCreateData: match ? undefined : hex || node.name,
        category: 'style',
      });
    }
    return violations;
  },
};

// #4 — Effect without style
const missingEffectStyle: LintRule = {
  id: 'missingEffectStyle',
  name: 'Missing effect style',
  description: 'Effects should use a local effect style',
  category: 'style',
  severity: 'critical',
  defaultEnabled: true,
  run(nodes, context) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (!hasEffects(node)) continue;
      if (node.effects.length === 0) continue;
      const visibleEffects = node.effects.filter((e) => e.visible !== false);
      if (visibleEffects.length === 0) continue;

      const styleId = node.effectStyleId;
      if (typeof styleId === 'string' && styleId) continue;

      const match = matchEffectStyle(node.effects, context.effectStyles);
      const effectType = visibleEffects[0]?.type || 'Effect';
      violations.push({
        ruleId: 'missingEffectStyle',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'critical',
        message: 'Effect without an effect style',
        expected: match ? match.styleName : undefined,
        fixable: true,
        suggestedFixData: match?.styleId,
        suggestedCreateData: effectType.replace(/_/g, ' ').toLowerCase(),
        category: 'style',
      });
    }
    return violations;
  },
};

// #5 — Hard-coded color not in palette
const colorNotInPalette: LintRule = {
  id: 'colorNotInPalette',
  name: 'Color not in palette',
  description: 'Colors should match local paint styles',
  category: 'style',
  severity: 'critical',
  defaultEnabled: true,
  run(nodes, context) {
    if (context.paletteColors.size === 0) return [];
    const violations: Violation[] = [];
    const labCache = getLabCache(context);

    for (const node of nodes) {
      if (!hasFills(node)) continue;
      if (node.type === 'TEXT') continue; // Text fills managed via textStyle
      const fills = node.fills;
      if (fills === figma.mixed) continue;
      if (!Array.isArray(fills)) continue;

      // Skip nodes without fill style — already covered by missingFillStyle
      const styleId = node.fillStyleId;
      if (!styleId || styleId === '' || styleId === figma.mixed) continue;

      for (const fill of fills as Paint[]) {
        if (fill.type !== 'SOLID' || fill.visible === false) continue;
        const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        if (!context.paletteColors.has(hex)) {
          const closest = findClosestPaintStyle(fill.color.r, fill.color.g, fill.color.b, labCache);
          const match =
            closest && closest.distance <= MAX_SIMILAR_COLOR_DELTA_E ? closest : null;
          violations.push({
            ruleId: 'colorNotInPalette',
            nodeId: node.id,
            nodeName: node.name,
            severity: 'critical',
            message: `Color ${hex} is not in the style palette`,
            current: hex,
            expected: match ? `${match.styleName} (${match.hex})` : undefined,
            fixable: true,
            suggestedFixData: match?.styleId,
            suggestedCreateData: match ? undefined : hex,
            category: 'style',
          });
          break; // One violation per node
        }
      }
    }
    return violations;
  },
};

// #31 — Mixed text styles in one text node
const mixedTextStyles: LintRule = {
  id: 'mixedTextStyles',
  name: 'Mixed text styles',
  description: 'Text node has multiple font names or sizes — split into separate text layers',
  category: 'style',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'TEXT') continue;
      const text = node as TextNode;
      // Skip if already reported by missingTextStyle (mixed textStyleId)
      if (text.textStyleId === figma.mixed) continue;

      if (text.fontName === figma.mixed || text.fontSize === figma.mixed) {
        violations.push({
          ruleId: 'mixedTextStyles',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: 'Text has mixed fonts or sizes — consider splitting',
          fixable: false,
          category: 'style',
        });
      }
    }
    return violations;
  },
};

// #34 — Duplicate styles with same values
const duplicateStyles: LintRule = {
  id: 'duplicateStyles',
  name: 'Duplicate styles',
  description: 'Two or more styles with identical values — consolidate',
  category: 'style',
  severity: 'info',
  defaultEnabled: true,
  run(_nodes, context) {
    const violations: Violation[] = [];

    // Check paint styles for duplicate RGB values
    const paintByKey = new Map<string, string[]>();
    for (const ps of context.paintStyles) {
      const key = ps.paints
        .filter((p) => p.type === 'SOLID' && p.visible !== false)
        .map((p) => {
          const c = (p as SolidPaint).color;
          return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
        })
        .sort()
        .join('|');
      if (!key) continue;
      const existing = paintByKey.get(key);
      if (existing) {
        existing.push(ps.name);
      } else {
        paintByKey.set(key, [ps.name]);
      }
    }
    paintByKey.forEach((names) => {
      if (names.length < 2) return;
      violations.push({
        ruleId: 'duplicateStyles',
        nodeId: '',
        nodeName: '',
        severity: 'info',
        message: `Duplicate paint styles: ${names.join(', ')}`,
        fixable: false,
        category: 'style',
      });
    });

    // Check text styles for duplicate family+style+size
    const textByKey = new Map<string, string[]>();
    for (const ts of context.textStyles) {
      const key = `${ts.fontName.family}|${ts.fontName.style}|${ts.fontSize}`;
      const existing = textByKey.get(key);
      if (existing) {
        existing.push(ts.name);
      } else {
        textByKey.set(key, [ts.name]);
      }
    }
    textByKey.forEach((names) => {
      if (names.length < 2) return;
      violations.push({
        ruleId: 'duplicateStyles',
        nodeId: '',
        nodeName: '',
        severity: 'info',
        message: `Duplicate text styles: ${names.join(', ')}`,
        fixable: false,
        category: 'style',
      });
    });

    return violations;
  },
};

// #35 — Inconsistent border radius among siblings
const inconsistentBorderRadius: LintRule = {
  id: 'inconsistentBorderRadius',
  name: 'Inconsistent border radius',
  description: 'Siblings should use consistent corner radius values',
  category: 'style',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    // Group siblings by parent
    const byParent = new Map<string, SceneNode[]>();
    for (const node of nodes) {
      if (!node.parent || !('cornerRadius' in node)) continue;
      const parentId = node.parent.id;
      const arr = byParent.get(parentId);
      if (arr) arr.push(node);
      else byParent.set(parentId, [node]);
    }

    byParent.forEach((siblings) => {
      if (siblings.length < 2) return;

      // Collect radii, skip mixed
      const radiusValues: number[] = [];
      const nodeRadii = new Map<string, number>();
      for (const s of siblings) {
        const cr = (s as any).cornerRadius;
        if (cr === figma.mixed || typeof cr !== 'number') continue;
        radiusValues.push(cr);
        nodeRadii.set(s.id, cr);
      }
      if (radiusValues.length < 2) return;

      // Find majority value
      const counts = new Map<number, number>();
      for (const r of radiusValues) counts.set(r, (counts.get(r) || 0) + 1);
      let majorityRadius = 0;
      let majorityCount = 0;
      counts.forEach((c, r) => {
        if (c > majorityCount) {
          majorityRadius = r;
          majorityCount = c;
        }
      });

      // Flag outliers
      if (majorityCount === radiusValues.length) return; // all same
      for (const s of siblings) {
        const r = nodeRadii.get(s.id);
        if (r === undefined || r === majorityRadius) continue;
        violations.push({
          ruleId: 'inconsistentBorderRadius',
          nodeId: s.id,
          nodeName: s.name,
          severity: 'warning',
          message: `Border radius ${r}px differs from sibling majority ${majorityRadius}px`,
          current: `${r}px`,
          expected: `${majorityRadius}px`,
          fixable: false,
          category: 'style',
        });
      }
    });

    return violations;
  },
};

// #36 — Missing variable binding for spacing/padding
const missingVariableBinding: LintRule = {
  id: 'missingVariableBinding',
  name: 'Missing variable binding',
  description: 'Spacing and padding should use design variables when available',
  category: 'style',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes, context) {
    // Only activate if file has FLOAT variables
    const hasFloatVars = context.variables.some((v) => v.resolvedType === 'FLOAT');
    if (!hasFloatVars) return [];

    const violations: Violation[] = [];
    const SPACING_PROPS = ['itemSpacing', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'] as const;

    for (const node of nodes) {
      if (
        node.type !== 'FRAME' &&
        node.type !== 'COMPONENT' &&
        node.type !== 'COMPONENT_SET' &&
        node.type !== 'INSTANCE'
      ) continue;
      const frame = node as FrameNode;
      if (frame.layoutMode === 'NONE') continue;

      let found = false;
      for (const prop of SPACING_PROPS) {
        if (found) break;
        const val = (frame as any)[prop];
        if (typeof val !== 'number' || val === 0) continue;

        try {
          const bindings = (frame as any).boundVariables;
          if (bindings && bindings[prop]) continue;
        } catch {}

        violations.push({
          ruleId: 'missingVariableBinding',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: `${prop}: ${val}px is a raw value — bind to a variable`,
          current: `${val}px (raw)`,
          expected: 'Variable binding',
          fixable: false,
          category: 'style',
        });
        found = true; // One per node
      }
    }

    return violations;
  },
};

export const styleRules: LintRule[] = [
  missingFillStyle,
  missingTextStyle,
  missingStrokeStyle,
  missingEffectStyle,
  colorNotInPalette,
  mixedTextStyles,
  duplicateStyles,
  inconsistentBorderRadius,
  missingVariableBinding,
];
