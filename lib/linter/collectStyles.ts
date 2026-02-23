import { LintSettings } from '../types';

// ============================================================
// Collect reference data (styles + variables) from current file
// Runs in Figma plugin sandbox only
// ============================================================

export interface PaintStyleInfo {
  id: string;
  name: string;
  paints: readonly Paint[];
}

export interface TextStyleInfo {
  id: string;
  name: string;
  fontSize: number;
  fontName: FontName;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
}

export interface EffectStyleInfo {
  id: string;
  name: string;
  effects: readonly Effect[];
}

export interface VariableInfo {
  id: string;
  name: string;
  resolvedType: string;
}

export interface LintContext {
  paintStyles: PaintStyleInfo[];
  textStyles: TextStyleInfo[];
  effectStyles: EffectStyleInfo[];
  variables: VariableInfo[];
  paletteColors: Set<string>;
  settings: LintSettings;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function extractColorsFromPaints(paints: readonly Paint[]): string[] {
  const colors: string[] = [];
  for (const paint of paints) {
    if (paint.type === 'SOLID' && paint.visible !== false) {
      colors.push(rgbToHex(paint.color.r, paint.color.g, paint.color.b));
    }
  }
  return colors;
}

export function collectStyles(settings: LintSettings): LintContext {
  const paintStyles: PaintStyleInfo[] = figma.getLocalPaintStyles().map((s) => ({
    id: s.id,
    name: s.name,
    paints: s.paints,
  }));

  const textStyles: TextStyleInfo[] = figma.getLocalTextStyles().map((s) => ({
    id: s.id,
    name: s.name,
    fontSize: s.fontSize,
    fontName: s.fontName,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
  }));

  const effectStyles: EffectStyleInfo[] = figma.getLocalEffectStyles().map((s) => ({
    id: s.id,
    name: s.name,
    effects: s.effects,
  }));

  // Collect variables (if API available)
  const variables: VariableInfo[] = [];
  try {
    const collections = figma.variables.getLocalVariableCollections();
    for (const collection of collections) {
      for (const varId of collection.variableIds) {
        const v = figma.variables.getVariableById(varId);
        if (v) {
          variables.push({
            id: v.id,
            name: v.name,
            resolvedType: v.resolvedType,
          });
        }
      }
    }
  } catch {
    // Variables API might not be available
  }

  // Build palette: all unique colors from paint styles
  const paletteColors = new Set<string>();
  for (const style of paintStyles) {
    for (const color of extractColorsFromPaints(style.paints)) {
      paletteColors.add(color);
    }
  }

  return {
    paintStyles,
    textStyles,
    effectStyles,
    variables,
    paletteColors,
    settings,
  };
}

export function flattenNodes(nodes: readonly SceneNode[]): SceneNode[] {
  const result: SceneNode[] = [];
  const stack: SceneNode[] = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(node);
    if ('children' in node) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }
  return result;
}

export { rgbToHex, extractColorsFromPaints };
