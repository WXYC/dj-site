# Flowsheet drag-and-drop — Stage 4: pages, position math, test suite

**Status: complete.** Steps 10–11 of the drag-and-drop plan.

## @entries/page.tsx — live flowsheet

- Local drag state: `order` (Reorder.Group's continuous `onReorder` output)
  plus `frozenSnapshotRef` (the pre-drag `current`, captured on drag start).
  Render feeds `order ?? snapshot ?? current` into `Reorder.Group values` —
  so while a drag is in flight the render is fully decoupled from fresh query
  data. This is the second half of the mid-drag race fix: polling is suspended
  via `isDragging` (Stage 2), and any SSE-forced refetch that lands anyway
  can't reshuffle the rows under the pointer.
- Drag end: `computeDragTarget(snapshot, finalOrder, entry.id)`
  (`lib/features/flowsheet/reorder.ts`, pure + unit-tested) returns the
  play_order held pre-drag by whichever entry occupied the drop slot — which
  is exactly the server's `new_position` semantics in both directions, across
  markers, at any distance. Then `switchEntries(entry, target)`; the
  optimistic `movePlayOrder` patch + play_order-aware sort mean the settled
  `current` matches the dropped order with no visual jump.
- Structure: one `Reorder.Group as="tbody"` for the current show (wrapped in
  the page's `FlowsheetDragContext.Provider`), followed by a second plain
  `<tbody>` for previous shows with `draggable={false}` rows. Two tbody
  siblings are valid HTML; Joy `Table` just spreads children; the
  `FLOWSHEET_TABLE_SX` selectors are `& tbody tr`-based and match both.
- `playing` is pinned to `entry.id === current[0]?.id` (was `index === 0`) so
  now-playing styling doesn't hop between rows mid-drag.
- Mobile path unchanged (no drag).

## @queue/page.tsx — client-only queue

Same local-order pattern, no snapshot/suspension needed (pure client state).
Drag end dispatches the existing `reorderQueue` reducer with
`(order ?? reversed).toReversed()` — the queue renders newest-last (reversed),
so the visual order must be un-reversed before storage. One localStorage write
per drop, not per crossover. Queue is `FlowsheetSongEntry[]` only, so no
marker exclusion applies.

## Verification

- `npx tsc --noEmit` clean; full `npm run test:run` green (255 files / 3519
  tests at time of writing).
- New/updated coverage: `reorder.test.ts` (position math both directions,
  distance > 1, across markers, plus a round-trip parity test: computed target
  → `movePlayOrder` → display sort reproduces the dropped order exactly),
  `@queue/page.test.tsx` (reversed rendering, un-reversed commit, no-op drop),
  plus the per-stage tests listed in docs 01–03.
- Manual behavior verification is Jackson's, on the localhost:3000 dev server
  running from this worktree — agents do not screenshot or drive a browser.

## Explicit non-goals (so they aren't rediscovered as bugs)

- **InfiniteScroller edge-autoscroll while dragging.** motion's own
  `autoScrollIfNeeded` only scrolls the Reorder.Group container, not the
  outer `InfiniteScroller` region — there's no conflict, just an absent
  nice-to-have (auto page-fetch when dragging near the viewport edge).
- **Cross-set dragging** (queue ↔ live flowsheet). Sets reorder only within
  themselves.
- **Reordering previous shows.** Server-side the endpoint is scoped to
  current-show members; client-side those rows are plain `<tr>`s.
- **play_order collision repair.** Colliding play_orders within a show (dual
  writers) are tolerated via the id tiebreak, not renumbered.
