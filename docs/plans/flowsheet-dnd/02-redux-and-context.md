# Flowsheet drag-and-drop — Stage 2: drag state + context plumbing

**Status: complete.** Steps 4–5 of the drag-and-drop plan.

## isDragging in Redux (not component state)

`lib/features/flowsheet/frontend.ts` gains `isDragging` + `setIsDragging` +
`getIsDragging`. It must live in the slice because polling suspension has two
independent query subscribers: `useShowControl` and `useFlowsheet` each hold
their own `getInfiniteEntries` subscription, and RTK Query takes the minimum
non-zero `pollingInterval` across subscribers. Both already funnel through
`useFlowsheetPollingInterval()` (`src/hooks/useSSEConnection.ts`), which now
returns `0` while `isDragging` — one hook point suspends everything.

Note this only stops *polling*. SSE-driven `invalidateTags(["Flowsheet"])`
forces an immediate refetch regardless; that race is handled by the render
snapshot in Stage 4, not here.

Removed at the same time: the never-read `currentShowEntries` slice state,
`setCurrentShowEntries` action, and `getCurrentShowEntries` selector
(vestigial scaffolding from the original drag experiments).

## FlowsheetDragContext

New `src/components/experiences/modern/flowsheet/Entries/dragContext.ts`:
`{ onEntryDragStart: () => void; onEntryDragEnd: (entry) => void }` with a
no-op default so unwrapped consumers never crash.

Why a context: `DraggableEntryWrapper` is shared between the live flowsheet
(drag end must PATCH the backend) and the client-only queue (drag end must
only touch the Redux queue + localStorage). Previously the wrapper called
`useFlowsheet().entries.switchEntries` internally — meaning a queue drag
would have hit the backend. Each page now supplies its own handlers.

## Tests

- `lib/__tests__/features/flowsheet/flowsheet.test.ts`: isDragging
  action/selector/default; setCurrentShowEntries block removed.
- `src/hooks/useSSEConnection.test.tsx`: polling interval returns 0 while
  dragging regardless of SSE state, restores the right cadence after.
