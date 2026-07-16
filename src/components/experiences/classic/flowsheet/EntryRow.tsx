"use client";

import { useState, type DragEvent as ReactDragEvent } from "react";
import {
  FlowsheetEntry,
  isFlowsheetSongEntry,
  isFlowsheetTalksetEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
  UpdateRequestBody,
} from "@/lib/features/flowsheet/types";
import { Capsule, capsulesForSongEntry } from "./Capsule";
import EntryActionMenu from "./EntryActionMenu";
import { formatShortDate, formatShortTime } from "./marker-format";
import "@/src/styles/classic/segue.css";
import "@/src/styles/classic/markers.css";
import "@/src/styles/classic/drag.css";
import "@/src/styles/classic/actions.css";

type Props = {
  entry: FlowsheetEntry;
  onUpdate: (entryId: number, data: UpdateRequestBody) => void;
  onDelete: (entryId: number) => void;
  fontSize: number;
  /** Suppresses the segue indicator when the next row is a talkset,
   *  breakpoint, or show-block — those render full-width and would leave the
   *  red bracket dangling. EntryTable computes and passes this. */
  nextIsSong?: boolean;
  isDragging?: boolean;
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

type EditDraft = {
  artist_name: string;
  track_title: string;
  album_title: string;
  record_label: string;
  request_flag: boolean;
};

export default function EntryRow({
  entry,
  onUpdate,
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
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const isEditing = draft !== null;

  const beginEdit = () => {
    if (!isFlowsheetSongEntry(entry)) return;
    setDraft({
      artist_name: entry.artist_name ?? "",
      track_title: entry.track_title ?? "",
      album_title: entry.album_title ?? "",
      record_label: entry.record_label ?? "",
      request_flag: entry.request_flag ?? false,
    });
  };

  const cancelEdit = () => setDraft(null);

  const saveEdit = () => {
    if (!draft) return;
    const trimmed = {
      artist_name: draft.artist_name.trim(),
      track_title: draft.track_title.trim(),
      album_title: draft.album_title.trim(),
      record_label: draft.record_label.trim(),
    };
    if (!trimmed.track_title) return;
    onUpdate(entry.id, {
      ...trimmed,
      request_flag: draft.request_flag,
    });
    setDraft(null);
  };

  // Enter saves, Escape cancels — standard inline-edit keyboard ergonomics.
  // Without this, the inputs are mouse-only once Tab leaves them.
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Marker rows (talkset / breakpoint / start / end of show) colspan the 5
  // middle data columns (of 7: grip + indicators + artist + song + release +
  // label + edit); the trailing edit/delete column gets an empty cell.

  const dragClass = [
    isDragging ? "dragging" : "",
    isDragOver ? "drag-over" : "",
    isEditing ? "editing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // A row is only draggable when the parent wires up reorder handlers AND we're
  // not in edit mode. The previous-show <tbody> in EntryTable renders rows
  // without these, so they render with an empty grip cell and no drag
  // affordance — the visual matches the read-only intent.
  const isDraggable = Boolean(onDragStart) && !isEditing;
  const dragHandlers = isDraggable
    ? {
        onDragStart: () => onDragStart?.(entry.id),
        onDragOver: (e: ReactDragEvent) => {
          e.preventDefault();
          onDragOver?.(entry.id);
        },
        onDrop: (e: ReactDragEvent) => {
          e.preventDefault();
          onDrop?.(entry.id);
        },
        onDragEnd: () => onDragEnd?.(),
      }
    : {};

  if (isFlowsheetTalksetEntry(entry)) {
    return (
      <tr
        className={[
          "flowsheetEntryData",
          "classic-marker-talkset",
          fontSizeClass,
          dragClass,
        ]
          .filter(Boolean)
          .join(" ")}
        draggable={isDraggable}
        {...dragHandlers}
      >
        {isDraggable ? <GripCell /> : <EmptyGripCell />}
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
      dragClass,
    ]
      .filter(Boolean)
      .join(" ");
    const dataSegue = showSegueBracket ? "true" : undefined;

    return (
      <tr
        style={{ backgroundColor: "#F3F3F3" }}
        className={trClassName}
        data-segue={dataSegue}
        draggable={isDraggable}
        {...dragHandlers}
      >
        {isDraggable ? <GripCell /> : <EmptyGripCell />}
        <td align="center">
          {draft ? (
            <input
              type="checkbox"
              name="request_flag"
              aria-label="Listener request"
              checked={draft.request_flag}
              onChange={(e) =>
                setDraft({ ...draft, request_flag: e.target.checked })
              }
            />
          ) : (
            capsules.map((c) => (
              <Capsule key={c.variant} variant={c.variant} label={c.label} />
            ))
          )}
        </td>
        <td align="left">
          {draft ? (
            <input
              type="text"
              name="artist_name"
              className="inline-edit"
              value={draft.artist_name}
              onChange={(e) =>
                setDraft({ ...draft, artist_name: e.target.value })
              }
              onKeyDown={handleEditKeyDown}
            />
          ) : (
            entry.artist_name
          )}
        </td>
        <td align="left">
          {draft ? (
            <input
              type="text"
              name="track_title"
              className="inline-edit"
              value={draft.track_title}
              onChange={(e) =>
                setDraft({ ...draft, track_title: e.target.value })
              }
              onKeyDown={handleEditKeyDown}
            />
          ) : (
            entry.track_title
          )}
        </td>
        <td align="left">
          {draft ? (
            <input
              type="text"
              name="album_title"
              className="inline-edit"
              value={draft.album_title}
              onChange={(e) =>
                setDraft({ ...draft, album_title: e.target.value })
              }
              onKeyDown={handleEditKeyDown}
            />
          ) : (
            entry.album_title || ""
          )}
        </td>
        <td align="left">
          {draft ? (
            <input
              type="text"
              name="record_label"
              className="inline-edit"
              value={draft.record_label}
              onChange={(e) =>
                setDraft({ ...draft, record_label: e.target.value })
              }
              onKeyDown={handleEditKeyDown}
            />
          ) : (
            entry.record_label || ""
          )}
        </td>
        <td align="center" className="action-cell">
          {draft ? (
            <>
              <button
                type="button"
                className="action-save"
                aria-label="Save"
                title="Save"
                onClick={saveEdit}
              >
                {"✅"}
              </button>{" "}
              <button
                type="button"
                className="action-cancel"
                aria-label="Cancel"
                title="Cancel"
                onClick={cancelEdit}
              >
                {"🚫"}
              </button>
            </>
          ) : (
            <EntryActionMenu
              entryId={entry.id}
              onEdit={beginEdit}
              onDelete={onDelete}
            />
          )}
        </td>
      </tr>
    );
  }

  return null;
}
