import { describe, it, expect } from "vitest";
import { v2ToRangeShape } from "@/lib/features/show-playlist/wire";
import type { ShowPlaylistEntryWire } from "@/lib/features/show-playlist/types";
import { RotationBin } from "@/lib/features/rotation/types";

const wireEntry = (
  over: Partial<ShowPlaylistEntryWire> = {}
): ShowPlaylistEntryWire => ({
  id: 3001,
  show_id: 1951179,
  play_order: 1,
  add_time: "2026-08-22T21:00:00.000Z",
  entry_type: "track",
  artist_name: "Juana Molina",
  track_title: "la paradoja",
  album_title: "DOGA",
  record_label: "Sonamos",
  ...over,
});

describe("v2ToRangeShape", () => {
  it("carries the rotation bin through under the wire's own name", () => {
    expect(v2ToRangeShape(wireEntry({ rotation_bin: RotationBin.H })).rotation_bin).toBe(
      RotationBin.H
    );
  });

  it("carries a false on_streaming through", () => {
    expect(v2ToRangeShape(wireEntry({ on_streaming: false })).on_streaming).toBe(false);
  });

  // Null is "no linked library row", which is a different claim from "not on
  // streaming"; collapsing it to false would badge unlinked plays EXCLUSIVE.
  it("keeps a null on_streaming distinct from false", () => {
    expect(v2ToRangeShape(wireEntry({ on_streaming: null })).on_streaming).toBeNull();
  });

  it("leaves on_streaming absent when the wire omits it", () => {
    expect(v2ToRangeShape(wireEntry()).on_streaming).toBeUndefined();
  });

  // Only the track variant emits request_flag, and the flat shape requires it.
  it("defaults request_flag on a marker row", () => {
    expect(
      v2ToRangeShape(wireEntry({ entry_type: "talkset", message: "TALKSET" })).request_flag
    ).toBe(false);
  });

  it("drops a null album_id or rotation_id rather than passing it on", () => {
    const converted = v2ToRangeShape(
      wireEntry({ album_id: null, rotation_id: null })
    );
    expect(converted.album_id).toBeUndefined();
    expect(converted.rotation_id).toBeUndefined();
  });

  it("keeps a numeric album_id and rotation_id", () => {
    const converted = v2ToRangeShape(wireEntry({ album_id: 1001, rotation_id: 5001 }));
    expect(converted.album_id).toBe(1001);
    expect(converted.rotation_id).toBe(5001);
  });
});
