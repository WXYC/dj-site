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

## Slice 2 — commit cluster + swap policy ✅ (iterated live with Jackson 2026-07-17)

Policy (settled over three live refinements): swap signal is **typed content**
(`getSearchQueryLength > 0`), NOT focus — a focused-but-empty bar still offers
Breakpoint/Talkset. Once content exists: `[Clear][|][Queue][Play]`, all
IconButtons (square); the "/" affordance button is deleted (keyboard shortcut
remains). Field-cell rules are `::before` pseudo-elements (vertically inset,
`divider` token) mimicking the real Divider, not full-height borders.
`submitToQueue` extracted from `handleSubmit`'s Ctrl branch with unit coverage
incl. the #702/#703 negative-album_id sanitization through the queue-button
path. Dead components deleted after fresh grep: `AddToQueueButton`,
`AddRemoveFromQueue`, `RemoveFromQueueButton` (+ their tests).

Note: e2e re-run after the final swap tweak hit better-auth's sign-in 429
rate limiter (3 suite runs in 15 min); previous 12/12 pass covered the panel
restructure. Re-verify e2e at the next gate.

## Slice 3 — click-to-autofill (#937) ✅ (awaiting visual verification)

Result rows: `onClick={handleSubmit}` → `onMouseDown` + `preventDefault` +
`dispatch(freezeSelectionToQuery(row fields + linkage ids))`. Clicking fills
artist/album/label, keeps the typed song, keeps focus + panel open; commits
only via Enter/Play/Queue. Dropped the per-row `useFlowsheetSubmit`
subscription (perf) and the ctrl-tinted highlight (the cluster communicates
the queue path now). Track-picker row keys off the *effective* album id
(highlight OR frozen `query.album_id` via `hasLinkedAlbumId`), so the
tracklist stays pickable after a click. Protections: freeze reducer #704
test added (click clears `track_position`); #701/#702/#703 ride the existing
gates (freeze → `query.album_id` → conversions/queue chokepoints, covered in
slice 2's queue-path test + conversions suite).

Also: entry-bar wrapper Box (not Joy FormControl — multi-control warning),
eslint ignores extended to root-level `playwright-report/`/`test-results/`
(failed e2e runs write a minified trace bundle there that linted as errors).

## Interstitial round (Jackson feedback, 2026-07-17)
- Clear in rotation mode resets bin/release/track/song — `resetEpoch` counter
  in `resetSearch` remounts `RotationEntryFields` (reducer half of the #940
  fix pulled forward from Slice 5).
- Only `song` is HTML5-required; artist/album are the DJ's call.
- Entry wrapper is a plain Box (Joy FormControl warns on multiple controls).
- Comment discipline re-affirmed: no issue refs anywhere incl. test names.

## Slice 4 — ghost text ✅ (awaiting visual verification)
- Alignment: ghost span's `paddingInline:"inherit"` read the unpadded wrapper;
  span + input now share `ENTRY_BAR_CELL_PADDING_X`, form owns `fontSize`.
- Keyboard semantics (settled after live iteration): **Tab = switch fields
  only, never accepts; ArrowRight/End at caret end = accept + next field**
  (the accept handlers already advance artist→song→album).
- Footer hint chip: `→ accept + next field`.

## Performance + SSR pass ✅ (2026-07-17, post-rebase onto main @33 commits)

- Rebased cleanly onto main (comment-strip sweep, login/layout RSC refactors,
  CellTower flowsheet icon). All refs in code/tests stayed clean.
- `FlowsheetSearchInput` is now presentational (`value`/`isAutoFilled`/
  `onThaw` props + its own dispatch): previously each of 5 inputs subscribed
  to the FULL search pipeline + `useShowControl`'s two RTK subscriptions per
  keystroke. One pipeline subscription remains (the bar's).
- `RotationEntryFields` no longer subscribes to the pipeline just for
  `setSearchOpen` (direct dispatch).
- `FlowsheetBackendResult`: boolean `isSelected` subscription + `memo` — a
  highlight move re-renders 2 rows, not all visible rows (up to 200).
- Document keydown listener uses the latest-ref pattern — stable callback, no
  per-keystroke teardown/re-add.
- Shared `entryToFreezePayload` mapper (conversions.ts) feeds both the
  click-autofill and edit-thaw freeze dispatches.
- **No enabled-flash guarantee** (Jackson): `live` defaults false until
  whoIsLive resolves, so SSR + first paint render everything disabled;
  regression tests added at the bar level (all inputs) and on Breakpoint/
  Talkset buttons.

## Slice 5 — rotation manual label + divider cleanup ✅ (awaiting visual verification)
- Rotation mode gains an editable label field (prefilled from the release;
  hand-typed when upstream has none — the #931 UI half). Disabled until a
  release is picked.
- Rotation segments now use the shared `::before` cell rules; the raw
  full-height Dividers are gone (Jackson kickout note).
- (Album/label ghost text landed earlier from live search results; 4b done.)

## Slice 6 — results as an aligned table ✅ (awaiting visual verification)
- Result rows render on the entry bar's grid template: compressed CODE in the
  60px art column, then Artist | Song ("Unknown" placeholder) | Album | Label
  directly under the inputs; format/EXCLUSIVE chips in the actions column.
- Per-row field captions removed; each source section gets one table-style
  header row (CODE/ARTIST/SONG/ALBUM/LABEL) under its "FROM ..." label.
- NewEntryPreview (row 0) deleted — the entry fields are the authoritative
  preview; index semantics unchanged (0 = free-text, sections still offset
  from 1). Freeform discoverability now lives in the zero-results hint
  ("No matches — press Enter to log your entry exactly as typed").

### Slice 6 live-feedback round (Jackson, 2026-07-17)
- Hover = dim highlight only (`background.level1`), never rewrites the
  fields; click commits (freeze) and lights the row primary via a
  `query.album_id === entry.id` committed-state subscription.
- Deviation: editing artist/album/label (fields a click filled) dispatches
  `setSearchProperty` with `deviates` — reducer drops
  album_id/rotation_id/rotation_bin/track_position, which also unlights the
  row. Song edits and rotation-mode dispatches never deviate.
- Section headers + all dim text use palette tokens (`text.tertiary`), not
  opacity; missing-value cells likewise.
- "No matches" hint: body-xs, tertiary, and only shown once the DJ has typed
  something.

## Upcoming
- Full-suite + e2e sweep, then PR
