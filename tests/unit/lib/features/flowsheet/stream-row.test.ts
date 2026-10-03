import { describe, it, expect } from "vitest";
import {
  toArchiveStreamRow,
  toArchiveStreamRowFromStreamEntry,
} from "@/lib/features/flowsheet/stream-row";
import { v2ToRangeShape } from "@/lib/features/show-playlist/wire";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import {
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
} from "@/lib/features/flowsheet/types";
import { createTestV2TrackEntry, V2_ENTRY_FACTORIES_BY_TYPE } from "@/tests/fixtures/fixtures";
import type { FlowsheetV2Entry } from "@wxyc/shared";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";

const ADD_TIME = "2026-01-15T20:01:00.000Z";
const RADIO_HOUR = "2026-01-15T20:00:00.000Z";

function contentOf(entry: FlowsheetEntry): string {
  if (isFlowsheetSongEntry(entry)) return entry.track_title;
  if (isFlowsheetStartShowEntry(entry) || isFlowsheetEndShowEntry(entry)) {
    return entry.dj_name;
  }
  return entry.message;
}

// Every `FlowsheetEntryType` member, built through the real V2 factories and
// the real conversion -- a hand-written `FlowsheetEntry` literal would pin a
// shape the conversion is supposed to produce rather than exercise it.
const cases: Array<[string, () => FlowsheetV2Entry, string]> = Object.values(
  FlowsheetEntryType
).map((entryType) => [
  entryType,
  () =>
    entryType === "breakpoint"
      ? V2_ENTRY_FACTORIES_BY_TYPE.breakpoint({
          add_time: ADD_TIME,
          radio_hour: RADIO_HOUR,
        })
      : V2_ENTRY_FACTORIES_BY_TYPE[entryType]({ add_time: ADD_TIME }),
  entryType === "breakpoint" ? "3:00 PM" : "3:01 PM",
]);

describe("toArchiveStreamRow", () => {
  it.each(cases)(
    "converts a %s stream entry to a row with content and the right Time label",
    (entryType, buildEntry, expectedTimeLabel) => {
      const row = toArchiveStreamRowFromStreamEntry(buildEntry());

      expect(row.entry.entry_type).toBe(entryType);
      expect(contentOf(row.entry)).not.toBe("");
      expect(row.timeLabel).toBe(expectedTimeLabel);
    },
  );

  it("carries the wire row's id and show id through", () => {
    const row = toArchiveStreamRow(
      v2ToRangeShape(createTestV2TrackEntry({ id: 42, show_id: 7 })),
    );

    expect(row.id).toBe(42);
    expect(row.showId).toBe(7);
  });

  it("reports a null show id for an unattributed entry", () => {
    const row = toArchiveStreamRow(
      v2ToRangeShape(createTestV2TrackEntry({ show_id: null })),
    );

    expect(row.showId).toBeNull();
  });
});
