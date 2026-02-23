import { Violation } from '../../types';
import { LintContext } from '../collectStyles';
import { LintRule } from '../engine';
import { isLikelyIcon } from '../helpers';

// ============================================================
// P1 — Layout rules (#13–#18)
// ============================================================

// #13 — Duplicate objects at same position/size
const duplicateObjects: LintRule = {
  id: 'duplicateObjects',
  name: 'Duplicate objects',
  description: 'Two objects at the same position and size',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    const seen = new Map<string, SceneNode>();

    for (const node of nodes) {
      if (!node.parent || !('x' in node)) continue;
      // Only compare siblings
      const parentId = node.parent.id;
      // Include node.type to prevent false positives between different element types
      const key = `${parentId}|${node.type}|${Math.round((node as any).x)}|${Math.round((node as any).y)}|${Math.round(node.width)}|${Math.round(node.height)}`;

      if (seen.has(key)) {
        const other = seen.get(key)!;
        violations.push({
          ruleId: 'duplicateObjects',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: `Overlaps with "${other.name}" at same position and size`,
          fixable: false,
          category: 'layout',
        });
      } else {
        seen.set(key, node);
      }
    }
    return violations;
  },
};

// #14 — Spacing not multiple of base
const spacingNotMultiple: LintRule = {
  id: 'spacingNotMultiple',
  name: 'Spacing not multiple of base',
  description: 'Auto-layout gaps and padding should be multiples of spacing base',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes, context) {
    const base = context.settings.spacingBase;
    if (base <= 0) return [];
    const violations: Violation[] = [];

    for (const node of nodes) {
      if (
        node.type !== 'FRAME' &&
        node.type !== 'COMPONENT' &&
        node.type !== 'COMPONENT_SET' &&
        node.type !== 'INSTANCE'
      )
        continue;
      const frame = node as FrameNode;
      if (frame.layoutMode === 'NONE') continue;

      const values: { label: string; val: number }[] = [];

      if (typeof frame.itemSpacing === 'number') {
        values.push({ label: 'gap', val: frame.itemSpacing });
      }
      if (typeof frame.paddingTop === 'number') {
        values.push({ label: 'paddingTop', val: frame.paddingTop });
        values.push({ label: 'paddingBottom', val: frame.paddingBottom });
        values.push({ label: 'paddingLeft', val: frame.paddingLeft });
        values.push({ label: 'paddingRight', val: frame.paddingRight });
      }

      for (const { label, val } of values) {
        if (val > 0 && val % base !== 0) {
          violations.push({
            ruleId: 'spacingNotMultiple',
            nodeId: node.id,
            nodeName: node.name,
            severity: 'warning',
            message: `${label}: ${val}px is not a multiple of ${base}px`,
            current: `${val}px`,
            expected: `${Math.round(val / base) * base}px`,
            fixable: false,
            category: 'layout',
          });
          break; // One per node
        }
      }
    }
    return violations;
  },
};

// #15 — Fixed size text
const fixedSizeText: LintRule = {
  id: 'fixedSizeText',
  name: 'Fixed size text',
  description: 'Text should use Hug or Fill instead of Fixed size',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'TEXT') continue;
      const text = node as TextNode;
      if (text.textAutoResize === 'NONE') {
        violations.push({
          ruleId: 'fixedSizeText',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: 'Text has fixed size — use Hug or Fill for responsive layout',
          current: 'Fixed',
          expected: 'Hug contents',
          fixable: true,
          category: 'layout',
        });
      }
    }
    return violations;
  },
};

// #16 — Auto line height
const autoLineHeight: LintRule = {
  id: 'autoLineHeight',
  name: 'Auto line height',
  description: 'Text should have explicit line-height for consistent rendering',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'TEXT') continue;
      const text = node as TextNode;
      const lh = text.lineHeight;
      if (lh === figma.mixed) continue;
      if ((lh as any).unit === 'AUTO') {
        violations.push({
          ruleId: 'autoLineHeight',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: 'Line-height is Auto — set an explicit value',
          current: 'Auto',
          fixable: true,
          category: 'layout',
        });
      }
    }
    return violations;
  },
};

// #17 — Text resize truncate
const textResizeFixed: LintRule = {
  id: 'textResizeFixed',
  name: 'Text truncation',
  description: 'Text with TRUNCATE resize can hide content',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'TEXT') continue;
      const text = node as TextNode;
      if (text.textAutoResize === 'TRUNCATE') {
        violations.push({
          ruleId: 'textResizeFixed',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: 'Text may be truncated — content could be hidden',
          current: 'Truncate',
          expected: 'Height auto-resize',
          fixable: true,
          category: 'layout',
        });
      }
    }
    return violations;
  },
};

// #18 — Absolute positioning inside AutoLayout
const absoluteInAutoLayout: LintRule = {
  id: 'absoluteInAutoLayout',
  name: 'Absolute in AutoLayout',
  description: 'Absolute-positioned children break auto-layout flow',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (!('layoutPositioning' in node)) continue;
      if ((node as any).layoutPositioning !== 'ABSOLUTE') continue;
      const parent = node.parent;
      if (!parent || !('layoutMode' in parent)) continue;
      if ((parent as FrameNode).layoutMode === 'NONE') continue;

      violations.push({
        ruleId: 'absoluteInAutoLayout',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'warning',
        message: 'Absolute positioning inside auto-layout parent',
        fixable: false,
        category: 'layout',
      });
    }
    return violations;
  },
};

// #30 — Frame with children but no Auto Layout
const missingAutoLayout: LintRule = {
  id: 'missingAutoLayout',
  name: 'Missing auto layout',
  description: 'Frames with multiple children should use Auto Layout',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'FRAME') continue;
      const frame = node as FrameNode;
      if (frame.layoutMode !== 'NONE') continue;
      if (frame.children.length < 2) continue;

      // Exclude if all children are absolute (common for decorative overlays)
      const allAbsolute = frame.children.every(
        (c) => 'layoutPositioning' in c && (c as any).layoutPositioning === 'ABSOLUTE'
      );
      if (allAbsolute) continue;

      violations.push({
        ruleId: 'missingAutoLayout',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'warning',
        message: `Frame with ${frame.children.length} children has no Auto Layout`,
        fixable: false,
        category: 'layout',
      });
    }
    return violations;
  },
};

// #35 — Non-standard icon size
const nonStandardIconSize: LintRule = {
  id: 'nonStandardIconSize',
  name: 'Non-standard icon size',
  description: 'Icons should use standard sizes from settings',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes, context) {
    const iconSizes = context.settings.iconSizes;
    if (!iconSizes || iconSizes.length === 0) return [];

    const violations: Violation[] = [];
    for (const node of nodes) {
      if (!isLikelyIcon(node)) continue;
      const w = Math.round(node.width);
      const h = Math.round(node.height);
      if (iconSizes.indexOf(w) >= 0 && iconSizes.indexOf(h) >= 0) continue;

      // Find closest standard size
      const closest = iconSizes.reduce((prev, curr) =>
        Math.abs(curr - w) < Math.abs(prev - w) ? curr : prev
      );

      violations.push({
        ruleId: 'nonStandardIconSize',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'warning',
        message: `Icon size ${w}x${h} is not standard`,
        current: `${w}x${h}`,
        expected: `${closest}x${closest}`,
        fixable: true,
        suggestedFixData: String(closest),
        category: 'layout',
      });
    }
    return violations;
  },
};

// #37 — Text overflows its container
const textOverflow: LintRule = {
  id: 'textOverflow',
  name: 'Text overflow',
  description: 'Text content extends beyond its bounding box',
  category: 'layout',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'TEXT') continue;
      const text = node as TextNode;
      if (text.textAutoResize !== 'NONE') continue;

      const render = text.absoluteRenderBounds;
      const bounds = text.absoluteBoundingBox;
      if (!render || !bounds) continue;

      const tolerance = 1;
      if (
        render.width > bounds.width + tolerance ||
        render.height > bounds.height + tolerance
      ) {
        violations.push({
          ruleId: 'textOverflow',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: 'Text content overflows its bounding box',
          current: `Render: ${Math.round(render.width)}x${Math.round(render.height)}`,
          expected: `Box: ${Math.round(bounds.width)}x${Math.round(bounds.height)}`,
          fixable: true,
          category: 'layout',
        });
      }
    }
    return violations;
  },
};

// #39 — Inconsistent spacing among sibling auto-layout frames
const inconsistentSpacing: LintRule = {
  id: 'inconsistentSpacing',
  name: 'Inconsistent spacing',
  description: 'Sibling auto-layout frames should use consistent gaps',
  category: 'layout',
  severity: 'info',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    // Group auto-layout frames by parent
    const byParent = new Map<string, { node: SceneNode; spacing: number }[]>();
    for (const node of nodes) {
      if (
        node.type !== 'FRAME' &&
        node.type !== 'COMPONENT' &&
        node.type !== 'INSTANCE'
      ) continue;
      const frame = node as FrameNode;
      if (frame.layoutMode === 'NONE') continue;
      if (!node.parent) continue;

      const parentId = node.parent.id;
      const arr = byParent.get(parentId);
      const entry = { node, spacing: frame.itemSpacing };
      if (arr) arr.push(entry);
      else byParent.set(parentId, [entry]);
    }

    byParent.forEach((siblings) => {
      if (siblings.length < 2) return;

      // Find majority spacing
      const counts = new Map<number, number>();
      for (const s of siblings) counts.set(s.spacing, (counts.get(s.spacing) || 0) + 1);
      let majoritySpacing = 0;
      let majorityCount = 0;
      counts.forEach((c, sp) => {
        if (c > majorityCount) {
          majoritySpacing = sp;
          majorityCount = c;
        }
      });
      if (majorityCount === siblings.length) return;

      for (const s of siblings) {
        if (s.spacing === majoritySpacing) continue;
        violations.push({
          ruleId: 'inconsistentSpacing',
          nodeId: s.node.id,
          nodeName: s.node.name,
          severity: 'info',
          message: `Gap ${s.spacing}px differs from sibling majority ${majoritySpacing}px`,
          current: `${s.spacing}px`,
          expected: `${majoritySpacing}px`,
          fixable: false,
          category: 'layout',
        });
      }
    });

    return violations;
  },
};

export const layoutRules: LintRule[] = [
  duplicateObjects,
  spacingNotMultiple,
  fixedSizeText,
  autoLineHeight,
  textResizeFixed,
  absoluteInAutoLayout,
  missingAutoLayout,
  nonStandardIconSize,
  textOverflow,
  inconsistentSpacing,
];
