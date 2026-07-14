# Flowsheet drag-and-drop — Stage 5: performance + cleanliness pass

**Status: complete.** Response to observed drag jitter and post-drop stall.
Three sub-passes: the initial jitter fixes, the settle-time mutation
lifecycle fixes, and the hook-separability pass (bottom of this doc).

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

## Settle-time fixes (round 2)

The entries settle still hitched while the queue (no mutations) was smooth —
the response landing mid-spring re-rendered the table twice:

- `isSaving` (selectFlowsheetMutationPending) lived inside `useShowControl`,
  hosted ~6x per row; it flips at dispatch AND completion. Moved to
  `useFlowsheetSaving`, consumed only by GoLive and the search bar.
- `useFlowsheet`'s four mutation hooks carried default result-state
  subscriptions nothing read; pending→fulfilled re-rendered the page hosting
  the Reorder tree. All now pass an empty `selectFromResult`.

## Hook separability (round 3)

Audit of every flowsheetHooks consumer found the dominant remaining cost:
five row-level components called the FULL `useFlowsheet()` bundle (entries
query subscription + per-instance flatten/sort/partition on every cache
update) just to get a mutation callback — SongEntryControls and each
FlowsheetEntryField (`updateFlowsheet`), RemoveButton (removes),
MobileSongEntry, BinContent and FlowsheetSearchbar (`addToFlowsheet`).
~300 bundle instances on a 50-song show, each re-sorting every loaded entry
in the settle frame.

Split: **`useFlowsheetActions()`** — the five mutation callbacks
(add/remove/update/switchEntries/removeFromQueue) with stable identities and
zero query subscriptions. `useFlowsheet` composes it, so its API is
unchanged for the page-level consumers (@entries page, classic Main).

Evaluated and deliberately NOT split: goLive/leave out of `useShowControl`.
Rows do carry those two mutation subscriptions through it, but they flip
twice per show transition (imperceptible), and extracting them would either
churn ~9 components or change the composed `loading` semantics that
`useQueue`'s clear-on-offline effect depends on. Not worth it.

## Test notes

- `flowsheetHooks.test.tsx`'s API-module mock now applies
  `selectFromResult` like RTK does (`withSelectFromResult`) — without it the
  narrowed hooks read `undefined`.
- `InfiniteScroller.test.tsx` mocks `useFlowsheetPagination`.
