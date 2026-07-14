# Flowsheet drag-and-drop — Stage 3: entry component tree

**Status: complete.** Steps 6–9 of the drag-and-drop plan.

## DraggableEntryWrapper: two render paths

- `draggable={true}` (default): `Reorder.Item as="tr"` exactly as before, plus
  `onDragStart`/`onDragEnd` wired to the drag context. Drag-start signaling
  deliberately lives on `Reorder.Item`'s `onDragStart` — not `DragButton`'s
  `onPointerDown` — because a click on the grip that never becomes a drag
  would otherwise set `isDragging` with no paired reset, permanently
  suspending polling. motion pairs onDragStart/onDragEnd reliably.
- `draggable={false}`: a plain `<tr>` with identical `data-testid`, row class,
  and `--row-bg`/`--row-accent` style vars. This is not just a perf
  optimization: **a mounted `Reorder.Item` whose value is absent from the
  group's `values` wedges motion's reorder detection** (verified in
  framer-motion's `check-reorder.mjs`: `values.indexOf` returns -1 for the
  crossed item, the swap loop breaks after `isReordering` was already set, and
  nothing ever resets it — the drag silently locks). Previous-show rows
  therefore must never be Items.
- The internal `useFlowsheet()`/`switchEntries` coupling is gone (see Stage 2).

## Draggability resolution (Entry.tsx)

The page passes `draggable` per bucket (current vs previous). `Entry.tsx`
resolves it once: `draggable && !isFlowsheetStartShowEntry(entry) &&
!isFlowsheetEndShowEntry(entry)` — show markers stay in the reorderable array
(the server renumbers across every entry type, so they count in position
math) but never become draggable. `entryPresentation.ts` already sets
`editable: false` for markers, which hides their DragButton; the Entry-level
exclusion also keeps them out of the Reorder.Item tree entirely.

`SongEntry`/`MessageEntry` forward `draggable` (default `true`, so queue rows
need no call-site change) and additionally gate the DragButton on it, on top
of the existing `editable` logic (`queue || (live && show_id == currentShow)`
for songs; `live && editable` for messages).

`DragButton` is restored (the `return null` kill-switch removed); grip starts
the drag via `controls.start(e)` on pointer down. Added `touchAction: "none"`
so pointer-based dragging works on touch devices.

## switchEntries API fix (flowsheetHooks.ts)

The old one-arg `switchEntries(entry)` carried a flagged TODO bug: it indexed
`currentShowEntries` and read that index from `allEntries` (different arrays),
and derived the target from cache order rather than the dragged visual order.
Replaced with `switchEntries(entry, newPosition)` — auth guards + the mutation
call only. Position math moved to the page (Stage 4), which owns the drag
state. Classic `Main.tsx` calls the mutation directly and is unaffected.

## Tests

- `DraggableEntryWrapper.test.tsx`: rewritten — context wiring (start/end,
  no-op default), plain-tr path parity (testid/class/style), dragListener
  gating.
- `DragButton.test.tsx`: renders grip, starts drag on pointer down.
- `flowsheetHooks.test.tsx`: mutation called with verbatim
  `{entry_id, new_position}`; guard when logged out.
