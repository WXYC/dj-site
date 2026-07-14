# Flowsheet drag-and-drop — Stage 1: cache semantics + display ordering

**Status: complete.** Steps 1–3 of the drag-and-drop plan.

## Why these changes had to precede any UI work

Enabling the existing (disabled) drag harness without them would have produced
reorders that either diverged from the server or silently vanished:

1. **Swap vs move.** The optimistic helper `swapPlayOrdersForSwitch` did a
   pairwise play_order swap, but Backend-Service's `PATCH /flowsheet/play-order`
   (`changeOrder`) is a *move-to-position with block renumber*: it shifts every
   same-show entry between the old and new play_order by ±1, then sets the moved
   row. For any drag of distance > 1 the optimistic cache state disagreed with
   what the server persisted until the next refetch.
2. **Reorders were invisible.** Display order everywhere derived from
   `compareEntriesNewestFirst` (id DESC), and the paginated `GET /flowsheet/`
   feed also orders by id DESC only. `play_order` — the thing the reorder
   endpoint rewrites — never influenced what rendered, so even a successfully
   persisted reorder disappeared on the next poll. This also means the classic
   experience's "working" reorder was visually a no-op after refetch; the fix
   below is shared infrastructure and corrects classic too (deliberate, not
   scope creep).

## What changed

- `package.json`: removed `@atlaskit/pragmatic-drag-and-drop` (in the
  dependency list since the original harness experiments, imported nowhere).
  The active drag library is `motion` (motion/react), kept per plan decision.
- `lib/features/flowsheet/infinite-cache.ts`: `swapPlayOrdersForSwitch` →
  `movePlayOrder(draft, entryId, newPosition)`, mirroring the server's
  renumber exactly and scoped to the moved entry's `show_id` (play_order is
  per-show and values legitimately collide across shows).
  `lib/features/flowsheet/api.ts` `switchEntries.onQueryStarted` now calls it.
- `lib/features/flowsheet/partition.ts`: current-show entries are now sorted
  by new exported `compareCurrentShowOrder` — play_order DESC, id DESC
  tiebreak, matching the server's own per-show ordering (`getEntriesByShow`).
  The id tiebreak matters because tubafrenzy's webhook and dj-site assign
  play_orders independently and can collide. Previous shows stay id DESC.

## Tests

- `lib/__tests__/features/flowsheet/infinite-cache.test.ts`: movePlayOrder
  block shifts both directions, no-op cases, cross-show isolation with
  overlapping play_orders across cache pages.
- `lib/__tests__/features/flowsheet/partition.test.ts`: play_order diverging
  from id order (post-reorder shape), collision tiebreak, previous untouched.
