"use client";

import { useState } from "react";
import {
  FlowsheetEntry,
  isFlowsheetSongEntry,
  UpdateRequestBody,
} from "@/lib/features/flowsheet/types";
import EntryRow from "./EntryRow";

/** Tubafrenzy marks the row ABOVE a segue pair (data-segue on the earlier
 *  rendered row, bracket drawn down to the next row). Rows render newest-first,
 *  so the row above entry i is entries[i-1]: entry i's segue flag marks row
 *  i-1. Both rows must be songs — the CSS `:has(+ tr.entry-row)` guard needs a
 *  song row to attach to. */
function seguesIntoNext(entries: FlowsheetEntry[], index: number): boolean {
  const next = entries[index + 1];
  return (
    isFlowsheetSongEntry(entries[index]!) &&
    next !== undefined &&
    isFlowsheetSongEntry(next) &&
    next.segue === true
  );
}

export default function EntryTable({
  entries,
  previousEntries,
  onUpdate,
  onDelete,
  onReorder,
}: {
  entries: FlowsheetEntry[];
  previousEntries: FlowsheetEntry[];
  onUpdate: (entryId: number, data: UpdateRequestBody) => void;
  onDelete: (entryId: number) => void;
  /** Fired when a row is dropped onto another row. The implementation should
   *  swap the two entries' play_order values (or otherwise reorder). */
  onReorder: (sourceId: number, targetId: number) => void;
}) {
  const [showPrevious, setShowPrevious] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = (entryId: number) => {
    setDraggingId(entryId);
  };

  const handleDragOver = (entryId: number) => {
    setDragOverId(entryId);
  };

  const handleDrop = (entryId: number) => {
    if (draggingId !== null && draggingId !== entryId) {
      onReorder(draggingId, entryId);
    }
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <div id="flowsheet">
      <table className="entry-table">
        <thead>
          <tr className="entry-header">
            <th></th>
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
          {entries.length > 0 ? (
            entries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onUpdate={onUpdate}
                onDelete={onDelete}
                seguesIntoNext={seguesIntoNext(entries, index)}
                isDragging={draggingId === entry.id}
                isDragOver={dragOverId === entry.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))
          ) : (
            <tr>
              <td align="center" className="text" colSpan={8}>
                There are currently no entries on this flowsheet.
              </td>
            </tr>
          )}
        </tbody>
        {showPrevious && (
          <tbody id="previousEntries" className="flowsheetEntryData">
            {previousEntries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onUpdate={onUpdate}
                onDelete={onDelete}
                seguesIntoNext={seguesIntoNext(previousEntries, index)}
              />
            ))}
          </tbody>
        )}
      </table>
      <div className="text" style={{ textAlign: "center", padding: "10px 0" }}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowPrevious(!showPrevious);
          }}
        >
          {showPrevious ? "Hide" : "Show"} the flowsheet from the previous show
        </a>
      </div>
    </div>
  );
}
