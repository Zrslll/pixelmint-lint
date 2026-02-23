import { PaintStyleInfo } from './collectStyles';

// ============================================================
// Color distance matching — sRGB → CIELAB → Delta E (CIE76)
// ============================================================

interface LAB {
  L: number;
  a: number;
  b: number;
}

export interface ColorMatchResult {
  styleId: string;
  styleName: string;
  hex: string;
  distance: number;
}

// Pre-computed LAB cache for paint styles (computed once per lint run)
export interface LABCache {
  entries: Array<{ styleId: string; styleName: string; hex: string; lab: LAB }>;
}

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToLab(r: number, g: number, b: number): LAB {
  // sRGB (0-1) → linear RGB → XYZ (D65)
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);

  let x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  let y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  let z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883;

  // XYZ → LAB
  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

export function deltaE(lab1: LAB, lab2: LAB): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

function toHex(v: number): string {
  return Math.round(v * 255).toString(16).padStart(2, '0');
}

export function buildLABCache(paintStyles: PaintStyleInfo[]): LABCache {
  const entries: LABCache['entries'] = [];
  for (const style of paintStyles) {
    for (const paint of style.paints) {
      if (paint.type === 'SOLID' && paint.visible !== false) {
        const { r, g, b } = paint.color;
        entries.push({
          styleId: style.id,
          styleName: style.name,
          hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase(),
          lab: rgbToLab(r, g, b),
        });
      }
    }
  }
  return { entries };
}

export function findClosestPaintStyle(
  targetR: number,
  targetG: number,
  targetB: number,
  cache: LABCache
): ColorMatchResult | null {
  if (cache.entries.length === 0) return null;

  const targetLab = rgbToLab(targetR, targetG, targetB);
  let bestDistance = Infinity;
  let bestEntry: LABCache['entries'][0] | null = null;

  for (const entry of cache.entries) {
    const dist = deltaE(targetLab, entry.lab);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestEntry = entry;
    }
  }

  if (!bestEntry) return null;

  return {
    styleId: bestEntry.styleId,
    styleName: bestEntry.styleName,
    hex: bestEntry.hex,
    distance: Math.round(bestDistance * 10) / 10,
  };
}
