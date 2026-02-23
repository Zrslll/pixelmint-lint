# Pixelmint

Open-source Figma plugin for automated design linting. Checks your file against its own design system — paint styles, text styles, effect styles, and variables as the source of truth. Zero config: the plugin reads what's already in your file.

**42 rules · 12 auto-fixers · CIELAB color matching · Main Component protection**

---

## How it works

1. Select any elements in Figma
2. Click **Lint Selection**
3. Get a scored report with violations grouped by category
4. Apply fixes individually or in bulk

The plugin collects your local styles and variables as a reference, then runs every enabled rule against the selected nodes. Score: `100 − (criticals×5 + warnings penalty + info penalty)`.

---

## Rules

Each rule is backed by an industry source. 🔧 = has auto-fixer. ⊘ = disabled by default.

### 🎨 Style

| # | Rule | Severity | Source |
|---|------|----------|--------|
| 1 | **Missing fill style** — fill not linked to a local paint style | 🔴 Critical 🔧 | [Figma · Styles](https://help.figma.com/hc/en-us/articles/360039238753) · [Figma Best Practices](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) |
| 2 | **Missing text style** — text node not linked to a local text style | 🔴 Critical 🔧 | [Figma · Text styles](https://help.figma.com/hc/en-us/articles/360039957034) |
| 3 | **Missing stroke style** — stroke not linked to a local paint style | 🔴 Critical 🔧 | [Figma · Styles](https://help.figma.com/hc/en-us/articles/360039238753) |
| 4 | **Missing effect style** — shadow/blur not linked to a local effect style | 🔴 Critical 🔧 | [Figma · Styles](https://help.figma.com/hc/en-us/articles/360039238753) |
| 5 | **Color not in palette** — fill color not matching any local paint style | 🔴 Critical 🔧 | [W3C Design Tokens](https://design-tokens.github.io/community-group/format/) · [Figma Best Practices](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) |
| 6 | **Mixed text styles** — text node has segments with different fonts or sizes | 🟡 Warning | [Figma · Mixed styles](https://help.figma.com/hc/en-us/articles/360039957034) |
| 7 | **Duplicate styles** — two or more styles with identical values | ℹ️ Info | [Figma · Managing styles](https://help.figma.com/hc/en-us/articles/360039238753) |
| 8 | **Inconsistent border radius** — sibling elements use different corner radii | 🟡 Warning | [Material Design · Shape](https://m2.material.io/design/shape/about-shape.html) · [Apple HIG · Visual Design](https://developer.apple.com/design/human-interface-guidelines/visual-design) |
| 9 | **Missing variable binding** — spacing/padding uses raw px when FLOAT variables exist | 🟡 Warning | [Figma · Variables guide](https://help.figma.com/hc/en-us/articles/15339657135383) |

### 🏗 Structure

| # | Rule | Severity | Source |
|---|------|----------|--------|
| 10 | **Detached instance** — component instance missing its main component | 🔴 Critical | [Figma · Components](https://help.figma.com/hc/en-us/articles/360038662654) |
| 11 | **Hidden layers** — invisible layers cluttering the file | 🟡 Warning 🔧 | [Figma · Best practices](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) |
| 12 | **Group instead of Frame** — Groups lack auto-layout and clipping control | 🟡 Warning 🔧 | [Figma · Groups vs Frames](https://www.figma.com/best-practices/groups-versus-frames/) |
| 13 | **Fractional coordinates** — non-integer x/y causes sub-pixel blur on export | 🔴 Critical 🔧 | [Figma · Pixel precision](https://help.figma.com/hc/en-us/articles/360039956974) · [MDN · image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering) |
| 14 | **Fractional size** — non-integer width/height causes sub-pixel blur | 🔴 Critical 🔧 | [Figma · Pixel precision](https://help.figma.com/hc/en-us/articles/360039956974) |
| 15 | **Missing export settings** — icons and images have no export config | 🟡 Warning 🔧 | [Figma · Export assets](https://help.figma.com/hc/en-us/articles/360040028114) |
| 16 | **Missing state variants** — interactive component set missing hover/disabled | 🟡 Warning | [Figma · Interactive components](https://help.figma.com/hc/en-us/articles/360061175334) · [WCAG 1.4.11 Non-text Contrast](https://www.w3.org/TR/WCAG21/#non-text-contrast) |

### 🏷 Naming

| # | Rule | Severity | Source |
|---|------|----------|--------|
| 17 | **Default frame name** — frame still named "Frame 237" | 🟡 Warning 🔧 | [Figma · Naming conventions](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) |
| 18 | **Default layer name** — layer still named "Rectangle", "Ellipse", etc. | 🟡 Warning 🔧 | [Figma · Naming conventions](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) |
| 19 | **Component naming** — standalone component name has no slash grouping (`Button/Primary`) | 🟡 Warning | [Figma · Slash notation](https://help.figma.com/hc/en-us/articles/360038663994-Name-and-organize-components#h_01EW7BJPAQX2R3E9EMQFBVX1V6) |

> Rule 19 skips variant components (`Property=Value` syntax) — they belong to a `COMPONENT_SET` and follow Figma's variant naming convention, not slash grouping.

### 📐 Layout

| # | Rule | Severity | Source |
|---|------|----------|--------|
| 20 | **Duplicate objects** — two sibling elements at identical position and size | 🟡 Warning | File hygiene — accidental copies from Cmd+D |
| 21 | **Spacing not multiple of base** — gap/padding not divisible by 4 or 8px | 🟡 Warning | [Material Design · 8dp grid](https://m2.material.io/design/layout/understanding-layout.html) · [Spec · 8-point grid](https://spec.fm/specifics/8-pt-grid) |
| 22 | **Fixed size text** — text node set to Fixed instead of Hug/Fill | 🟡 Warning 🔧 | [Figma · Auto layout text](https://help.figma.com/hc/en-us/articles/360040451373) |
| 23 | **Auto line height** — line-height set to Auto instead of an explicit value | 🟡 Warning 🔧 | [Material · Typography properties](https://m2.material.io/design/typography/understanding-typography.html#type-properties) |
| 24 | **Text truncation** — text resize set to Truncate, content may be hidden | 🟡 Warning 🔧 | [Figma · Text resize](https://help.figma.com/hc/en-us/articles/360039956854) |
| 25 | **Absolute in AutoLayout** — absolutely-positioned child breaks auto-layout flow | 🟡 Warning | [Figma · Absolute position in auto layout](https://help.figma.com/hc/en-us/articles/360040451373) |
| 26 | **Missing auto layout** — frame with 2+ children and no auto layout | 🟡 Warning | [Figma · Auto layout](https://help.figma.com/hc/en-us/articles/360040451373) |
| 27 | **Non-standard icon size** — icon dimensions not in allowed sizes (16/20/24/32px) | 🟡 Warning 🔧 | [Material Design · System icons](https://m2.material.io/design/iconography/system-icons.html) · [Apple · SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols) |
| 28 | **Text overflow** — text render bounds exceed its bounding box | 🟡 Warning 🔧 | Layout correctness — text clipped by container |
| 29 | **Inconsistent spacing** — sibling auto-layout frames use different item gaps | ℹ️ Info | [8-point grid system](https://m2.material.io/design/layout/understanding-layout.html) |

### ♿ Accessibility

| # | Rule | Severity | Source |
|---|------|----------|--------|
| 30 | **Low contrast** — text contrast below WCAG AA (4.5:1 normal text, 3:1 large text) | 🟡 Warning | [WCAG 2.1 · 1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG21/#contrast-minimum) |
| 31 | **Text below minimum size** — font size below configured minimum (default 12px) | 🟡 Warning | [WCAG 2.1 · 1.4.4 Resize Text](https://www.w3.org/TR/WCAG21/#resize-text) · [Apple HIG · Typography](https://developer.apple.com/design/human-interface-guidelines/typography) |
| 32 | **Touch target too small** — interactive element below minimum tap area (default 44px) | 🟡 Warning | [WCAG 2.1 · 2.5.5 Target Size](https://www.w3.org/TR/WCAG21/#target-size) · [Apple HIG · 44pt minimum](https://developer.apple.com/design/human-interface-guidelines/buttons) · [Material · 48dp minimum](https://m2.material.io/design/usability/accessibility.html) |

### 🧹 Cleanup

| # | Rule | Severity | Source |
|---|------|----------|--------|
| 33 | **Zero opacity** ⊘ — layer at 0% opacity is invisible | ℹ️ Info 🔧 | File hygiene |
| 34 | **Locked layers** ⊘ — layer is locked (forgotten lock) | ℹ️ Info 🔧 | Collaboration hygiene |
| 35 | **Empty containers** ⊘ — frame or group with no children | ℹ️ Info 🔧 | File hygiene |
| 36 | **Deep nesting** ⊘ — layer depth exceeds configured limit | ℹ️ Info | [Figma performance](https://help.figma.com/hc/en-us/articles/360039820334) — deep trees slow rendering and dev handoff |
| 37 | **Child overflow** ⊘ — child element extends beyond parent bounds | ℹ️ Info | Layout correctness |
| 38 | **Stroke-based icons** ⊘ — small vector with strokes and no fill | ℹ️ Info | SVG export — strokes scale with viewport; outline strokes for consistent export |
| 39 | **No component description** ⊘ — component or component set has no description | ℹ️ Info 🔧 | [Figma · Component descriptions](https://help.figma.com/hc/en-us/articles/360038663994) |
| 40 | **Image placeholder without fill** ⊘ — shape named "image/photo/avatar" has no fill | ℹ️ Info | Design hygiene — placeholder with no visual indicator |
| 41 | **Single child frame** ⊘ — frame with one child and no visual properties | ℹ️ Info 🔧 | File hygiene — unnecessary wrapper adds nesting depth |
| 42 | **Unused component** ⊘ (off by default) — component has no instances in selection | ℹ️ Info | Design system maintenance |

---

## Severity & scoring

| Level | Score impact |
|-------|-------------|
| 🔴 Critical | −5 per violation |
| 🟡 Warning | Linear cap + logarithmic overflow |
| ℹ️ Info | Minor logarithmic penalty |

---

## Auto-fixers (12)

| Fixer | Action |
|-------|--------|
| Apply paint style | Links fill/stroke to closest local style (CIELAB match) |
| Apply text style | Links text node to matching local text style |
| Apply effect style | Links effect to matching local effect style |
| Round coordinates | Rounds x/y to nearest integer |
| Round dimensions | Rounds width/height to nearest integer |
| Set export settings | Adds SVG @1x for icons, PNG @2x for images |
| Convert group to frame | Replaces Group with Frame, preserving children |
| Resize icon | Snaps icon to nearest standard size |
| Fix text resize | Sets text auto-resize to Hug |
| Fix line height | Sets explicit line-height (120% of font size) |
| Remove hidden layer | Deletes hidden layers |
| Unwrap single child | Moves child to parent level, removes wrapper frame |

---

## Main Component protection

Violations on Main Components are shown in the report but **no fix is offered**. Auto-fixing a Main Component would propagate changes to all its instances across the file — that should always be a deliberate decision.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Figma desktop app

### Install & run

```bash
npm install
npm run dev      # esbuild watch + vite build watch
```

Import `plugin/manifest.json` in Figma → Plugins → Development → Import plugin from manifest.

### Production build

```bash
npm run build    # → plugin/dist/code.js + plugin/dist/ui.html
```

---

## Architecture

```
[Figma Plugin Sandbox]  ←postMessage→  [Inline SPA (ui.html)]
       ↓                                    ↓
  Figma API access               React + Tailwind UI
  Rule engine + fixes            3 screens + state
  collectStyles()                postMessage bridge
```

- **Sandbox** (`plugin/code.ts`) — the only process with Figma API access
- **UI** (`src/App.tsx`) — inline SPA bundled into `plugin/dist/ui.html` via Vite + vite-plugin-singlefile
- **Shared** (`lib/`) — types and linter code shared between Vite (UI) and esbuild (sandbox)

## Stack

TypeScript · React 18 · Tailwind CSS · Figma Plugin API · Vite · esbuild

---

## License

MIT
