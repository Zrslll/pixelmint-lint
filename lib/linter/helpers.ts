// ============================================================
// Shared helpers for lint rules and fixes
// ============================================================

export const INTERACTIVE_NAME_RE =
  /\b(button|btn|input|field|select|dropdown|toggle|switch|checkbox|radio|tab|link|chip|card)\b/i;

export const IMAGE_NAME_RE = /\b(image|photo|avatar|picture|thumbnail|img)\b/i;

/** Small vector/boolean_operation likely representing an icon */
export function isLikelyIcon(node: SceneNode): boolean {
  if (node.type !== 'VECTOR' && node.type !== 'BOOLEAN_OPERATION') {
    // Also check small frames/instances named "icon"
    if (/icon/i.test(node.name) && node.width <= 48 && node.height <= 48) return true;
    return false;
  }
  return (node.width <= 48 && node.height <= 48) || /icon/i.test(node.name);
}

/** Node has at least one visible IMAGE fill */
export function hasImageFill(node: SceneNode): boolean {
  if (!('fills' in node)) return false;
  const fills = (node as any).fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return false;
  return fills.some((f: Paint) => f.type === 'IMAGE' && f.visible !== false);
}
