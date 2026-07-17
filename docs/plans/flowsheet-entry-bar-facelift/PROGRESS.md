# Flowsheet entry bar facelift — progress

Plan: `~/.claude/plans/i-ll-have-another-agent-rustling-barto.md` (approved 2026-07-16).
Branch: `feat/flowsheet-entry-bar-facelift`. #830 is parked — design lifted by copy only.
Issues absorbed: #946 #937 #936 #939 #940 #938 #931 + ghost text.

## Slice 1 — outlined shell + table-aligned grid + Popper results panel ✅ (visually approved 2026-07-17 + fixups applied)

Kickout fixups (Jackson): interior left-border rules on each field cell
(`.entry-field-cell`, duplicating the outer outline); dedicated queue button
(soft success, `flowsheet-search-queue`) next to Play while search is open —
`submitToQueue` extracted from `handleSubmit`'s Ctrl branch (#936 pulled
forward from Slice 2); rotation toggle moved to the leading art-column cell
(replacing the Troubleshoot glyph) with `AutoModeRounded`; breakpoint/talkset
stay right.

- Entry bar fields render on the entries table's exact column template
  (Jackson's mid-flight ask): grid `60px | artist | song | album | label | 150px`
  at xl, sharing `FLOWSHEET_COL_ART_PX` / `FLOWSHEET_COL_ACTIONS_PX` constants
  exported from `Entries/tableStyles.tsx` — alignment by construction. Below xl:
  flexible template (table hides artist/label there anyway); below sm the icon
  cell drops.
- Shell = Joy `Sheet variant="outlined"`, `background.level1`, radius md,
  JS-driven `activeBorder` (neutral → primary focused → success Ctrl-held),
  squared bottom + transparent seam while the panel is open.
- Results = MUI `Popper` (disablePortal, `sameWidth` modifier, flush offset) +
  `react-transition-group` `Transition` (Joy theme has no `theme.transitions`;
  Grow crashes). `FlowsheetSearchResults` is now pure panel content, mounted
  only while open. `react-transition-group` promoted to a direct dependency.
- Buttons (Breakpoint/Talkset/RotationToggle/submit) moved into the 150px
  actions cell early (grid forced a placement); the Slice-2 state-swap +
  Queue/Clear/Play cluster comes next.
- Inter-field vertical dividers dropped — columns match the (divider-less)
  table; placeholders mark the fields. Revisit at kickout if boundaries read
  poorly.
- Tests: 1068/1068 flowsheet unit+integration; container test now
  open-conditional; one brittle `mockReturnValueOnce` fixed (anchor-ref
  setState adds a mount re-render). Lint 0 errors (−3 warnings). E2E subset
  12/12 against the live stack (cap + track-picker + crash-smoke).

### Kickout checklist (Jackson, :3000)
- [ ] Idle bar reads as a modern outlined card matching the entries table
- [ ] Column alignment at xl: inputs sit over artist/title/album/label columns
- [ ] Focus → primary border; Ctrl-hold → success; hover at rest → subtle
- [ ] Typing opens the panel flush below, one continuous outline
- [ ] Click-away / Escape closes cleanly; animation subtle; reduced-motion kills it
- [ ] Rotation mode still swaps fields in-shell
- [ ] Light + dark, all four themes spot-check; narrow width sanity

## Upcoming
- Slice 2: action-cluster state swap (Clear/Queue/Play), `submitToQueue`
- Slice 3: click-to-autofill (#937) via `freezeSelectionToQuery`
- Slice 4: ghost text verify + album ghost
- Slice 5: rotation manual label (#931) + resetEpoch (#940)
- Slice 6: freeform discoverability (#938) + ShortcutGuide + e2e sweep
