"use client";

import { useState } from "react";
import {
  FlowsheetEntry,
  isFlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import EntryRow from "./EntryRow";

export default function EntryTable({
  entries,
  previousEntries,
  fontSize,
  onEdit,
  onDelete,
  onReorder,
}: {
  entries: FlowsheetEntry[];
  previousEntries: FlowsheetEntry[];
  fontSize: number;
  onEdit: (entryId: number) => void;
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
      <table cellPadding={4} cellSpacing={2} border={0} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th></th>
            <th>Indicators</th>
            <th style={{ width: "25%" }}>Artist</th>
            <th>Song</th>
            <th>Release</th>
            <th>Label</th>
            <th>Edit/Delete</th>
          </tr>
        </thead>
        <tbody>
          {entries.length > 0 ? (
            entries.map((entry, index) => {
              const nextEntry = entries[index + 1];
              const nextIsSong =
                nextEntry !== undefined && isFlowsheetSongEntry(nextEntry);
              return (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  fontSize={fontSize}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  nextIsSong={nextIsSong}
                  isDragging={draggingId === entry.id}
                  isDragOver={dragOverId === entry.id}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                />
              );
            })
          ) : (
            <tr>
              <td align="center" className="text" colSpan={7}>
                There are currently no entries on this flowsheet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <table cellPadding={4} cellSpacing={2} border={0} style={{ width: "100%" }}>
        <tbody>
          <tr style={{ backgroundColor: "#FFFFFF" }}>
            <td colSpan={5} align="center" className="redlabel">
              &nbsp;
            </td>
          </tr>
          <tr style={{ backgroundColor: "#FFFFFF" }}>
            <td colSpan={5} align="center" className="redlabel">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPrevious(!showPrevious);
                }}
              >
                {showPrevious ? "Hide" : "Show"} /Hide the flowsheet from the
                previous show below...
              </a>
            </td>
          </tr>
        </tbody>
        {showPrevious && (
          <tbody id="previousEntries" className="flowsheetEntryData">
            {previousEntries.map((entry, index) => {
              const nextEntry = previousEntries[index + 1];
              const nextIsSong =
                nextEntry !== undefined && isFlowsheetSongEntry(nextEntry);
              return (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  fontSize={fontSize}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  nextIsSong={nextIsSong}
                />
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
