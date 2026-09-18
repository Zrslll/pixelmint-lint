---
name: pixelmint-figma-lint
description: >-
  Mandatory Pixelmint design standard for all Figma mockup work: create and edit
  frames/screens/components using available Figma tooling and the 42-rule checklist,
  then audit before finishing. Also use for lint/check/review of existing Figma layouts. Triggers:
  Figma, макет, экран, frame, mockup, UI в Figma, сверстать в фигме, lint figma,
  pixelmint, проверить макет, design-system hygiene.
---

# Pixelmint Figma Lint

**Published source** — `skills/pixelmint-figma-lint/`. For global local use across Codex, Cursor, and OpenCode, link this directory as `~/.agents/skills/pixelmint-figma-lint`.

Aligned with [pixelmint-lint](https://github.com/Zrslll/pixelmint-lint). Full registry: [rules-reference.md](references/rules-reference.md).

## Runtime compatibility

Use the named Figma MCP tool when the active runtime provides it. Otherwise use the closest available equivalent with the same read or write effect. If no connected tool can perform a required operation, report the limitation instead of claiming that the check or change was completed.

## Mandatory gate

**Before any Figma mockup create/edit** (MCP or plugin-assisted): read this skill (and the rules reference when auditing).

**Before declaring mockup done:** run creation self-check, then audit criticals; capture screenshot.

Skip only if the user explicitly waives Pixelmint for this task.

## Default settings

| Setting | Default | Affects |
|---------|---------|---------|
| spacingBase | 4 | spacingNotMultiple |
| nestingDepthLimit | 5 | deepNesting |
| iconSizes | 16, 20, 24, 32 | nonStandardIconSize |
| minFontSize | 12 | textMinSize |
| touchTargetMin | 44 | touchTargetSize |

## Two modes

**Create** — build or edit Figma UI; bake rules in while building (default for mockups).
**Audit** — check/review/lint existing design.

If both apply: create with rules → audit → screenshot → finish.

---

## Creation workflow (mandatory while building)

Defaults below apply unless the user overrides.

### Structure and placement

- Place work inside a **Section** or named Frame — never float on blank canvas.
- Use **Frames**, not Groups, for layout containers.
- **Auto Layout** on any frame with 2+ children (unless all children are intentional absolute overlays).
- Integer **x, y, width, height** only.
- Max nesting depth ≤ **5** from page; unwrap single-child frames with no visuals.
- No hidden layers, 0% opacity, empty frames, or leftover locked junk.

### Styles and tokens

- **Every fill/stroke** on non-text layers → local **paint style** or **variable binding**.
- **Every text layer** → local **text style** (no mixed font/size in one text node).
- **Effects** → **effect style**.
- Colors from file palette; no one-off hex when a style exists.
- Auto-layout **gap/padding**: multiples of **4**; bind to **FLOAT variables** when present.

### Naming

- No default names (`Frame 237`, `Rectangle`, `Vector`…).
- Semantic names: `Row`, `Column`, `Card`, `Label`, `Icon`, `Button/Primary`.
- Components: slash `Category/Variant`. Variant props inside sets: `Property=Value`.

### Components

- Interactive sets (button, input, toggle, tab, link, …): include **hover** and **disabled**.
- Components/sets: non-empty **description**.
- Prefer instances; no detached instances.

### Layout and text

- Text width: **Hug** or **Fill** — avoid Fixed unless intentional truncate.
- Explicit **line-height** (~120% of font size), not Auto.
- Minimize absolute children inside auto-layout parents.

### Icons and export

- Icon size: **16 / 20 / 24 / 32** px (square).
- Icons (vector ≤48px or name `icon`): export **SVG @1x**.
- Image fills: export **PNG @2x**.

### Accessibility

- Text contrast ≥ **4.5:1** (3:1 for large/bold ≥18px bold or ≥24px).
- Min font size **12px** (unless decorative).
- Interactive targets ≥ **44×44** px.

### MCP creation checklist (before final screenshot)

```
Creation self-check:
- [ ] Section/Frame parent exists
- [ ] Auto Layout where needed
- [ ] Integer geometry
- [ ] Styles/variables bound (not raw hex)
- [ ] Semantic layer names
- [ ] Text styles + no mixed styles
- [ ] Spacing on 4px grid
- [ ] Icons standard size + export
- [ ] Contrast + touch targets on interactive UI
- [ ] No empty/hidden/locked junk layers
```

---

## Audit workflow

### 1. Connect and scope

1. Check the Figma connection, for example with `figma_diagnose` or `figma_get_status` (`probe: true`).
2. Navigate to the target if needed, for example with `figma_navigate`.
3. Scope: selection, named frame/section, or page — ask only if unclear.
4. Load the design system once, for example with `figma_get_design_system_kit` (summary → full) or the available variables and styles tools.

### 2. Collect nodes

- Selection: use `figma_get_selection` or its equivalent, then lint the selection and descendants.
- Otherwise fetch the relevant subtree with `figma_get_file_data`, `figma_execute`, or an equivalent inspection tool.
- Component rules: include page-level components and sets.

### 3. Run checks

Prefer **Pixelmint plugin** when available (authoritative, auto-fix):
> Select target → **Pixelmint → Lint Selection** → compare with agent report.

Agent-side (when MCP connected):

1. Walk all **42 rules** — [rules-reference.md](references/rules-reference.md).
2. Use deep inspection for checks the connected tools do not expose directly: textAutoResize, boundVariables, fractional coordinates, contrast, and siblings.
3. Use a general Figma lint tool only as a WCAG/layout **supplement** — not as Pixelmint parity.
4. Capture a screenshot with an available screenshot tool after visual changes.

### 4. Score

```
score = max(0, round(100 - criticals*5 - warningPenalty - infoPenalty))
```

- Critical: −5 each
- Warnings: linear cap + log overflow
- Info: minor log penalty

### 5. Report format

```markdown
# Pixelmint Lint — [scope name]

**Score:** 72/100 · **Nodes:** 84

## Summary
| Severity | Count |
|----------|-------|
| Critical | 3 |
| Warning  | 12 |
| Info     | 5 |

## Critical
- `missingFillStyle` — **Card/Background** — fill not linked to paint style
  - Fix: apply `Color/Surface` or create style

## Recommended fixes (priority)
1. ...

## Verified OK
- ...
```

Group Style → Structure → Naming → Layout → A11y → Cleanup. Each item: **ruleId**, **node name**, **message**, **fixable?**, **fix**.

### 6. Fix policy

- **Never auto-fix Main Components or Instances** without explicit approval.
- Fix by severity: critical → warnings → info.
- Re-audit and screenshot after fixes.

---

## Preferred Figma tool capabilities

| Task | Preferred capability |
|------|----------------------|
| Health | Diagnose or query the Figma connection |
| Tokens & styles | Read the design-system kit, variables, and styles |
| Selection | Read the current selection |
| Deep inspection | Execute a read-only query or fetch component development data |
| WCAG supplement | Run WCAG-focused linting |
| Visual verification | Capture a screenshot |
| Batch fixes | Execute bounded writes with Main Component protection |

Tool names differ by MCP server and runtime. Determine the available tools before choosing an operation; do not treat the example names in this skill as guaranteed capabilities.

---

## Quick triggers (RU / EN)

| User says | Action |
|-----------|--------|
| создай экран / макет / сверстай в фигме | Creation workflow + self-check + light audit |
| проверь макет / lint figma / аудит | Audit workflow |
| pixelmint / по правилам lint | Full 42-rule audit |
| fix critical / исправь критичные | Fix criticals only |

---

## Additional resources

- Rule IDs, severity, auto-fix: [rules-reference.md](references/rules-reference.md)
- Plugin: https://github.com/Zrslll/pixelmint-lint
