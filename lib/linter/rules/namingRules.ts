import { Violation } from '../../types';
import { LintContext } from '../collectStyles';
import { LintRule } from '../engine';

// ============================================================
// P1 — Naming rules (#11, #12, #20)
// ============================================================

const DEFAULT_FRAME_RE = /^Frame\s+\d+$/;
const DEFAULT_LAYER_RE =
  /^(Rectangle|Ellipse|Line|Vector|Star|Polygon|Text|Image|Group|Slice|Boolean|Union|Subtract|Intersect|Exclude)\s*\d*$/;

// ---- Naming suggestion helpers ----

function suggestFrameName(node: SceneNode): string {
  if (!('children' in node)) return 'Container';
  const children = (node as FrameNode).children;

  if (children.length === 0) return 'EmptyFrame';

  const frameNode = node as FrameNode;
  if ('layoutMode' in frameNode) {
    if (frameNode.layoutMode === 'HORIZONTAL') return 'Row';
    if (frameNode.layoutMode === 'VERTICAL') return 'Column';
  }

  const hasImage = children.some(
    (c) =>
      'fills' in c &&
      Array.isArray((c as any).fills) &&
      (c as any).fills.some((f: Paint) => f.type === 'IMAGE')
  );
  const hasText = children.some((c) => c.type === 'TEXT');
  if (hasImage && hasText) return 'Card';

  const allText = children.every((c) => c.type === 'TEXT');
  if (allText) return 'TextBlock';

  const allInstances = children.every((c) => c.type === 'INSTANCE');
  if (allInstances && children.length > 2) return 'ComponentList';

  if (children.length === 1) return 'Wrapper';

  return 'Container';
}

function suggestLayerName(node: SceneNode): string {
  if (node.type === 'TEXT') {
    const text = (node as TextNode).characters;
    if (text && text.length > 0) {
      const clean = toPascalCase(text.slice(0, 30));
      return clean || 'Label';
    }
    return 'Label';
  }

  if (node.type === 'RECTANGLE') {
    const rect = node as RectangleNode;
    // Check for IMAGE fill
    const fills = rect.fills;
    if (fills !== figma.mixed && Array.isArray(fills) && fills.some((f: Paint) => f.type === 'IMAGE')) {
      return 'Image';
    }
    // Divider: very wide and thin
    if (rect.width > rect.height * 5) return 'Divider';
    // Rounded
    if (typeof rect.cornerRadius === 'number' && rect.cornerRadius > 0) return 'RoundedBackground';
    return 'Background';
  }

  if (node.type === 'ELLIPSE') {
    const e = node as EllipseNode;
    return Math.abs(e.width - e.height) < 2 ? 'Circle' : 'Oval';
  }

  if (node.type === 'LINE') return 'Separator';
  if (node.type === 'VECTOR') return 'Icon';

  return 'Shape';
}

function toPascalCase(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '') // remove non-letter, non-number (keep unicode letters)
    .trim()
    .split(/\s+/)
    .slice(0, 3) // max 3 words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function suggestComponentName(name: string): string {
  // "Button Primary" → "Button/Primary"
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const category = parts[0];
    const variant = parts
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
    return `${category}/${variant}`;
  }
  // Single word → "Name/Default"
  return `${name}/Default`;
}

// #11 — Default frame name
const defaultFrameName: LintRule = {
  id: 'defaultFrameName',
  name: 'Default frame name',
  description: 'Frames should have meaningful names, not "Frame 237"',
  category: 'naming',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'FRAME' && node.type !== 'SECTION') continue;
      if (DEFAULT_FRAME_RE.test(node.name)) {
        const suggested = suggestFrameName(node);
        violations.push({
          ruleId: 'defaultFrameName',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: `"${node.name}" — rename to describe its content`,
          current: node.name,
          expected: suggested,
          fixable: true,
          suggestedFixData: suggested,
          category: 'naming',
        });
      }
    }
    return violations;
  },
};

// #12 — Default layer name
const defaultLayerName: LintRule = {
  id: 'defaultLayerName',
  name: 'Default layer name',
  description: 'Layers should have meaningful names',
  category: 'naming',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if ((node.type as string) === 'PAGE' || (node.type as string) === 'DOCUMENT') continue;
      if (DEFAULT_LAYER_RE.test(node.name)) {
        const suggested = suggestLayerName(node);
        violations.push({
          ruleId: 'defaultLayerName',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: `"${node.name}" — rename to describe its purpose`,
          current: node.name,
          expected: suggested,
          fixable: true,
          suggestedFixData: suggested,
          category: 'naming',
        });
      }
    }
    return violations;
  },
};

// #20 — Component naming without slash notation
const componentNaming: LintRule = {
  id: 'componentNaming',
  name: 'Component naming',
  description: 'Components should use slash notation (e.g., Button/Primary)',
  category: 'naming',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') continue;
      // Skip variant components — their names use Property=Value syntax, not slash notation
      if (node.name.includes('=')) continue;
      if (!node.name.includes('/')) {
        const suggested = suggestComponentName(node.name);
        violations.push({
          ruleId: 'componentNaming',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: `Component "${node.name}" should use slash notation`,
          current: node.name,
          expected: suggested,
          fixable: true,
          suggestedFixData: suggested,
          category: 'naming',
        });
      }
    }
    return violations;
  },
};

export const namingRules: LintRule[] = [defaultFrameName, defaultLayerName, componentNaming];
