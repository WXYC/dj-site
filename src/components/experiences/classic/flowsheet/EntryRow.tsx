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
import { formatShortDate, formatShortTime } from "./marker-format";
import "@/src/styles/classic/segue.css";
import "@/src/styles/classic/markers.css";
import "@/src/styles/classic/drag.css";

type Props = {
  entry: FlowsheetEntry;
  onEdit: (entryId: number) => void;
  onDelete: (entryId: number) => void;
  fontSize: number;
  /** True if the next row in the table is also a song row.
   *  Used to suppress the segue indicator when the next row is a talkset,
   *  breakpoint, or show-block — those render full-width and would leave the
   *  red bracket dangling. EntryTable computes and passes this. */
  nextIsSong?: boolean;
  /** True while this row is the source of an active drag. */
  isDragging?: boolean;
  /** True while a drag-over event is hovering this row (drop target preview). */
  isDragOver?: boolean;
  onDragStart?: (entryId: number) => void;
  onDragOver?: (entryId: number) => void;
  onDrop?: (entryId: number) => void;
  onDragEnd?: () => void;
};

function GripCell() {
  return (
    <td className="grip-cell">
      <span className="grip-handle" aria-label="Drag to reorder">
        {"⠇"}
      </span>
    </td>
  );
}

function EmptyGripCell() {
  return <td className="grip-cell">&nbsp;</td>;
}

export default function EntryRow({
  entry,
  onEdit,
  onDelete,
  fontSize,
  nextIsSong,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const fontSizeClass = `fontSize${fontSize}`;

  // Marker rows (talkset / breakpoint / start / end of show) span 5 of the 7
  // post-PR8 columns: grip + indicators + artist + song + release + label + edit.
  // The marker's content cell colspans the 5 middle data columns; the trailing
  // edit/delete column gets an empty cell.

  const dragClass = [
    isDragging ? "dragging" : "",
    isDragOver ? "drag-over" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isFlowsheetTalksetEntry(entry)) {
    return (
      <tr
        className={`flowsheetEntryData classic-marker-talkset ${fontSizeClass} ${dragClass}`.trim()}
        draggable={true}
        onDragStart={() => onDragStart?.(entry.id)}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver?.(entry.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop?.(entry.id);
        }}
        onDragEnd={() => onDragEnd?.()}
      >
        <GripCell />
        <td colSpan={5} align="center">
          talkset
        </td>
        <td>&nbsp;</td>
      </tr>
    );
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return (
      <tr
        className={`flowsheetEntryData classic-marker-breakpoint ${fontSizeClass}`.trim()}
      >
        <EmptyGripCell />
        <td colSpan={5} align="center">
          {formatShortTime(entry.time)} breakpoint
        </td>
        <td>&nbsp;</td>
      </tr>
    );
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return (
      <tr
        className={`flowsheetEntryData classic-marker-breakpoint ${fontSizeClass}`.trim()}
      >
        <EmptyGripCell />
        <td colSpan={5} align="center">
          Start of show — {entry.dj_name} @ {formatShortDate(entry.day)}{" "}
          {formatShortTime(entry.time)}
        </td>
        <td>&nbsp;</td>
      </tr>
    );
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return (
      <tr
        className={`flowsheetEntryData classic-marker-breakpoint ${fontSizeClass}`.trim()}
      >
        <EmptyGripCell />
        <td colSpan={5} align="center">
          End of show — {entry.dj_name} @ {formatShortDate(entry.day)}{" "}
          {formatShortTime(entry.time)}
        </td>
        <td>&nbsp;</td>
      </tr>
    );
  }

  if (isFlowsheetSongEntry(entry)) {
    const hasComposer = false; // BMI composer info not in current type
    const capsules = capsulesForSongEntry(entry);
    // Segue indicator: render only when the row's `segue` flag is true AND the
    // next row in the table is also a song row. Tubafrenzy expresses the same
    // guard via `:has(+ tr.entry-row)`; Classic does it in JSX because the
    // adjacent non-song rows (talkset / breakpoint / start / end of show) are
    // structurally distinct.
    const showSegueBracket = entry.segue === true && nextIsSong === true;
    const trClassName = [
      "flowsheetEntryData",
      fontSizeClass,
      showSegueBracket ? "classic-segue" : "",
      isDragging ? "dragging" : "",
      isDragOver ? "drag-over" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const dataSegue = showSegueBracket ? "true" : undefined;

    return (
      <tr
        style={{ backgroundColor: "#F3F3F3" }}
        className={trClassName}
        data-segue={dataSegue}
        draggable={true}
        onDragStart={() => onDragStart?.(entry.id)}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver?.(entry.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop?.(entry.id);
        }}
        onDragEnd={() => onDragEnd?.()}
      >
        <GripCell />
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
