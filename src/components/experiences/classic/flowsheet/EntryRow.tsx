"use client";

import {
  useState,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  FlowsheetEntry,
  isFlowsheetSongEntry,
  isFlowsheetTalksetEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
  UpdateRequestBody,
} from "@/lib/features/flowsheet/types";
import { flowsheetArtistRejection } from "@/lib/features/flowsheet/various-artists-guard";
import EntryActionMenu from "./EntryActionMenu";
import { entryAnchorId } from "@/lib/features/schedule-week/showUrl";
import { formatShortDate, formatShortTime } from "./marker-format";
import { messageEntryLabel } from "@/lib/features/flowsheet/marker-text";
import "@/src/styles/classic/segue.css";
import "@/src/styles/classic/drag.css";
import "@/src/styles/classic/actions.css";

type Props = {
  entry: FlowsheetEntry;
  onUpdate: (entryId: number, data: UpdateRequestBody) => void;
  onDelete: (entryId: number) => void;
  /** Tubafrenzy marks the row ABOVE a segue pair with data-segue="true" and
   *  draws the bracket down to the next row in CSS. EntryTable computes this
   *  from the FOLLOWING entry's segue flag and passes it here. */
  seguesIntoNext?: boolean;
  /** The playcut an archive link named; it alone carries the fragment anchor. */
  highlighted?: boolean;
  /** A past-show table's two extra leading columns, the Time cell and the
   *  indicator gutter; the live flowsheet passes none. Marker rows then span
   *  the gutter too, and a message row, which the live flowsheet leaves unlisted,
   *  is listed so the table never shows fewer rows than the read-only one. */
  leading?: { time: string; indicators: ReactNode };
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
  return <td className="grip-cell"></td>;
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
  seguesIntoNext,
  highlighted,
  leading,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
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
    // Classic has no queue — every row this edits is already posted, so the
    // artist is refused unconditionally, matching the flowsheet-write rule
    // in flowsheetArtistRejection. Checked before onUpdate, not inside it,
    // so a refusal leaves the row in edit mode for the same reason the
    // empty-track_title check above does.
    const rejection = flowsheetArtistRejection(trimmed.artist_name);
    if (rejection) {
      toast.error(rejection);
      return;
    }
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

  // Marker rows (talkset / breakpoint / start / end of show) colspan the 6
  // middle data columns (of 8: grip + playlist + req + artist + song +
  // release + label + action); the trailing action column gets its own cell.

  const timeCell = leading && (
    <td className="classic-schedule-week-time">{leading.time}</td>
  );
  const markerSpan = leading ? 7 : 6;
  // Any row can be the one an archive link named, not only a song.
  const anchor = highlighted ? { id: entryAnchorId(entry.id) } : {};
  const rowClasses = (...names: string[]) =>
    [...names, highlighted ? "playlistEntryHighlight" : ""]
      .filter(Boolean)
      .join(" ");

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
        {...anchor}
        className={rowClasses("flowsheetEntryData", "talkset-row", dragClass)}
        draggable={isDraggable}
        {...dragHandlers}
      >
        {isDraggable ? <GripCell /> : <EmptyGripCell />}
        {timeCell}
        <td colSpan={markerSpan} align="center">
          talkset
        </td>
        <td className="action-cell">
          <EntryActionMenu entryId={entry.id} onDelete={onDelete} />
        </td>
      </tr>
    );
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return (
      <tr
        {...anchor}
        className={rowClasses("flowsheetEntryData", "breakpoint-row")}
      >
        <EmptyGripCell />
        {timeCell}
        <td colSpan={markerSpan}>{formatShortTime(entry.time)}</td>
        <td className="action-cell"></td>
      </tr>
    );
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return (
      <tr
        {...anchor}
        className={rowClasses("flowsheetEntryData", "breakpoint-row")}
      >
        <EmptyGripCell />
        {timeCell}
        <td colSpan={markerSpan}>
          Start of show — {entry.dj_name} @ {formatShortDate(entry.day)}{" "}
          {formatShortTime(entry.time)}
        </td>
        <td className="action-cell"></td>
      </tr>
    );
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return (
      <tr
        {...anchor}
        className={rowClasses("flowsheetEntryData", "breakpoint-row")}
      >
        <EmptyGripCell />
        {timeCell}
        <td colSpan={markerSpan}>
          End of show — {entry.dj_name} @ {formatShortDate(entry.day)}{" "}
          {formatShortTime(entry.time)}
        </td>
        <td className="action-cell"></td>
      </tr>
    );
  }

  if (isFlowsheetSongEntry(entry)) {
    const trClassName = rowClasses(
      "flowsheetEntryData",
      "entry-row",
      dragClass,
    );
    const dataSegue = seguesIntoNext ? "true" : undefined;

    return (
      <tr
        {...anchor}
        className={trClassName}
        data-segue={dataSegue}
        draggable={isDraggable}
        {...dragHandlers}
      >
        {isDraggable ? <GripCell /> : <EmptyGripCell />}
        {timeCell}
        {leading && (
          <td className="classic-indicator-cell">{leading.indicators}</td>
        )}
        <td align="center">{entry.rotation ?? ""}</td>
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
          ) : entry.request_flag ? (
            "*"
          ) : (
            ""
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

  if (!leading) {
    return null;
  }

  // The guards above cover the type union, but a wire type this build does not
  // know converts to a bare message at runtime, so this arm is reachable.
  const message = entry as FlowsheetEntry;

  return (
    <tr
      {...anchor}
      className={rowClasses("flowsheetEntryData", "breakpoint-row")}
    >
      <EmptyGripCell />
      {timeCell}
      <td colSpan={markerSpan}>{messageEntryLabel(message)}</td>
      <td className="action-cell">
        <EntryActionMenu entryId={message.id} onDelete={onDelete} />
      </td>
    </tr>
  );
}
