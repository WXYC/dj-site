import { describe, it, expect } from "vitest";
import {
  createTestV2BreakpointEntry,
  createTestV2TalksetEntry,
  createTestV2TrackEntry,
} from "@/tests/helpers";
import { v2ToRangeShape } from "@/lib/features/show-playlist/wire";
import { RotationBin } from "@/lib/features/rotation/types";

// Built through the repo's V2 factories, which are typed from the published
// union. That is the point of the exercise: a fixture hand-rolled from a local
// mirror of the payload asserts against its own spelling of the field names, so
// a rename upstream leaves this file green and the screen badge-less.
const play = (over: Parameters<typeof createTestV2TrackEntry>[0] = {}) =>
  createTestV2TrackEntry({
    id: 3001,
    show_id: 1951179,
    play_order: 1,
    add_time: "2026-08-22T21:00:00.000Z",
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
    record_label: "Sonamos",
    ...over,
  });

describe("v2ToRangeShape", () => {
  it("carries the rotation bin through under the wire's own name", () => {
    expect(v2ToRangeShape(play({ rotation_bin: RotationBin.H })).rotation_bin).toBe(
      RotationBin.H
    );
  });

  it("carries a false on_streaming through", () => {
    expect(v2ToRangeShape(play({ on_streaming: false })).on_streaming).toBe(
      false
    );
  });

  // Null is "no linked library row", which is a different claim from "not on
  // streaming"; collapsing it to false would badge unlinked plays EXCLUSIVE.
  it("keeps a null on_streaming distinct from false", () => {
    expect(v2ToRangeShape(play({ on_streaming: null })).on_streaming).toBeNull();
  });

  it("leaves on_streaming absent when the wire omits it", () => {
    expect(v2ToRangeShape(play()).on_streaming).toBeUndefined();
  });

  // Only the track variant emits request_flag, and the flat shape requires it.
  it("defaults request_flag on a marker row", () => {
    const marker = createTestV2TalksetEntry({ message: "TALKSET" });
    expect(v2ToRangeShape(marker).request_flag).toBe(false);
  });

  it("keeps a track's own request_flag rather than defaulting it", () => {
    expect(v2ToRangeShape(play({ request_flag: true })).request_flag).toBe(true);
  });

  it("drops a null album_id or rotation_id rather than passing it on", () => {
    const converted = v2ToRangeShape(
      play({ album_id: null, rotation_id: null })
    );
    expect(converted.album_id).toBeUndefined();
    expect(converted.rotation_id).toBeUndefined();
  });

  it("keeps a numeric album_id and rotation_id", () => {
    const converted = v2ToRangeShape(play({ album_id: 1001, rotation_id: 5001 }));
    expect(converted.album_id).toBe(1001);
    expect(converted.rotation_id).toBe(5001);
  });

  // The V2 track variant types these four nullable and `FlowsheetEntryFields`
  // does not, so a null has to become absence — the one of the two the flat
  // shape can hold, and the one every reader already treats identically.
  it.each([
    "artist_name",
    "album_title",
    "track_title",
    "record_label",
  ] as const)("drops a null %s rather than passing it on", (field) => {
    expect(v2ToRangeShape(play({ [field]: null }))[field]).toBeUndefined();
  });

  it.each([
    ["artist_name", "Jessica Pratt"],
    ["album_title", "On Your Own Love Again"],
    ["track_title", "Back, Baby"],
    ["record_label", "Drag City"],
  ] as const)("keeps a present %s", (field, value) => {
    expect(v2ToRangeShape(play({ [field]: value }))[field]).toBe(value);
  });

  // Only the breakpoint variant types `message` nullable.
  it("drops a breakpoint's null message rather than passing it on", () => {
    const converted = v2ToRangeShape(
      createTestV2BreakpointEntry({ message: null })
    );
    expect(converted.message).toBeUndefined();
    expect(converted.request_flag).toBe(false);
  });

  it("keeps a breakpoint's message and its radio_hour", () => {
    const converted = v2ToRangeShape(
      createTestV2BreakpointEntry({
        message: "--- 3:00 PM BREAKPOINT ---",
        radio_hour: "2026-08-22T22:00:00.000Z",
      })
    );
    expect(converted.message).toBe("--- 3:00 PM BREAKPOINT ---");
    expect(converted.radio_hour).toBe("2026-08-22T22:00:00.000Z");
  });

  // The entry-type vocabulary is server-owned and additive, so a build that
  // predates a new variant still has to render it. The cost of falling through
  // is not the row: this converter is mapped over a whole show into an array
  // typed as holding no undefined, and the callers dereference every element,
  // so one unconvertible entry takes the table down with it. Cast because the
  // variant does not exist in this build's union — which is the situation under
  // test, and the only way to reach the arm that a compile-time exhaustiveness
  // check cannot.
  it("converts an entry type this build has never seen as a marker", () => {
    const converted = v2ToRangeShape({
      ...createTestV2TalksetEntry(),
      entry_type: "promo_read",
    } as unknown as Parameters<typeof v2ToRangeShape>[0]);

    expect(converted).toBeDefined();
    expect(converted.id).toBe(createTestV2TalksetEntry().id);
    expect(converted.entry_type).toBe("promo_read");
    expect(converted.request_flag).toBe(false);
  });
});
