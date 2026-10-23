import { useCallback, useMemo, useRef, useState } from "react";
import {
  computeDragTarget,
  moveAdjacent,
} from "@/lib/features/flowsheet/reorder";
import {
  isFlowsheetEndShowEntry,
  isFlowsheetStartShowEntry,
  type FlowsheetEntry,
} from "@/lib/features/flowsheet/types";
import type {
  FlowsheetDragContextValue,
  FlowsheetMoveContextValue,
} from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";

// Show start/end markers bound the reorderable region: they're never
// draggable, and no entry may be moved across one (a song ordered before the
// show started / after it ended is nonsense). Desktop drag enforces this for
// free — markers render outside the Reorder tree, so motion never swaps them
// — but the mobile up/down path walks the raw array and must exclude them.
const isMarkerEntry = (entry: FlowsheetEntry) =>
  isFlowsheetStartShowEntry(entry) || isFlowsheetEndShowEntry(entry);

/**
 * Drag-to-reorder orchestration shared by the live flowsheet and the modern
 * Previous Sets panel. Render `shown` inside a `Reorder.Group` with `onReorder`
 * as its handler, and provide `dragContext` to the rows (or `moveContext` to the mobile rows, bounded by
 * `firstDraggable`/`lastDraggable`). `reorder` receives the
 * dragged entry and the `play_order` it should take.
 */
export function useReorderableEntries({
  entries,
  reorder,
  onDraggingChange,
}: {
  entries: FlowsheetEntry[];
  reorder: (entry: FlowsheetEntry, newPosition: number) => void;
  /** Called with true at drag start and false at drag end. */
  onDraggingChange?: (dragging: boolean) => void;
}) {
  // The drag context reads everything through refs so its identity never
  // changes: every row consumes it, and a per-crossover identity change would
  // re-render them all through their memo.
  const [draftOrder, setDraftOrder] = useState<FlowsheetEntry[] | null>(null);
  const draftRef = useRef<FlowsheetEntry[] | null>(null);
  // Frozen when a drag starts, so a refetch that lands mid-drag cannot change
  // the "before" order the drop target is computed against. Held in state as
  // well as a ref: the render draws it, so clearing it at drag end must
  // schedule a render even when no row moved and the draft is unchanged.
  const [snapshot, setSnapshot] = useState<FlowsheetEntry[] | null>(null);
  const snapshotRef = useRef<FlowsheetEntry[] | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const reorderRef = useRef(reorder);
  reorderRef.current = reorder;
  const onDraggingChangeRef = useRef(onDraggingChange);
  onDraggingChangeRef.current = onDraggingChange;

  const onReorder = useCallback((next: FlowsheetEntry[]) => {
    draftRef.current = next;
    setDraftOrder(next);
  }, []);

  const dragContext = useMemo<FlowsheetDragContextValue>(
    () => ({
      onEntryDragStart: () => {
        snapshotRef.current = entriesRef.current;
        setSnapshot(entriesRef.current);
        onDraggingChangeRef.current?.(true);
      },
      onEntryDragEnd: (entry) => {
        const before = snapshotRef.current ?? entriesRef.current;
        const newPosition = computeDragTarget(
          before,
          draftRef.current ?? before,
          entry.id
        );
        if (newPosition !== null) {
          reorderRef.current(entry, newPosition);
        }
        snapshotRef.current = null;
        setSnapshot(null);
        draftRef.current = null;
        setDraftOrder(null);
        onDraggingChangeRef.current?.(false);
      },
    }),
    []
  );

  // Mobile reorders one step at a time (up/down buttons instead of drag):
  // a one-step move is just a drag whose final order is the adjacent swap.
  const moveContext = useMemo<FlowsheetMoveContextValue>(
    () => ({
      moveEntry: (entry, direction) => {
        const current = entriesRef.current;
        const index = current.findIndex((e) => e.id === entry.id);
        if (index === -1) {
          return;
        }
        // Never swap an entry past a show marker (see isMarkerEntry). The
        // buttons are already disabled at that edge, but the guard keeps the
        // invariant in the data path too.
        const neighbor = current[direction === "up" ? index - 1 : index + 1];
        if (!neighbor || isMarkerEntry(neighbor)) {
          return;
        }
        const next = moveAdjacent(current, entry.id, direction);
        if (!next) {
          return;
        }
        const newPosition = computeDragTarget(current, next, entry.id);
        if (newPosition !== null) {
          reorderRef.current(entry, newPosition);
        }
      },
    }),
    []
  );

  // Reorder bounds are the first/last draggable row, not the array edges:
  // a show marker sits at the bottom while live, and the oldest song must
  // stop above it rather than swap past it.
  const firstDraggable = entries.findIndex((e) => !isMarkerEntry(e));
  const lastDraggable = entries.findLastIndex((e) => !isMarkerEntry(e));

  return {
    shown: draftOrder ?? snapshot ?? entries,
    onReorder,
    dragContext,
    moveContext,
    firstDraggable,
    lastDraggable,
  };
}
