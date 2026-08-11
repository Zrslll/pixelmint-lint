import { PaintStyleInfo, TextStyleInfo, EffectStyleInfo } from './collectStyles';
import { rgbToLab, deltaE, LABCache, MAX_SIMILAR_COLOR_DELTA_E } from './colorMatch';

// ============================================================
// Style matching — find best matching style for a node
// ============================================================

export interface StyleMatchResult {
  styleId: string;
  styleName: string;
  score: number;
}

// ---- Paint style matching (fill / stroke) ----

export function matchPaintStyle(
  paints: readonly Paint[],
  paintStyles: PaintStyleInfo[],
  labCache: LABCache
): StyleMatchResult | null {
  // Find first visible SOLID fill
  const solid = paints.find(
    (p): p is SolidPaint => p.type === 'SOLID' && p.visible !== false
  );
  if (!solid) return null;

  const targetLab = rgbToLab(solid.color.r, solid.color.g, solid.color.b);
  let bestScore = -1;
  let bestResult: StyleMatchResult | null = null;

  for (const entry of labCache.entries) {
    const dist = deltaE(targetLab, entry.lab);
    if (dist > MAX_SIMILAR_COLOR_DELTA_E) continue;

    // Score: 100 for exact match, 0 at distance 30+
    const score = Math.max(0, 100 - dist * (100 / 30));
    if (score > bestScore) {
      bestScore = score;
      bestResult = {
        styleId: entry.styleId,
        styleName: entry.styleName,
        score: Math.round(score),
      };
    }
  }

  if (!bestResult) return null;
  return bestResult;
}

// ---- Text style matching ----

export function matchTextStyle(
  fontName: FontName,
  fontSize: number,
  lineHeight: LineHeight,
  letterSpacing: LetterSpacing,
  textStyles: TextStyleInfo[]
): StyleMatchResult | null {
  let bestScore = -1;
  let bestResult: StyleMatchResult | null = null;

  for (const style of textStyles) {
    // Font family + style must match exactly
    if (
      style.fontName.family !== fontName.family ||
      style.fontName.style !== fontName.style
    ) {
      continue;
    }

    let score = 0;

    // fontSize scoring
    const sizeDiff = Math.abs(style.fontSize - fontSize);
    if (sizeDiff === 0) score += 40;
    else if (sizeDiff <= 1) score += 20;
    else if (sizeDiff <= 2) score += 10;

    // lineHeight scoring
    if (lineHeightMatch(style.lineHeight, lineHeight)) score += 10;

    // letterSpacing scoring
    if (letterSpacingMatch(style.letterSpacing, letterSpacing)) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestResult = {
        styleId: style.id,
        styleName: style.name,
        score,
      };
    }
  }

  if (!bestResult) return null;
  return bestResult;
}

function lineHeightMatch(a: LineHeight, b: LineHeight): boolean {
  if (a.unit === 'AUTO' && b.unit === 'AUTO') return true;
  if (a.unit === b.unit && 'value' in a && 'value' in b) {
    return Math.abs((a as any).value - (b as any).value) < 0.5;
  }
  return false;
}

function letterSpacingMatch(a: LetterSpacing, b: LetterSpacing): boolean {
  if (a.unit === b.unit) {
    return Math.abs(a.value - b.value) < 0.1;
  }
  return false;
}

// ---- Effect style matching ----

export function matchEffectStyle(
  effects: readonly Effect[],
  effectStyles: EffectStyleInfo[]
): StyleMatchResult | null {
  if (effects.length === 0 || effectStyles.length === 0) return null;

  const visibleEffects = effects.filter((e) => e.visible !== false);
  if (visibleEffects.length === 0) return null;

  let bestScore = -1;
  let bestResult: StyleMatchResult | null = null;

  for (const style of effectStyles) {
    const styleEffects = style.effects.filter((e) => e.visible !== false);
    // Number of effects must match
    if (styleEffects.length !== visibleEffects.length) continue;

    let totalScore = 0;
    let allMatch = true;

    for (let i = 0; i < visibleEffects.length; i++) {
      const nodeEffect = visibleEffects[i];
      const styleEffect = styleEffects[i];

      // Type must match
      if (nodeEffect.type !== styleEffect.type) {
        allMatch = false;
        break;
      }

      totalScore += 30; // Type match base

      // Shadow comparison
      if (
        (nodeEffect.type === 'DROP_SHADOW' || nodeEffect.type === 'INNER_SHADOW') &&
        (styleEffect.type === 'DROP_SHADOW' || styleEffect.type === 'INNER_SHADOW')
      ) {
        const ne = nodeEffect as DropShadowEffect;
        const se = styleEffect as DropShadowEffect;

        // Radius
        if (Math.abs(ne.radius - se.radius) <= 1) totalScore += 20;
        // Offset
        if (Math.abs(ne.offset.x - se.offset.x) <= 1 && Math.abs(ne.offset.y - se.offset.y) <= 1)
          totalScore += 20;
        // Color (deltaE)
        const nLab = rgbToLab(ne.color.r, ne.color.g, ne.color.b);
        const sLab = rgbToLab(se.color.r, se.color.g, se.color.b);
        if (deltaE(nLab, sLab) < 10) totalScore += 20;
      }

      // Blur comparison
      if (nodeEffect.type === 'LAYER_BLUR' || nodeEffect.type === 'BACKGROUND_BLUR') {
        const ne = nodeEffect as BlurEffect;
        const se = styleEffect as BlurEffect;
        if (Math.abs(ne.radius - se.radius) <= 1) totalScore += 60;
      }
    }

    if (!allMatch) continue;

    const normalizedScore = Math.min(100, totalScore);
    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      bestResult = {
        styleId: style.id,
        styleName: style.name,
        score: normalizedScore,
      };
    }
  }

  if (!bestResult) return null;
  return bestResult;
}
