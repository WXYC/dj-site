"use client";

import { useState } from "react";
import {
  convertRangeEntry,
  type FlowsheetRangeEntryWire,
} from "@/lib/features/flowsheet/conversions";
import { rangeEntryTime } from "@/lib/features/flowsheet/entry-time";
import { messageEntryLabel } from "@/lib/features/flowsheet/marker-text";
import {
  isFlowsheetSongEntry,
  type UpdateRequestBody,
} from "@/lib/features/flowsheet/types";
import { EntryCapsules } from "@/src/components/experiences/classic/flowsheet/Capsule";
import EntryRow from "@/src/components/experiences/classic/flowsheet/EntryRow";
import { useEntryActions } from "@/src/hooks/entryActions";

/**
 * A past show's rows in the live flowsheet's columns, oldest first, the order
 * the set aired. Whether the viewer may edit changes when the show ends, so it
 * changes only the controls: without them every row keeps its grip and action
 * cells, empty. One component either way, so a row open for editing is not
 * remounted when the permission changes under it.
 *
 * What each control does comes from the entry-actions context, so none of it
 * reaches the live entries cache. A drop lands on the target's `play_order`
 * whichever way it moved.
 */
export default function ShowTable({
  entries,
  highlightedEntryId,
  editable,
}: {
  entries: FlowsheetRangeEntryWire[];
  highlightedEntryId: number | null;
  editable: boolean;
}) {
  const { updateFlowsheet, removeFromFlowsheet, reorder } = useEntryActions();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const rows = entries.map((wire) => ({ wire, entry: convertRangeEntry(wire) }));

  const endDrag = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = (targetId: number) => {
    const source = rows.find((row) => row.entry.id === draggingId)?.entry;
    const target = rows.find((row) => row.entry.id === targetId)?.entry;
    if (source && target && source.id !== target.id && "play_order" in target) {
      reorder(source, target.play_order);
    }
    endDrag();
  };

  const controls = editable
    ? {
        onUpdate: (entry_id: number, data: UpdateRequestBody) =>
          updateFlowsheet({ entry_id, data }),
        onDelete: (entry_id: number) => {
          if (confirm("Are you sure you want to delete this entry?")) {
            removeFromFlowsheet(entry_id);
          }
        },
        onDragStart: setDraggingId,
        onDragOver: setDragOverId,
        onDrop: handleDrop,
        onDragEnd: endDrag,
      }
    : {};

  return (
    <table className="entry-table">
      <thead>
        <tr className="entry-header">
          <th className="grip-cell"></th>
          <th className="classic-schedule-week-time" style={{ width: "5em" }}>
            Time
          </th>
          <th className="classic-indicator-cell" />
          <th className="classic-playlist-cell">Playlist</th>
          <th className="classic-request-cell">Req.</th>
          <th style={{ width: "25%" }}>Artist</th>
          <th>Song</th>
          <th>Release</th>
          <th>Label</th>
          <th className="action-cell"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ wire, entry }) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            leading={{
              time: rangeEntryTime(wire),
              indicators: <EntryCapsules entry={wire} />,
              marker: isFlowsheetSongEntry(entry)
                ? undefined
                : messageEntryLabel(entry),
            }}
            highlighted={entry.id === highlightedEntryId}
            isDragging={editable && draggingId === entry.id}
            isDragOver={editable && dragOverId === entry.id}
            {...controls}
          />
        ))}
      </tbody>
    </table>
  );
}
