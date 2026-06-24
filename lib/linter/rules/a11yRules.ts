import { Violation } from '../../types';
import { LintContext, rgbToHex } from '../collectStyles';
import { LintRule } from '../engine';
import { INTERACTIVE_NAME_RE } from '../helpers';

// ============================================================
// P1 — Accessibility rules (#19)
// ============================================================

function luminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  const l1 = luminance(fg.r, fg.g, fg.b);
  const l2 = luminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getBackgroundColor(node: SceneNode): { r: number; g: number; b: number } | null {
  let current = node.parent;
  while (current) {
    if ('fills' in current) {
      const fills = (current as any).fills;
      if (fills && fills !== figma.mixed && Array.isArray(fills)) {
        for (let i = fills.length - 1; i >= 0; i--) {
          const fill = fills[i];
          if (fill.type === 'SOLID' && fill.visible !== false) {
            return fill.color;
          }
        }
      }
    }
    current = current.parent;
  }
  // Default: white background
  return { r: 1, g: 1, b: 1 };
}

// #19 — Low contrast (WCAG AA)
const lowContrast: LintRule = {
  id: 'lowContrast',
  name: 'Low contrast',
  description: 'Text contrast should meet WCAG AA (4.5:1)',
  category: 'a11y',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes) {
    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'TEXT') continue;
      const text = node as TextNode;
      const fills = text.fills;
      if (fills === figma.mixed || !Array.isArray(fills)) continue;

      const solidFill = fills.find((f: Paint) => f.type === 'SOLID' && f.visible !== false) as
        | SolidPaint
        | undefined;
      if (!solidFill) continue;

      const bg = getBackgroundColor(node);
      if (!bg) continue;

      const ratio = contrastRatio(solidFill.color, bg);
      const fontSize = text.fontSize === figma.mixed ? 16 : (text.fontSize as number);

      // WCAG AA: 4.5:1 for normal text, 3:1 for large text (>=18pt bold or >=24pt)
      const fontWeight =
        text.fontName !== figma.mixed ? (text.fontName as FontName).style.toLowerCase() : '';
      const isBold =
        fontWeight.includes('bold') || fontWeight.includes('black') || fontWeight.includes('heavy');
      const isLargeText = fontSize >= 24 || (fontSize >= 18 && isBold);
      const threshold = isLargeText ? 3 : 4.5;

      if (ratio < threshold) {
        const fgHex = rgbToHex(solidFill.color.r, solidFill.color.g, solidFill.color.b);
        const bgHex = rgbToHex(bg.r, bg.g, bg.b);
        violations.push({
          ruleId: 'lowContrast',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: `Contrast ratio ${ratio.toFixed(1)}:1 is below ${threshold}:1 (WCAG AA)`,
          current: `${fgHex} on ${bgHex} = ${ratio.toFixed(1)}:1`,
          expected: `>= ${threshold}:1`,
          fixable: false,
          category: 'a11y',
        });
      }
    }
    return violations;
  },
};

// #36 — Text below minimum font size
const textMinSize: LintRule = {
  id: 'textMinSize',
  name: 'Text below minimum size',
  description: 'Text should meet minimum font size for readability',
  category: 'a11y',
  severity: 'warning',
  defaultEnabled: true,
  run(nodes, context) {
    const minSize = context.settings.minFontSize;
    if (!minSize || minSize <= 0) return [];

    const violations: Violation[] = [];
    for (const node of nodes) {
      if (node.type !== 'TEXT') continue;
      const text = node as TextNode;
      const fontSize = text.fontSize;
      if (fontSize === figma.mixed) continue;
      if (typeof fontSize !== 'number') continue;
      if (fontSize >= minSize) continue;

      violations.push({
        ruleId: 'textMinSize',
        nodeId: node.id,
        nodeName: node.name,
        severity: 'warning',
        message: `Font size ${fontSize}px is below minimum ${minSize}px`,
        current: `${fontSize}px`,
        expected: `>= ${minSize}px`,
        fixable: false,
        category: 'a11y',
      });
    }
    return violations;
  },
};

// #38 — Touch target too small
const touchTargetSize: LintRule = {
  id: 'touchTargetSize',
  name: 'Touch target too small',
  description: 'Interactive elements should meet minimum touch target size',
  category: 'a11y',
  severity: 'warning',
  defaultEnabled: false,
  run(nodes, context) {
    const minTarget = context.settings.touchTargetMin;
    if (!minTarget || minTarget <= 0) return [];

    const violations: Violation[] = [];
    for (const node of nodes) {
      // Detect interactive: has reactions or name matches interactive pattern
      const reactions = 'reactions' in node ? (node as any).reactions : undefined;
      const hasReactions = Array.isArray(reactions) && reactions.length > 0;
      const nameMatch = INTERACTIVE_NAME_RE.test(node.name);
      if (!hasReactions && !nameMatch) continue;

      if (node.width < minTarget || node.height < minTarget) {
        violations.push({
          ruleId: 'touchTargetSize',
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          message: `Touch target ${Math.round(node.width)}x${Math.round(node.height)} is below ${minTarget}x${minTarget}`,
          current: `${Math.round(node.width)}x${Math.round(node.height)}`,
          expected: `>= ${minTarget}x${minTarget}`,
          fixable: false,
          category: 'a11y',
        });
      }
    }
    return violations;
  },
};

export const a11yRules: LintRule[] = [lowContrast, textMinSize, touchTargetSize];
