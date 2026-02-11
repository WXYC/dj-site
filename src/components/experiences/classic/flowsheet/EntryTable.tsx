"use client";

import { useState } from "react";
import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import EntryRow from "./EntryRow";

export default function EntryTable({
  entries,
  previousEntries,
  fontSize,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  entries: FlowsheetEntry[];
  previousEntries: FlowsheetEntry[];
  fontSize: number;
  onEdit: (entryId: number) => void;
  onDelete: (entryId: number) => void;
  onMoveUp: (entryId: number) => void;
  onMoveDown: (entryId: number) => void;
}) {
  const [showPrevious, setShowPrevious] = useState(false);

  return (
    <div id="flowsheet">
      <table cellPadding={4} cellSpacing={2} border={0} width="100%">
        <thead>
          <tr>
            <th>Playlist</th>
            <th>Req.</th>
            <th width="25%">Artist</th>
            <th>Song</th>
            <th>Release</th>
            <th>Label</th>
            <th colSpan={2}>
              Move Up
              <br />
              or Down?
            </th>
            <th>Edit/Delete</th>
          </tr>
        </thead>
        <tbody>
          {entries.length > 0 ? (
            entries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                index={index}
                totalEntries={entries.length}
                fontSize={fontSize}
                onEdit={onEdit}
                onDelete={onDelete}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            ))
          ) : (
            <tr>
              <td align="center" className="text" colSpan={9}>
                There are currently no entries on this flowsheet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <table cellPadding={4} cellSpacing={2} border={0} width="100%">
        <tbody>
          <tr style={{ backgroundColor: "#FFFFFF" }}>
            <td colSpan={6} align="center" className="redlabel">
              &nbsp;
            </td>
          </tr>
          <tr style={{ backgroundColor: "#FFFFFF" }}>
            <td colSpan={6} align="center" className="redlabel">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPrevious(!showPrevious);
                }}
              >
                {showPrevious
                  ? "Hide"
                  : "Show"}{" "}
                /Hide the flowsheet from the previous show below...
              </a>
            </td>
          </tr>
        </tbody>
        {showPrevious && (
          <tbody id="previousEntries" className="flowsheetEntryData">
            {previousEntries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                index={index}
                totalEntries={previousEntries.length}
                fontSize={fontSize}
                onEdit={onEdit}
                onDelete={onDelete}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}
