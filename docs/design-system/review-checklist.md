# Review checklist

Run through this before opening a PR that touches modern UI. Each item points to the rule behind it.

## Structure
- [ ] Lists of records use the record table (`recordTableSx`, `ROW_HEIGHT`), artwork first, in importance order. → [patterns](patterns.md#record-table)
- [ ] The element passes the library test: it maps to a real object or act, or it is quiet and conventional. → [README](README.md#the-idea)
- [ ] Page actions sit in `PageHeader`, not in tabs. The page either fills `Main` with a flex child that owns its scroll, or uses `ScrollRegion`. → [foundations](foundations.md#page-frame)
- [ ] Narrow widths fold columns; only phones get cards. → [foundations](foundations.md#responsive-fold)

## Color and type
- [ ] No hex values, `rgba()` literals, or Joy slot names chosen for their English meaning. Color comes through `tokens/roles.ts`. → [foundations](foundations.md#color)
- [ ] Rotation bins are colored only through `rotationBinSx` / `rotationBinColors`.
- [ ] One `solid` per decision. MD writes are `success`; reversible removals are `warning`.
- [ ] Nothing is signalled by color alone.
- [ ] Text passes 4.5:1 and state indicators pass 3:1, in all four themes in light and dark.
- [ ] Weights are 400/500 only. The only sub-scale size is `STATUS_CHIP_SX`. Numbers use `tabularNumsSx`.
- [ ] Identity fields clamp to two lines. No native `title=` tooltips; use a Joy Tooltip plus the full accessible name.

## Interaction
- [ ] Row actions follow the ghost-actions contract: visible by default, hidden only under `(hover: hover) and (pointer: fine)`, never clickable while hidden. → [patterns](patterns.md#ghost-actions)
- [ ] Every row action is also in the row's context menu, which opens from right-click, the Menu key, and Shift+F10.
- [ ] Menus use `useMenuFocus`, a flat item array, and destructive items last. → [patterns](patterns.md#menus)
- [ ] Every per-row control's accessible name names its row.
- [ ] Clickable chips with abbreviated text set `aria-label` and clear `aria-labelledby`.
- [ ] Reversible single removals have Undo, not a dialog. Bulk or hard-to-reverse actions use `ConfirmDialog` with focus on the safe choice. No `window.confirm()`. → [patterns](patterns.md#destructive-actions)

## States
- [ ] No visible status text. Loading shows skeletons or the mounted spinner, with words in a `StatusRegion`. → [patterns](patterns.md#loading)
- [ ] An empty state never renders before its read settles, and an outage is never drawn as empty.
- [ ] Empty copy offers one next step. Error copy offers a remedy.
- [ ] Motion stays within the durations and respects `prefers-reduced-motion`. → [foundations](foundations.md#motion)

## Copy
- [ ] Rotation copy says Retire / Retired / Restore. Buttons name their act and count. Server text is unaltered. → [voice](voice.md)
