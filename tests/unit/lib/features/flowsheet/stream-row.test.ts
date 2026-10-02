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
import {
  createTestV2TrackEntry,
  createTestV2ShowStartEntry,
  createTestV2ShowEndEntry,
  createTestV2DJJoinEntry,
  createTestV2DJLeaveEntry,
  createTestV2TalksetEntry,
  createTestV2BreakpointEntry,
  createTestV2MessageEntry,
} from "@/tests/fixtures/fixtures";
import type { FlowsheetV2Entry } from "@wxyc/shared";

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
const cases: Array<[string, () => FlowsheetV2Entry, string]> = [
  ["track", () => createTestV2TrackEntry({ add_time: ADD_TIME }), "3:01 PM"],
  ["show_start", () => createTestV2ShowStartEntry({ add_time: ADD_TIME }), "3:01 PM"],
  ["show_end", () => createTestV2ShowEndEntry({ add_time: ADD_TIME }), "3:01 PM"],
  ["dj_join", () => createTestV2DJJoinEntry({ add_time: ADD_TIME }), "3:01 PM"],
  ["dj_leave", () => createTestV2DJLeaveEntry({ add_time: ADD_TIME }), "3:01 PM"],
  ["talkset", () => createTestV2TalksetEntry({ add_time: ADD_TIME }), "3:01 PM"],
  [
    "breakpoint",
    () => createTestV2BreakpointEntry({ add_time: ADD_TIME, radio_hour: RADIO_HOUR }),
    "3:00 PM",
  ],
  ["message", () => createTestV2MessageEntry({ add_time: ADD_TIME }), "3:01 PM"],
];

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
