import { Violation } from '../../types';
import { LintContext } from '../collectStyles';
import { LintRule } from '../engine';
import { isLikelyIcon, hasImageFill, INTERACTIVE_NAME_RE } from '../helpers';

// ============================================================
// P0 — Structure rules (#6–#10)
// ============================================================

// #6 — Detached / broken instance
const detachedInstance: LintRule = {
  id: 'detachedInstance',
  name: 'Detached instance',
  description: 'Component instances with missing main component',
  category: 'structure',
  severity: 'critical',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'INSTANCE') continue;
      const inst = node as InstanceNode;
      if (!inst.mainComponent) {
        violations.push({
          ruleId: 'detachedInstance',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'critical',
          message: 'Instance has no main component (detached or deleted)',
          fixable: false,
          category: 'structure',
        });
      }
    }
    return violations;
  },
};

// #7 — Hidden layers (warning, not critical — common in normal workflows)
const hiddenLayers: LintRule = {
  id: 'hiddenLayers',
  name: 'Hidden layers',
  description: 'Hidden layers clutter the file',
  category: 'structure',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.visible === false) {
        violations.push({
          ruleId: 'hiddenLayers',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: 'Layer is hidden',
          expected: 'Fix will remove this layer',
          fixable: true,
          category: 'structure',
        });
      }
    }
    return violations;
  },
};

// #8 — Group instead of Frame (warning — groups are valid, frames preferred)
const groupInsteadOfFrame: LintRule = {
  id: 'groupInsteadOfFrame',
  name: 'Group instead of Frame',
  description: 'Use Frames for layout instead of Groups',
  category: 'structure',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type === 'GROUP') {
        violations.push({
          ruleId: 'groupInsteadOfFrame',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: 'Use Frame instead of Group for better layout control',
          fixable: true,
          category: 'structure',
        });
      }
    }
    return violations;
  },
};

// #9 — Fractional coordinates
const fractionalCoords: LintRule = {
  id: 'fractionalCoords',
  name: 'Fractional coordinates',
  description: 'Coordinates should be whole numbers for pixel-perfect rendering',
  category: 'structure',
  severity: 'critical',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (!('x' in node) || !('y' in node)) continue;
      const x = (node as any).x as number;
      const y = (node as any).y as number;
      if (!Number.isInteger(x) || !Number.isInteger(y)) {
        violations.push({
          ruleId: 'fractionalCoords',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'critical',
          message: 'Non-integer coordinates cause blurry rendering',
          current: `x: ${x}, y: ${y}`,
          expected: `x: ${Math.round(x)}, y: ${Math.round(y)}`,
          fixable: true,
          category: 'structure',
        });
      }
    }
    return violations;
  },
};

// #10 — Fractional sizes
const fractionalSize: LintRule = {
  id: 'fractionalSize',
  name: 'Fractional size',
  description: 'Width and height should be whole numbers',
  category: 'structure',
  severity: 'critical',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      const w = node.width;
      const h = node.height;
      if (!Number.isInteger(w) || !Number.isInteger(h)) {
        violations.push({
          ruleId: 'fractionalSize',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'critical',
          message: 'Non-integer dimensions cause blurry rendering',
          current: `${w} x ${h}`,
          expected: `${Math.round(w)} x ${Math.round(h)}`,
          fixable: true,
          category: 'structure',
        });
      }
    }
    return violations;
  },
};

// #29 — Missing export settings on icons/images
const missingExportSettings: LintRule = {
  id: 'missingExportSettings',
  name: 'Missing export settings',
  description: 'Icons and images should have export settings configured',
  category: 'structure',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (!('exportSettings' in node)) continue;
      const exportable = node as SceneNode & { exportSettings: readonly ExportSettings[] };
      if (exportable.exportSettings.length > 0) continue;

      const icon = isLikelyIcon(node);
      const image = hasImageFill(node);
      if (!icon && !image) continue;

      violations.push({
        ruleId: 'missingExportSettings',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'warning',
        message: icon ? 'Icon without export settings' : 'Image without export settings',
        expected: icon ? 'SVG @1x' : 'PNG @2x',
        fixable: true,
        suggestedFixData: icon ? 'svg' : 'png',
        category: 'structure',
      });
    }
    return violations;
  },
};

// #36 — Missing state variants for interactive components
const missingStateVariants: LintRule = {
  id: 'missingStateVariants',
  name: 'Missing state variants',
  description: 'Interactive component sets should have hover/disabled variants',
  category: 'structure',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'COMPONENT_SET') continue;
      if (!INTERACTIVE_NAME_RE.test(node.name)) continue;

      const cs = node as ComponentSetNode;
      const variantNames = cs.children.map((c) => c.name.toLowerCase());
      const allVariantText = variantNames.join(' ');

      const hasHover = /\bhover\b/i.test(allVariantText);
      const hasDisabled = /\bdisabled\b/i.test(allVariantText);

      if (!hasHover || !hasDisabled) {
        const missing: string[] = [];
        if (!hasHover) missing.push('hover');
        if (!hasDisabled) missing.push('disabled');

        violations.push({
          ruleId: 'missingStateVariants',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: `Interactive component missing ${missing.join(', ')} variant${missing.length > 1 ? 's' : ''}`,
          expected: `Add ${missing.join(' and ')} variant${missing.length > 1 ? 's' : ''}`,
          fixable: false,
          category: 'structure',
        });
      }
    }
    return violations;
  },
};

export const structureRules: LintRule[] = [
  detachedInstance,
  hiddenLayers,
  groupInsteadOfFrame,
  fractionalCoords,
  fractionalSize,
  missingExportSettings,
  missingStateVariants,
];
