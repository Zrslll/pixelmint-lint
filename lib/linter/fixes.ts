import { FixAction, FixResult, Violation } from '../types';

// ============================================================
// Auto-fix logic (runs in Figma plugin sandbox)
// ============================================================

export async function applyFix(violation: Violation): Promise<boolean> {
  const node = figma.getNodeById(violation.nodeId);
  if (!node || node.removed) return false;

  switch (violation.ruleId) {
    case 'fractionalCoords':
      return fixFractionalCoords(node as SceneNode);
    case 'fractionalSize':
      return fixFractionalSize(node as SceneNode);
    case 'hiddenLayers':
      return fixRemoveHiddenLayer(node as SceneNode);
    case 'zeroOpacity':
      return fixZeroOpacity(node as SceneNode);
    case 'lockedLayers':
      return fixLockedLayer(node as SceneNode);
    case 'groupInsteadOfFrame':
      return fixGroupToFrame(node as GroupNode);
    case 'emptyContainers':
      return fixEmptyContainer(node as SceneNode);
    case 'autoLineHeight':
      return fixAutoLineHeight(node as TextNode);
    case 'fixedSizeText':
    case 'textResizeFixed':
      return fixTextResize(node as TextNode);

    // Style matching fixes
    case 'missingFillStyle':
    case 'colorNotInPalette':
      return fixApplyPaintStyle(node as SceneNode, violation.suggestedFixData, 'fill');
    case 'missingStrokeStyle':
      return fixApplyPaintStyle(node as SceneNode, violation.suggestedFixData, 'stroke');
    case 'missingTextStyle':
      return fixApplyTextStyle(node as TextNode, violation.suggestedFixData);
    case 'missingEffectStyle':
      return fixApplyEffectStyle(node as SceneNode, violation.suggestedFixData);

    // Naming fixes
    case 'defaultFrameName':
    case 'defaultLayerName':
    case 'componentNaming':
      return fixRename(node as SceneNode, violation.suggestedFixData);

    // Component description
    case 'noComponentDescription':
      return fixComponentDescription(node as SceneNode, violation.suggestedFixData);

    // New fixers
    case 'missingExportSettings':
      return fixAddExportSettings(node as SceneNode, violation.suggestedFixData);
    case 'singleChildFrame':
      return fixUnwrapSingleChild(node as FrameNode);
    case 'nonStandardIconSize':
      return fixIconResize(node as SceneNode, violation.suggestedFixData);
    case 'textOverflow':
      return fixTextResize(node as TextNode);

    default:
      return false;
  }
}

type FixOptions = {
  action?: FixAction;
  confirmed?: boolean;
};

const COMPONENT_FIX_ALLOWLIST = new Set(['noComponentDescription']);
const REQUIRED_FIX_DATA_RULES = new Set([
  'missingFillStyle',
  'colorNotInPalette',
  'missingStrokeStyle',
  'missingTextStyle',
  'missingEffectStyle',
  'defaultFrameName',
  'defaultLayerName',
  'componentNaming',
  'noComponentDescription',
  'missingExportSettings',
  'nonStandardIconSize',
]);

function emptyFixResult(): FixResult {
  return {
    fixedViolations: [],
    failedFixes: [],
    pendingConfirmationFixes: [],
    fixedCount: 0,
    failedCount: 0,
    pendingConfirmationCount: 0,
  };
}

function baseFixAction(violation: Violation): FixAction {
  if (violation.suggestedFixData?.startsWith('new:')) return 'createStyle';
  if (!violation.suggestedFixData && violation.suggestedCreateData) return 'createStyle';

  switch (violation.ruleId) {
    case 'hiddenLayers':
    case 'emptyContainers':
      return 'removeNode';
    case 'singleChildFrame':
      return 'unwrapFrame';
    case 'groupInsteadOfFrame':
      return 'convertGroup';
    case 'zeroOpacity':
      return 'changeVisibility';
    default:
      return 'default';
  }
}

function inferFixAction(violation: Violation, requestedAction?: FixAction): FixAction {
  const baseAction = baseFixAction(violation);
  if (isRiskyAction(baseAction)) return baseAction;
  if (requestedAction) return requestedAction;
  return baseAction;
}

function isRiskyAction(action: FixAction): boolean {
  return (
    action === 'createStyle' ||
    action === 'removeNode' ||
    action === 'unwrapFrame' ||
    action === 'convertGroup' ||
    action === 'changeVisibility'
  );
}

function reasonForFalse(violation: Violation): string {
  switch (violation.ruleId) {
    case 'autoLineHeight':
    case 'fixedSizeText':
    case 'textResizeFixed':
    case 'textOverflow':
      return 'Could not load the text font or text node is unsupported';
    case 'groupInsteadOfFrame':
      return 'Group could not be converted safely';
    case 'singleChildFrame':
      return 'Frame could not be unwrapped safely';
    case 'missingExportSettings':
      return 'Node does not support export settings';
    case 'nonStandardIconSize':
      return 'Node cannot be resized to the suggested icon size';
    default:
      return 'Could not apply fix to this node';
  }
}

function withCreateStyleData(violation: Violation): Violation {
  if (!violation.suggestedCreateData) return violation;
  return {
    ...violation,
    suggestedFixData: `new:${violation.suggestedCreateData}`,
  };
}

export async function applyFixWithReason(
  violation: Violation,
  options: FixOptions = {}
): Promise<{
  status: 'fixed' | 'failed' | 'pendingConfirmation';
  violation: Violation;
  action: FixAction;
  reason?: string;
}> {
  const action = inferFixAction(violation, options.action);

  if (!violation.fixable) {
    return { status: 'failed', violation, action, reason: 'Rule is not auto-fixable' };
  }

  const node = figma.getNodeById(violation.nodeId);
  if (!node || node.removed) {
    return { status: 'failed', violation, action, reason: 'Node no longer exists' };
  }

  if (node.type === 'INSTANCE') {
    return {
      status: 'failed',
      violation,
      action,
      reason: 'Instances must be fixed on the main component',
    };
  }

  if (node.type === 'COMPONENT' && !COMPONENT_FIX_ALLOWLIST.has(violation.ruleId)) {
    return {
      status: 'failed',
      violation,
      action,
      reason: 'Main component is protected for this fix',
    };
  }

  if (isRiskyAction(action) && options.confirmed !== true) {
    return {
      status: 'pendingConfirmation',
      violation,
      action,
      reason:
        action === 'createStyle'
          ? 'Requires explicit confirmation to create style'
          : 'Requires explicit confirmation',
    };
  }

  if (action === 'createStyle' && !violation.suggestedCreateData) {
    return { status: 'failed', violation, action, reason: 'Missing create style data' };
  }

  const fixViolation = action === 'createStyle' ? withCreateStyleData(violation) : violation;

  if (REQUIRED_FIX_DATA_RULES.has(fixViolation.ruleId) && !fixViolation.suggestedFixData) {
    return { status: 'failed', violation, action, reason: 'Missing fix data' };
  }

  try {
    const success = await applyFix(fixViolation);
    if (success) return { status: 'fixed', violation, action };
    return { status: 'failed', violation, action, reason: reasonForFalse(violation) };
  } catch (e) {
    return {
      status: 'failed',
      violation,
      action,
      reason: e instanceof Error && e.message ? e.message : 'Fix failed with an exception',
    };
  }
}

export async function applyFixes(
  violations: Violation[],
  filterSeverity?: 'critical' | 'warnings'
): Promise<FixResult> {
  const result = emptyFixResult();
  const toFix = violations.filter((v) => {
    if (!v.fixable) return false;
    if (filterSeverity === 'critical') return v.severity === 'critical';
    if (filterSeverity === 'warnings') return v.severity === 'warning';
    return true;
  });

  for (const v of toFix) {
    const fix = await applyFixWithReason(v);
    if (fix.status === 'fixed') {
      result.fixedViolations.push(fix.violation);
    } else if (fix.status === 'pendingConfirmation') {
      result.pendingConfirmationFixes.push({
        violation: fix.violation,
        action: fix.action,
        reason: fix.reason || 'Requires explicit confirmation',
      });
    } else {
      result.failedFixes.push({
        violation: fix.violation,
        action: fix.action,
        reason: fix.reason || 'Could not apply fix',
      });
    }
  }
  result.fixedCount = result.fixedViolations.length;
  result.failedCount = result.failedFixes.length;
  result.pendingConfirmationCount = result.pendingConfirmationFixes.length;
  return result;
}

function fixFractionalCoords(node: SceneNode): boolean {
  if ('x' in node && 'y' in node) {
    node.x = Math.round(node.x);
    node.y = Math.round(node.y);
    return true;
  }
  return false;
}

// #13 — Proper type guard instead of `as any`
function fixFractionalSize(node: SceneNode): boolean {
  if (!('resize' in node)) return false;
  const resizable = node as SceneNode & { resize(w: number, h: number): void };
  resizable.resize(Math.round(node.width), Math.round(node.height));
  return true;
}

function fixRemoveHiddenLayer(node: SceneNode): boolean {
  node.remove();
  return true;
}

function fixZeroOpacity(node: SceneNode): boolean {
  if ('opacity' in node) {
    const blendable = node as SceneNode & BlendMixin;
    blendable.opacity = 1;
    return true;
  }
  return false;
}

function fixLockedLayer(node: SceneNode): boolean {
  node.locked = false;
  return true;
}

// #5 — Rollback on error to prevent data loss
function fixGroupToFrame(node: GroupNode): boolean {
  if (node.type !== 'GROUP' || !node.parent) return false;

  const parent = node.parent;
  const index = parent.children.indexOf(node);

  const frame = figma.createFrame();
  frame.name = node.name;
  frame.visible = node.visible;
  frame.opacity = node.opacity;
  frame.locked = node.locked;
  frame.fills = [];
  frame.x = node.x;
  frame.y = node.y;
  frame.resize(node.width, node.height);

  // Insert frame at group's position BEFORE moving children —
  // otherwise Figma auto-deletes the group when its last child leaves,
  // invalidating parent/index and stranding frame at page root
  parent.insertChild(index, frame);

  const groupX = node.x;
  const groupY = node.y;

  try {
    while (!node.removed && node.children.length > 0) {
      const child = node.children[0];
      const relX = child.x - groupX;
      const relY = child.y - groupY;
      frame.appendChild(child);
      child.x = relX;
      child.y = relY;
    }
    // Group auto-removes when it loses all children — no node.remove() needed
    return true;
  } catch {
    // Rollback only if the group node still exists
    if (!node.removed) {
      while (frame.children.length > 0) {
        node.appendChild(frame.children[0]);
      }
      frame.remove();
    }
    // If Group was auto-removed, children are already in Frame — treat as success
    return node.removed;
  }
}

function fixEmptyContainer(node: SceneNode): boolean {
  if ('children' in node && (node as FrameNode | GroupNode).children.length === 0) {
    node.remove();
    return true;
  }
  return false;
}

// #6 — Handle figma.mixed fontName to prevent crash
async function fixAutoLineHeight(node: TextNode): Promise<boolean> {
  if (node.type !== 'TEXT') return false;
  if (node.fontName === figma.mixed) return false;
  try {
    await figma.loadFontAsync(node.fontName);
    const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 16;
    node.lineHeight = { value: Math.round(fontSize * 1.5), unit: 'PIXELS' };
    return true;
  } catch {
    return false;
  }
}

// #6 — Handle figma.mixed fontName to prevent crash
async function fixTextResize(node: TextNode): Promise<boolean> {
  if (node.type !== 'TEXT') return false;
  if (node.fontName === figma.mixed) return false;
  try {
    await figma.loadFontAsync(node.fontName);
    node.textAutoResize = 'HEIGHT';
    return true;
  } catch {
    return false;
  }
}

// ---- New fixers: style matching, naming, descriptions ----

function fixApplyPaintStyle(
  node: SceneNode,
  data: string | undefined,
  target: 'fill' | 'stroke'
): boolean {
  if (!data) return false;
  try {
    if (data.startsWith('new:')) {
      const styleName = data.slice(4);
      const style = figma.createPaintStyle();
      style.name = styleName;
      if (target === 'fill' && 'fills' in node) {
        const fills = (node as any).fills;
        if (fills !== figma.mixed) style.paints = fills;
        (node as any).fillStyleId = style.id;
      } else if (target === 'stroke' && 'strokes' in node) {
        style.paints = (node as any).strokes;
        (node as any).strokeStyleId = style.id;
      }
      return true;
    }
    if (target === 'fill' && 'fillStyleId' in node) {
      (node as any).fillStyleId = data;
      return true;
    }
    if (target === 'stroke' && 'strokeStyleId' in node) {
      (node as any).strokeStyleId = data;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function fixApplyTextStyle(node: TextNode, data: string | undefined): Promise<boolean> {
  if (!data) return false;
  if (node.type !== 'TEXT') return false;
  try {
    if (data.startsWith('new:')) {
      const styleName = data.slice(4);
      if (node.fontName === figma.mixed) return false;
      await figma.loadFontAsync(node.fontName);
      const style = figma.createTextStyle();
      style.name = styleName;
      style.fontName = node.fontName;
      style.fontSize = typeof node.fontSize === 'number' ? node.fontSize : 16;
      if (node.lineHeight !== figma.mixed) style.lineHeight = node.lineHeight;
      if (node.letterSpacing !== figma.mixed) style.letterSpacing = node.letterSpacing;
      node.textStyleId = style.id;
      return true;
    }
    // Load font before applying style to avoid crashes
    if (node.fontName !== figma.mixed) {
      await figma.loadFontAsync(node.fontName);
    }
    (node as any).textStyleId = data;
    return true;
  } catch {
    return false;
  }
}

function fixApplyEffectStyle(node: SceneNode, data: string | undefined): boolean {
  if (!data) return false;
  try {
    if (data.startsWith('new:')) {
      const styleName = data.slice(4);
      if (!('effects' in node)) return false;
      const style = figma.createEffectStyle();
      style.name = styleName;
      style.effects = (node as any).effects;
      (node as any).effectStyleId = style.id;
      return true;
    }
    if ('effectStyleId' in node) {
      (node as any).effectStyleId = data;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function fixRename(node: SceneNode, newName: string | undefined): boolean {
  if (!newName) return false;
  try {
    node.name = newName;
    return true;
  } catch {
    return false;
  }
}

function fixComponentDescription(node: SceneNode, description: string | undefined): boolean {
  if (!description) return false;
  try {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      (node as ComponentNode | ComponentSetNode).description = description;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---- New fixers ----

function fixAddExportSettings(node: SceneNode, format: string | undefined): boolean {
  if (!format) return false;
  if (!('exportSettings' in node)) return false;
  try {
    const exportable = node as SceneNode & { exportSettings: ExportSettings[] };
    if (format === 'svg') {
      exportable.exportSettings = [{ format: 'SVG', suffix: '' } as ExportSettingsSVG];
    } else {
      exportable.exportSettings = [
        { format: 'PNG', suffix: '@2x', constraint: { type: 'SCALE', value: 2 } },
      ];
    }
    return true;
  } catch {
    return false;
  }
}

function fixUnwrapSingleChild(node: FrameNode): boolean {
  if (node.type !== 'FRAME') return false;
  if (!node.parent || node.children.length !== 1) return false;

  const parent = node.parent;
  if (!('insertChild' in parent)) return false;

  const index = parent.children.indexOf(node);
  if (index < 0) return false;
  const child = node.children[0];

  // Cache coordinates before moving
  const frameX = node.x;
  const frameY = node.y;
  const childRelX = child.x;
  const childRelY = child.y;
  const parentIsAutoLayout = 'layoutMode' in parent && (parent as FrameNode).layoutMode !== 'NONE';

  try {
    (parent as FrameNode).insertChild(index, child);
    // Only set coordinates if parent is NOT auto-layout (AL manages positioning).
    if ('x' in child && !parentIsAutoLayout) {
      (child as any).x = frameX + childRelX;
      (child as any).y = frameY + childRelY;
    }
    // Remove the now-empty frame (use `as any` to bypass readonly children type)
    if (!node.removed && (node as any).children.length === 0) {
      node.remove();
    }
    return true;
  } catch {
    // Rollback: return child back to the frame if possible
    try {
      if (!node.removed) {
        node.insertChild(0, child);
        if ('x' in child) {
          (child as any).x = childRelX;
          (child as any).y = childRelY;
        }
      }
    } catch {}
    return false;
  }
}

function fixIconResize(node: SceneNode, sizeStr: string | undefined): boolean {
  if (!sizeStr) return false;
  if (!('resize' in node)) return false;
  const size = parseInt(sizeStr, 10);
  if (isNaN(size) || size <= 0) return false;
  try {
    const resizable = node as SceneNode & { resize(w: number, h: number): void };
    resizable.resize(size, size);
    return true;
  } catch {
    return false;
  }
}
