"use client";

import {
  FlowsheetEntry,
  isFlowsheetSongEntry,
  isFlowsheetTalksetEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
} from "@/lib/features/flowsheet/types";
import { Capsule, capsulesForSongEntry } from "./Capsule";

export default function EntryRow({
  entry,
  index,
  totalEntries,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  fontSize,
}: {
  entry: FlowsheetEntry;
  index: number;
  totalEntries: number;
  onEdit: (entryId: number) => void;
  onDelete: (entryId: number) => void;
  onMoveUp: (entryId: number) => void;
  onMoveDown: (entryId: number) => void;
  fontSize: number;
}) {
  const fontSizeClass = `fontSize${fontSize}`;

  // Markers (talkset / breakpoint / start / end of show) span the full table.
  // Column count after capsule consolidation: 1 (indicators) + 4 (artist/song/release/label)
  // + 2 (move up/down) + 1 (edit/delete) = 8 columns. Header text spans the first 5
  // (indicators + 4 data) and the row's trailing 3 columns stay empty.
  if (isFlowsheetTalksetEntry(entry)) {
    return (
      <tr style={{ backgroundColor: "#BBBBBB" }} className={`flowsheetEntryData ${fontSizeClass}`}>
        <td colSpan={5} align="center" className="redlabel">
          talkset
        </td>
        <td colSpan={3}>&nbsp;</td>
      </tr>
    );
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return (
      <tr style={{ backgroundColor: "#444444" }} className={`flowsheetEntryData ${fontSizeClass}`}>
        <td colSpan={5} align="left" className="littlegreenlabel">
          {entry.message}
        </td>
        <td colSpan={3}>&nbsp;</td>
      </tr>
    );
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return (
      <tr style={{ backgroundColor: "#444444" }} className={`flowsheetEntryData ${fontSizeClass}`}>
        <td colSpan={5} align="left" className="littlegreenlabel">
          Start: {entry.dj_name}
        </td>
        <td colSpan={3}>&nbsp;</td>
      </tr>
    );
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return (
      <tr style={{ backgroundColor: "#444444" }} className={`flowsheetEntryData ${fontSizeClass}`}>
        <td colSpan={5} align="left" className="littlegreenlabel">
          End: {entry.dj_name}
        </td>
        <td colSpan={3}>&nbsp;</td>
      </tr>
    );
  }

  if (isFlowsheetSongEntry(entry)) {
    const hasComposer = false; // BMI composer info not in current type
    const capsules = capsulesForSongEntry(entry);

    return (
      <tr style={{ backgroundColor: "#F3F3F3" }} className={`flowsheetEntryData ${fontSizeClass}`}>
        <td align="center">
          {capsules.map((c) => (
            <Capsule key={c.variant} variant={c.variant} label={c.label} />
          ))}
        </td>
        <td align="left">{entry.artist_name}</td>
        <td align="left">
          {entry.track_title}
          {hasComposer && (
            <img
              src="/img/classic/musicnote.gif"
              height={25}
              alt="Composer"
            />
          )}
        </td>
        <td align="left">{entry.album_title || ""}</td>
        <td align="left">{entry.record_label || ""}</td>
        <td align="center" className="text">
          {index > 0 && index < totalEntries - 1 ? (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onMoveUp(entry.id);
              }}
            >
              <img
                src="/img/classic/blue_up.gif"
                title="Move this entry up"
                alt="Move this entry up"
                style={{ border: 0 }}
              />
            </a>
          ) : (
            <>&nbsp;</>
          )}
        </td>
        <td align="center" className="text">
          {index < totalEntries - 2 ? (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onMoveDown(entry.id);
              }}
            >
              <img
                src="/img/classic/blue_down.gif"
                title="Move this entry down"
                alt="Move this entry down"
                style={{ border: 0 }}
              />
            </a>
          ) : (
            <>&nbsp;</>
          )}
        </td>
        <td align="center" className="text">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onEdit(entry.id);
            }}
          >
            Edit
          </a>
          &nbsp;&nbsp;
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onDelete(entry.id);
            }}
          >
            Delete
          </a>
        </td>
      </tr>
    );
  }

  return null;
}
