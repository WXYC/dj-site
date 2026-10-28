"use client";

import { useState, type ComponentProps } from "react";
import {
  convertRangeEntry,
  type FlowsheetRangeEntryWire,
} from "@/lib/features/flowsheet/conversions";
import { rangeEntryTime } from "@/lib/features/flowsheet/entry-time";
import { EntryCapsules } from "@/src/components/experiences/classic/flowsheet/Capsule";
import EntryRow from "@/src/components/experiences/classic/flowsheet/EntryRow";
import { useEntryActions } from "@/src/hooks/entryActions";

type RowControls = Omit<
  ComponentProps<typeof EntryRow>,
  "entry" | "leading" | "highlighted"
>;

/**
 * A past show's rows in the live flowsheet's columns. Rows read oldest first,
 * the order the set aired. Without `controls` every row keeps its grip and
 * action cells, empty, so a viewer who cannot edit sees the same table as one
 * who can; whether a viewer can edit changes when the show ends, and the table
 * must not change shape with it.
 */
export function ShowTable({
  entries,
  highlightedEntryId,
  controls,
}: {
  entries: FlowsheetRangeEntryWire[];
  highlightedEntryId: number | null;
  controls?: (entryId: number) => RowControls;
}) {
  return (
    <table className="entry-table">
      <thead>
        <tr className="entry-header">
          <th></th>
          <th className="classic-schedule-week-time" style={{ width: "5em" }}>
            Time
          </th>
          <th className="classic-indicator-cell" />
          <th>Playlist</th>
          <th>Req.</th>
          <th style={{ width: "25%" }}>Artist</th>
          <th>Song</th>
          <th>Release</th>
          <th>Label</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {entries.map((wire) => {
          const entry = convertRangeEntry(wire);
          return (
            <EntryRow
              key={entry.id}
              entry={entry}
              leading={{
                time: rangeEntryTime(wire),
                indicators: <EntryCapsules entry={wire} />,
              }}
              highlighted={entry.id === highlightedEntryId}
              {...controls?.(entry.id)}
            />
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The show table with the live flowsheet's edit, delete and drag controls.
 * What each control does comes from the entry-actions context, so none of it
 * reaches the live entries cache. A drop lands on the target's `play_order`
 * whichever way it moved.
 */
export default function EditableShowTable({
  entries,
  highlightedEntryId,
}: {
  entries: FlowsheetRangeEntryWire[];
  highlightedEntryId: number | null;
}) {
  const { updateFlowsheet, removeFromFlowsheet, reorder } = useEntryActions();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const rows = entries.map(convertRangeEntry);

  const endDrag = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = (targetId: number) => {
    const source = rows.find((row) => row.id === draggingId);
    const target = rows.find((row) => row.id === targetId);
    if (source && target && source.id !== target.id && "play_order" in target) {
      reorder(source, target.play_order);
    }
    endDrag();
  };

  return (
    <ShowTable
      entries={entries}
      highlightedEntryId={highlightedEntryId}
      controls={(entryId) => ({
        onUpdate: (entry_id, data) => updateFlowsheet({ entry_id, data }),
        onDelete: (entry_id) => {
          if (confirm("Are you sure you want to delete this entry?")) {
            removeFromFlowsheet(entry_id);
          }
        },
        isDragging: draggingId === entryId,
        isDragOver: dragOverId === entryId,
        onDragStart: setDraggingId,
        onDragOver: setDragOverId,
        onDrop: handleDrop,
        onDragEnd: endDrag,
      })}
    />
  );
}
