# Pixelmint — 42 rules (reference)

Source: pixelmint-lint · Settings defaults in SKILL.md.

Legend: 🔴 critical · 🟡 warning · ℹ️ info · 🔧 auto-fix · ⊘ off by default

---

## Style (9)

| ID | Sev | Fix | Check |
|----|-----|-----|-------|
| `missingFillStyle` | 🔴 | 🔧 | Fill without paint style and without variable binding on fills |
| `missingTextStyle` | 🔴 | 🔧 | Text without text style; mixed textStyleId segments |
| `missingStrokeStyle` | 🔴 | 🔧 | Visible stroke without paint style |
| `missingEffectStyle` | 🔴 | 🔧 | Visible effect without effect style |
| `colorNotInPalette` | 🔴 | 🔧 | Fill has style but hex not in local paint palette (CIELAB match) |
| `mixedTextStyles` | 🟡 | — | Same TEXT node: mixed fontName or fontSize |
| `duplicateStyles` | ℹ️ | — | Two+ paint or text styles with identical values (file-level) |
| `inconsistentBorderRadius` | 🟡 | — | Siblings with different cornerRadius (majority wins) |
| `missingVariableBinding` | 🟡 | — | AL gap/padding raw px while FLOAT variables exist in file |

---

## Structure (7)

| ID | Sev | Fix | Check |
|----|-----|-----|-------|
| `detachedInstance` | 🔴 | — | INSTANCE without mainComponent |
| `hiddenLayers` | 🟡 | 🔧 | visible = false |
| `groupInsteadOfFrame` | 🟡 | 🔧 | GROUP used for layout |
| `fractionalCoords` | 🔴 | 🔧 | Non-integer x or y |
| `fractionalSize` | 🔴 | 🔧 | Non-integer width or height |
| `missingExportSettings` | 🟡 | 🔧 | Icon (≤48px vector or name `icon`) or IMAGE fill without export |
| `missingStateVariants` | 🟡 | — | Interactive COMPONENT_SET missing hover and/or disabled variant |

**Interactive name pattern:** button, btn, input, field, select, dropdown, toggle, switch, checkbox, radio, tab, link, chip, card

---

## Naming (3)

| ID | Sev | Fix | Check |
|----|-----|-----|-------|
| `defaultFrameName` | 🟡 | 🔧 | `Frame \d+` on FRAME/SECTION |
| `defaultLayerName` | 🟡 | 🔧 | Default tool names: Rectangle, Ellipse, Vector, Text… |
| `componentNaming` | 🟡 | 🔧 | COMPONENT/SET without `/` (skip names with `=`) |

---

## Layout (10)

| ID | Sev | Fix | Check |
|----|-----|-----|-------|
| `duplicateObjects` | 🟡 | — | Sibling same type, position, size |
| `spacingNotMultiple` | 🟡 | — | AL gap/padding not divisible by spacingBase (4) |
| `fixedSizeText` | 🟡 | 🔧 | textAutoResize = NONE |
| `autoLineHeight` | 🟡 | 🔧 | lineHeight unit = AUTO |
| `textResizeFixed` | 🟡 | 🔧 | textAutoResize = TRUNCATE |
| `absoluteInAutoLayout` | 🟡 | — | layoutPositioning ABSOLUTE inside AL parent |
| `missingAutoLayout` | 🟡 | — | FRAME with 2+ children, no AL (skip all-absolute children) |
| `nonStandardIconSize` | 🟡 | 🔧 | Icon not in iconSizes 16/20/24/32 |
| `textOverflow` | 🟡 | 🔧 | Fixed text: render bounds exceed box |
| `inconsistentSpacing` | ℹ️ | — | Sibling AL frames with different itemSpacing |

---

## Accessibility (3)

| ID | Sev | Fix | Check |
|----|-----|-----|-------|
| `lowContrast` | 🟡 | — | Text vs parent bg: <4.5:1 (<3:1 if large text ≥24px or ≥18px bold) |
| `textMinSize` | 🟡 | — | fontSize < minFontSize (12) |
| `touchTargetSize` | 🟡 ⊘ | — | Interactive node < 44×44 (reactions or interactive name) |

---

## Cleanup (10)

| ID | Sev | Fix | Check |
|----|-----|-----|-------|
| `zeroOpacity` | 🟡 | 🔧 | opacity = 0 |
| `lockedLayers` | ℹ️ | 🔧 | locked = true |
| `emptyContainers` | ℹ️ | 🔧 | Empty FRAME or GROUP |
| `deepNesting` | ℹ️ ⊘ | — | Depth from page > nestingDepthLimit (5) |
| `childOverflow` | ℹ️ | — | Child outside parent bounds (see exclusions below) |
| `strokeIcons` | ℹ️ ⊘ | — | VECTOR ≤48px, stroke, no fill |
| `noComponentDescription` | ℹ️ | 🔧 | COMPONENT/SET empty description |
| `imageWithoutFill` | ℹ️ | — | Name matches image/photo/avatar/picture/thumbnail/img, no fill |
| `singleChildFrame` | ℹ️ | 🔧 | Frame 1 child, no AL, no fills/strokes/effects, no clip |
| `deletedComponentInstance` | ℹ️ ⊘ | — | INSTANCE whose main component is deleted or unavailable |

**childOverflow exclusions:** parent clipsContent; child absolute; parent scroll overflow; AL padding accounted.

---

## Auto-fix map

| Rules | Action |
|-------|--------|
| missingFillStyle, colorNotInPalette | Apply closest paint style |
| missingStrokeStyle | Apply stroke paint style |
| missingTextStyle | Apply text style |
| missingEffectStyle | Apply effect style |
| fractionalCoords / fractionalSize | Round to integer |
| hiddenLayers, zeroOpacity, emptyContainers | Remove layer |
| lockedLayers | Unlock |
| groupInsteadOfFrame | Convert to frame |
| missingExportSettings | SVG @1x icon / PNG @2x image |
| nonStandardIconSize | Snap to nearest standard size |
| fixedSizeText, textResizeFixed, textOverflow | Set text to Hug |
| autoLineHeight | Set explicit line-height ~120% |
| defaultFrameName, defaultLayerName, componentNaming | Rename |
| noComponentDescription | Write suggested description |
| singleChildFrame | Unwrap child |

**Protected:** Main Component and Instance — report only, no silent auto-fix.

---

## Agent audit pseudocode

For each node in scope (depth-first):

1. Skip if inside read-only component instance unless auditing instances explicitly.
2. Run category checks in order: Style → Structure → Naming → Layout → A11y → Cleanup.
3. For sibling rules (radius, spacing, duplicates): group by parent id first.
4. File-level rules (`duplicateStyles`): run once per audit against local styles.
5. Deduplicate: if `missingFillStyle` fires, skip `colorNotInPalette` on same node.

---

## Creation defaults (one-liner per category)

- **Style:** styles or variables, no raw values, palette-only colors
- **Structure:** frames, integers, exports on icons, complete variant sets
- **Naming:** semantic names, slash components
- **Layout:** auto-layout, 4px grid, hug text, explicit line-height
- **A11y:** contrast, 12px min, 44px targets
- **Cleanup:** flat tree, no junk layers, described components
