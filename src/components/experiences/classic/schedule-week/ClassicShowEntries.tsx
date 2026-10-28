"use client";

import type { FlowsheetRangeShow } from "@wxyc/shared";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import EditableShowTable, {
  ShowTable,
} from "@/src/components/experiences/classic/playlists/EditableShowTable";
import "@/src/styles/classic/wxyc.css";
import "@/src/styles/classic/schedule-week.css";

export default function ClassicShowEntries({
  show,
  entries,
  isPartial,
  partialEdge,
  isLoading,
  highlightedEntryId = null,
  subtitle = null,
  editable = false,
}: {
  show: FlowsheetRangeShow;
  entries: FlowsheetRangeEntryWire[];
  isPartial: boolean;
  partialEdge: "before" | "after" | null;
  isLoading: boolean;
  /**
   * The playcut an archive link named. It alone carries the anchor the link's
   * fragment points at; an id on every row would collide across tables.
   */
  highlightedEntryId?: number | null;
  /** The airing's own name, drawn beneath the program name when it adds something. */
  subtitle?: string | null;
  /**
   * The rows offer edit, delete and reorder; the caller supplies what those do.
   * The columns are the same either way, only the controls differ.
   */
  editable?: boolean;
}) {
  return (
    <div className="classic-schedule-week-entries">
      <h3 className="bigblue">
        {show.show_name ?? show.dj_name ?? "Unattributed show"}
      </h3>
      {subtitle && (
        <p
          className="subtitle redlabel"
          data-testid="classic-show-subtitle"
          style={{ textAlign: "center" }}
        >
          {subtitle}
        </p>
      )}

      {isLoading && <p className="text">Loading…</p>}

      {isPartial && (
        <p className="redlabel">
          Showing the {entries.length} entries logged during this week. This
          show{" "}
          {partialEdge === "after"
            ? "ran past the end of the week, and the rest are in the next week."
            : "began before the week started, and the rest are in the previous week."}
        </p>
      )}

      {!isLoading && entries.length === 0 && (
        <p className="text">No entries recorded for this show.</p>
      )}

      {entries.length > 0 &&
        (editable ? (
          <EditableShowTable
            entries={entries}
            highlightedEntryId={highlightedEntryId}
          />
        ) : (
          <ShowTable entries={entries} highlightedEntryId={highlightedEntryId} />
        ))}
    </div>
  );
}
