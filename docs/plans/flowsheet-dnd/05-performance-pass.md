# Flowsheet drag-and-drop — Stage 5: performance + cleanliness pass

**Status: complete.** Response to observed drag jitter and post-drop stall.

## The four real costs found (worst first)

1. **Per-row heavy subscriptions.** `useShowControl` runs in every row-level
   component — SongEntry, MessageEntry, and each editable
   `FlowsheetEntryField` (4-5 per row), SongEntryControls, RemoveButton. Each
   call subscribed to the full `getInfiniteEntries` result and flatten+sorted
   the entire entry list per cache event, re-rendering on every fetch-status
   flip (twice per poll). ~300 such subscriptions on a 50-row show. Fixed
   with `selectFromResult` narrowing: rows now receive only the primitives
   `live` and `currentShow` (via the existing `primaryShowId` cache helper —
   no flatten/sort) and re-render only when those actually change.
2. **Post-drop full refetch.** `switchEntries` invalidated the `Flowsheet`
   tag on success, re-pulling every loaded page after each drop — new object
   identities for every row, mass re-render, stalled settle. Removed: the
   optimistic `movePlayOrder` mirrors the server renumber exactly, so success
   needs no refetch. Failure still reverts (`patchResult.undo()`) and now
   also invalidates to resync — reorders reverse course on error, never wait
   on the 200 to settle. (The drag-end path was already fire-and-forget;
   this was the actual source of the "stall on drop".)
3. **Drag-context identity churn.** Both pages rebuilt the context value on
   every `onReorder` crossover (it closed over `order`), forcing all
   context-consuming rows to re-render through their memo mid-drag. Both now
   mirror live values into refs and memoize the context on `[dispatch]` only
   — stable for the life of the page.
4. **InfiniteScroller on the full hook.** It only drives pagination but paid
   `useFlowsheet`'s flatten/sort/partition on every cache change. New
   `useFlowsheetPagination` (selectFromResult: isLoading/isFetching/
   hasNextPage) replaces it.

## Cleanliness

- Unified `entryRef` → `entry` across DraggableEntryWrapper and MessageEntry;
  unified the two pages on the same names (`draftOrder`, `visualOrder`,
  `handleReorder`, `dragContext`).
- Trimmed narration-style comments across the feature files; kept the
  constraint-bearing ones (Reorder.Item-outside-values wedge, padding-box
  clip, per-show play_order collisions, redux isDragging rationale).

## Test notes

- `flowsheetHooks.test.tsx`'s API-module mock now applies
  `selectFromResult` like RTK does (`withSelectFromResult`) — without it the
  narrowed hooks read `undefined`.
- `InfiniteScroller.test.tsx` mocks `useFlowsheetPagination`.
