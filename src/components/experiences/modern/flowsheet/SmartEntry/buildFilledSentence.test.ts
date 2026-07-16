import { describe, it, expect } from "vitest";
import { parseSmartEntry } from "./parser/parseSmartEntry";
import { buildFilledSentence } from "./buildFilledSentence";

describe("buildFilledSentence", () => {
  it("builds a full sentence keeping the song leading", () => {
    const { raw, locks } = buildFilledSentence("Percolator", {
      artist: "Stereolab",
      album: "Dots and Loops",
      label: "Duophonic",
    });
    expect(raw).toBe("Percolator by Stereolab on Dots and Loops via Duophonic");
    expect(locks).toEqual({
      artist: "Stereolab",
      album: "Dots and Loops",
      label: "Duophonic",
    });
  });

  it("parses back to the same fields (connectors stay active)", () => {
    const { raw, suppress } = buildFilledSentence("Percolator", {
      artist: "Stereolab",
      album: "Dots and Loops",
    });
    const parse = parseSmartEntry(raw, { suppressedTriggers: suppress });
    expect(parse.fields).toMatchObject({
      song: "Percolator",
      artist: "Stereolab",
      album: "Dots and Loops",
    });
  });

  it("omits absent fields and their connectors", () => {
    const { raw, locks } = buildFilledSentence("Percolator", {
      artist: "Stereolab",
    });
    expect(raw).toBe("Percolator by Stereolab");
    expect(locks).toEqual({ artist: "Stereolab" });
  });

  it("suppresses trigger words inside filled values, keeping them whole", () => {
    // Album "Songs With Strangers" must not split on the inner "With".
    const { raw, suppress } = buildFilledSentence("Track", {
      artist: "Alpha",
      album: "Songs With Strangers",
    });
    const parse = parseSmartEntry(raw, { suppressedTriggers: suppress });
    expect(parse.fields.album).toBe("Songs With Strangers");
    expect(parse.fields.label).toBeUndefined();
  });

  it("suppresses a trigger word inside the user's song too", () => {
    // "Stand by Me" — the inner "by" must not become an artist trigger.
    const { raw, suppress } = buildFilledSentence("Stand by Me", {
      artist: "Otis Redding",
    });
    const parse = parseSmartEntry(raw, { suppressedTriggers: suppress });
    expect(parse.fields.song).toBe("Stand by Me");
    expect(parse.fields.artist).toBe("Otis Redding");
  });

  it("returns empty for an empty song and no fields", () => {
    expect(buildFilledSentence("", {})).toEqual({
      raw: "",
      locks: {},
      suppress: [],
    });
  });
});
