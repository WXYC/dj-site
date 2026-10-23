import { useCallback, useMemo, useRef, useState } from "react";
import { computeDragTarget } from "@/lib/features/flowsheet/reorder";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import type { FlowsheetDragContextValue } from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";

/**
 * Drag-to-reorder orchestration shared by the live flowsheet and the modern
 * Previous Sets panel. Render `shown` inside a `Reorder.Group` with `onReorder`
 * as its handler, and provide `dragContext` to the rows. `reorder` receives the
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

  return { shown: draftOrder ?? snapshot ?? entries, onReorder, dragContext };
}
