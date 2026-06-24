import { Violation } from '../../types';
import { LintContext } from '../collectStyles';
import { LintRule } from '../engine';
import { IMAGE_NAME_RE } from '../helpers';

// ============================================================
// P2 — Cleanup rules (#22–#28)
// ============================================================

// #22 — Zero opacity
const zeroOpacity: LintRule = {
  id: 'zeroOpacity',
  name: 'Zero opacity',
  description: 'Layers with 0% opacity are invisible and should be removed',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (!('opacity' in node)) continue;
      if ((node as any).opacity === 0) {
        violations.push({
          ruleId: 'zeroOpacity',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'info',
          message: 'Layer has 0% opacity — invisible',
          fixable: true,
          category: 'cleanup',
        });
      }
    }
    return violations;
  },
};

// #23 — Locked layers
const lockedLayers: LintRule = {
  id: 'lockedLayers',
  name: 'Locked layers',
  description: 'Locked layers may be forgotten locks',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.locked) {
        violations.push({
          ruleId: 'lockedLayers',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'info',
          message: 'Layer is locked',
          fixable: true,
          category: 'cleanup',
        });
      }
    }
    return violations;
  },
};

// #24 — Empty containers
const emptyContainers: LintRule = {
  id: 'emptyContainers',
  name: 'Empty containers',
  description: 'Frames and groups with no children should be removed',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'FRAME' && node.type !== 'GROUP') continue;
      const container = node as FrameNode | GroupNode;
      if (container.children.length === 0) {
        violations.push({
          ruleId: 'emptyContainers',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'info',
          message: 'Empty container with no children',
          fixable: true,
          category: 'cleanup',
        });
      }
    }
    return violations;
  },
};

// #25 — Deep nesting
const deepNesting: LintRule = {
  id: 'deepNesting',
  name: 'Deep nesting',
  description: 'Excessive nesting makes designs hard to maintain',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: false,
  run(nodes, context) {
    const limit = context.settings.nestingDepthLimit;
    const violations: Violation[] = [];

    for (const node of nodes) {
      let depth = 0;
      let current: BaseNode | null = node.parent;
      while (current && current.type !== 'PAGE') {
        depth++;
        current = current.parent;
      }
      if (depth > limit) {
        violations.push({
          ruleId: 'deepNesting',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'info',
          message: `Nesting depth ${depth} exceeds limit of ${limit}`,
          current: `${depth} levels`,
          expected: `<= ${limit} levels`,
          fixable: false,
          category: 'cleanup',
        });
      }
    }
    return violations;
  },
};

// #26 — Child overflow
const childOverflow: LintRule = {
  id: 'childOverflow',
  name: 'Child overflow',
  description: 'Children extending beyond parent bounds',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      const parent = node.parent;
      if (!parent || !('width' in parent) || !('x' in node)) continue;
      if ((parent.type as string) === 'PAGE' || (parent.type as string) === 'DOCUMENT') continue;

      const parentNode = parent as FrameNode;
      // Skip if parent clips content
      if ('clipsContent' in parentNode && parentNode.clipsContent) continue;
      // Skip absolute-positioned children
      if ('layoutPositioning' in node && (node as any).layoutPositioning === 'ABSOLUTE') continue;
      // Skip scroll containers — overflow is intentional
      if ('overflowDirection' in parentNode && (parentNode as any).overflowDirection !== 'NONE')
        continue;

      const nx = (node as any).x as number;
      const ny = (node as any).y as number;
      const nw = node.width;
      const nh = node.height;
      let pw = parentNode.width;
      let ph = parentNode.height;

      // Account for padding in auto-layout parents
      if ('layoutMode' in parentNode && parentNode.layoutMode !== 'NONE') {
        const pl = parentNode.paddingLeft || 0;
        const pr = parentNode.paddingRight || 0;
        const pt = parentNode.paddingTop || 0;
        const pb = parentNode.paddingBottom || 0;
        pw = pw - pl - pr;
        ph = ph - pt - pb;
      }

      if (nx < -1 || ny < -1 || nx + nw > pw + 1 || ny + nh > ph + 1) {
        violations.push({
          ruleId: 'childOverflow',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'info',
          message: 'Extends beyond parent frame bounds',
          fixable: false,
          category: 'cleanup',
        });
      }
    }
    return violations;
  },
};

// #27 — Stroke icons (vectors with stroke, no fill)
function hasVisiblePaint(paints: readonly Paint[] | PluginAPI['mixed']): boolean {
  return (
    paints !== figma.mixed &&
    Array.isArray(paints) &&
    paints.length > 0 &&
    paints.some((paint: Paint) => paint.visible !== false)
  );
}

const strokeIcons: LintRule = {
  id: 'strokeIcons',
  name: 'Stroke-based icons',
  description: 'Icons with strokes may not export cleanly — outline strokes',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: false,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (!('strokes' in node) || !('fills' in node)) continue;
      if (node.width > 48 || node.height > 48) continue;

      const vectorLike =
        node.type === 'VECTOR' ||
        node.type === 'LINE' ||
        node.type === 'BOOLEAN_OPERATION' ||
        /icon/i.test(node.name);
      if (!vectorLike) continue;

      if (hasVisiblePaint(node.strokes) && !hasVisiblePaint(node.fills)) {
        violations.push({
          ruleId: 'strokeIcons',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'info',
          message: 'Small vector with stroke — consider outlining strokes',
          fixable: false,
          category: 'cleanup',
        });
      }
    }
    return violations;
  },
};

// ---- Component description template ----

function suggestComponentDescription(node: SceneNode): string {
  const name = node.name;

  if (node.type === 'COMPONENT_SET') {
    const childCount = (node as ComponentSetNode).children.length;
    return `Component set with ${childCount} variant${childCount !== 1 ? 's' : ''}`;
  }

  if (name.includes('/')) {
    const parts = name.split('/');
    const category = parts[0].trim();
    const variant = parts.slice(1).join('/').trim();
    return `${variant} variant of ${category} component`;
  }

  return `${name} component`;
}

// #28 — Component without description
const noComponentDescription: LintRule = {
  id: 'noComponentDescription',
  name: 'No component description',
  description: 'Components should have a description for documentation',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') continue;
      const comp = node as ComponentNode | ComponentSetNode;
      if (!comp.description || comp.description.trim() === '') {
        const suggested = suggestComponentDescription(node);
        violations.push({
          ruleId: 'noComponentDescription',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'info',
          message: 'Component has no description',
          expected: suggested,
          fixable: true,
          suggestedFixData: suggested,
          category: 'cleanup',
        });
      }
    }
    return violations;
  },
};

// #32 — Image placeholder without fills
const imageWithoutFill: LintRule = {
  id: 'imageWithoutFill',
  name: 'Image placeholder without fill',
  description: 'Shapes named as images should have a fill',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'RECTANGLE' && node.type !== 'ELLIPSE' && node.type !== 'FRAME') continue;
      if (!IMAGE_NAME_RE.test(node.name)) continue;
      if (!('fills' in node)) continue;

      const fills = (node as any).fills;
      if (fills === figma.mixed) continue;
      const visibleFills = Array.isArray(fills)
        ? fills.filter((f: Paint) => f.visible !== false)
        : [];

      if (visibleFills.length === 0) {
        violations.push({
          ruleId: 'imageWithoutFill',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'info',
          message: `"${node.name}" looks like an image placeholder but has no fill`,
          fixable: false,
          category: 'cleanup',
        });
      }
    }
    return violations;
  },
};

// #33 — Single child frame (unnecessary wrapper)
const singleChildFrame: LintRule = {
  id: 'singleChildFrame',
  name: 'Single child frame',
  description: 'Frame with one child and no visual properties is an unnecessary wrapper',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'FRAME') continue;
      const frame = node as FrameNode;
      if (frame.children.length !== 1) continue;
      if (frame.layoutMode !== 'NONE') continue;
      if (frame.clipsContent) continue;

      // Skip if has visible fills, strokes, or effects
      const fills = frame.fills;
      const hasFills =
        fills !== figma.mixed &&
        Array.isArray(fills) &&
        fills.some((f: Paint) => f.visible !== false);
      if (hasFills) continue;

      const hasStrokes = frame.strokes.length > 0 && frame.strokes.some((s) => s.visible !== false);
      if (hasStrokes) continue;

      const hasEffects = frame.effects.length > 0 && frame.effects.some((e) => e.visible !== false);
      if (hasEffects) continue;

      violations.push({
        ruleId: 'singleChildFrame',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'info',
        message: 'Frame with single child and no visual properties — consider unwrapping',
        expected: 'Unwrap child to parent level',
        fixable: true,
        category: 'cleanup',
      });
    }
    return violations;
  },
};

// #40 — Instance whose main component was deleted or is unavailable
const deletedComponentInstance: LintRule = {
  id: 'deletedComponentInstance',
  name: 'Instance with deleted component',
  description: 'Instance points to a deleted or unavailable main component',
  category: 'cleanup',
  severity: 'info',
  defaultEnabled: false,
  async run(nodes) {
    const violations: Violation[] = [];

    for (const node of nodes) {
      if (node.type !== 'INSTANCE') continue;
      const inst = node as InstanceNode;
      let mainComponent: ComponentNode | null = null;
      try {
        mainComponent = await inst.getMainComponentAsync();
      } catch {
        try {
          mainComponent = inst.mainComponent;
        } catch {
          mainComponent = null;
        }
      }
      if (mainComponent) continue;

      violations.push({
        ruleId: 'deletedComponentInstance',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'info',
        message: 'Instance main component is deleted or unavailable',
        fixable: false,
        category: 'cleanup',
      });
    }
    return violations;
  },
};

export const cleanupRules: LintRule[] = [
  zeroOpacity,
  lockedLayers,
  emptyContainers,
  deepNesting,
  childOverflow,
  strokeIcons,
  noComponentDescription,
  imageWithoutFill,
  singleChildFrame,
  deletedComponentInstance,
];
