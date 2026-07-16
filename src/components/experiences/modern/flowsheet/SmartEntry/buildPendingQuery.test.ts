import { describe, it, expect } from "vitest";
import { createTestFlowsheetQuery } from "@/lib/test-utils";
import type { SelectedMatch } from "@/lib/features/flowsheet/types";
import { buildPendingQuery, selectedMatchApplies } from "./buildPendingQuery";

const match: SelectedMatch = {
  id: 4201,
  album_id: 4201,
  rotation_id: 12,
  rotation_bin: "H",
  artist: "Stereolab",
  album: "Dots and Loops",
  label: "Duophonic",
};

const query = (overrides = {}) =>
  createTestFlowsheetQuery({
    song: "Percolator",
    artist: "",
    album: "",
    label: "",
    album_id: undefined,
    rotation_id: undefined,
    rotation_bin: undefined,
    track_position: undefined,
    ...overrides,
  });

describe("selectedMatchApplies", () => {
  it("applies when typed fields are empty", () => {
    expect(selectedMatchApplies(query(), match)).toBe(true);
  });

  it("applies when typed artist is a prefix of the match (case-insensitive)", () => {
    expect(selectedMatchApplies(query({ artist: "stereo" }), match)).toBe(true);
  });

  it("does not apply once the typed artist diverges from the match", () => {
    expect(selectedMatchApplies(query({ artist: "Stereolen" }), match)).toBe(
      false
    );
  });

  it("does not apply when the typed album diverges", () => {
    expect(
      selectedMatchApplies(query({ artist: "Stereo", album: "Wrong" }), match)
    ).toBe(false);
  });
});

describe("buildPendingQuery", () => {
  it("returns the query unchanged when there is no selected match", () => {
    const q = query({ artist: "Typed Artist" });
    expect(buildPendingQuery(q, null)).toEqual(q);
  });

  it("keeps the song user-authored and snaps artist/album to the match", () => {
    const result = buildPendingQuery(query({ artist: "stereo" }), match);
    expect(result.song).toBe("Percolator");
    expect(result.artist).toBe("Stereolab");
    expect(result.album).toBe("Dots and Loops");
  });

  it("carries the match's album/rotation linkage", () => {
    const result = buildPendingQuery(query(), match);
    expect(result.album_id).toBe(4201);
    expect(result.rotation_id).toBe(12);
    expect(result.rotation_bin).toBe("H");
  });

  it("lets the user's typed label override the match's label", () => {
    const result = buildPendingQuery(query({ label: "Elektra" }), match);
    expect(result.label).toBe("Elektra");
  });

  it("falls back to the match's label when the user typed none", () => {
    const result = buildPendingQuery(query({ label: "" }), match);
    expect(result.label).toBe("Duophonic");
  });

  it("drops result-supplied values and linkage when the match no longer applies", () => {
    // Editing artist past the match's prefix must not clobber the typed text
    // and must drop the linkage (anti-clobber rule).
    const q = query({ artist: "Stereolen" });
    const result = buildPendingQuery(q, match);
    expect(result.artist).toBe("Stereolen");
    expect(result.album_id).toBeUndefined();
    expect(result.rotation_id).toBeUndefined();
  });

  it("preserves request/segue/track_position from the query", () => {
    const result = buildPendingQuery(
      query({ request: true, segue: true, track_position: "A1" }),
      match
    );
    expect(result.request).toBe(true);
    expect(result.segue).toBe(true);
    expect(result.track_position).toBe("A1");
  });
});
