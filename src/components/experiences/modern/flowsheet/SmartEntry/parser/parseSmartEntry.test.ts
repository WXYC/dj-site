import { describe, it, expect } from "vitest";
import { parseSmartEntry } from "./parseSmartEntry";
import type { SmartField } from "./types";

/** Offset of the nth (1-based) standalone occurrence of `word` in `raw`. */
function offsetOf(raw: string, word: string, nth = 1): number {
  const re = new RegExp(`(?<=^|\\s)${word}(?=\\s)`, "g");
  let count = 0;
  for (const m of raw.matchAll(re)) {
    if (++count === nth) return m.index ?? -1;
  }
  throw new Error(`"${word}" #${nth} not found in "${raw}"`);
}

describe("parseSmartEntry", () => {
  it("empty input yields no fields", () => {
    const r = parseSmartEntry("");
    expect(r.spans).toEqual([]);
    expect(r.fields).toEqual({});
    expect(r.fieldOrder).toEqual([]);
    expect(r.pendingTrigger).toBeUndefined();
  });

  it("leading text with no trigger is the song", () => {
    const r = parseSmartEntry("Vitamin C");
    expect(r.fields).toEqual({ song: "Vitamin C" });
    expect(r.fieldOrder).toEqual<SmartField[]>(["song"]);
  });

  it("parses a full trigger sentence in typed order", () => {
    const raw = "Vitamin C by Can on Ege Bamyasi via United Artists";
    const r = parseSmartEntry(raw);
    expect(r.fields).toEqual({
      song: "Vitamin C",
      artist: "Can",
      album: "Ege Bamyasi",
      label: "United Artists",
    });
    expect(r.fieldOrder).toEqual<SmartField[]>([
      "song",
      "artist",
      "album",
      "label",
    ]);
  });

  it("respects typed order for album-first input (no song)", () => {
    const r = parseSmartEntry("on Marquee Moon by Television");
    expect(r.fields).toEqual({ album: "Marquee Moon", artist: "Television" });
    expect(r.fieldOrder).toEqual<SmartField[]>(["album", "artist"]);
    expect(r.fields.song).toBeUndefined();
  });

  it("only by/on/via are triggers — off/in/from/with are literal text", () => {
    // 'off' is no longer a song trigger: it's part of the leading song text.
    expect(parseSmartEntry("off Percolator by Stereolab").fields).toEqual({
      song: "off Percolator",
      artist: "Stereolab",
    });
    // 'in', 'from', 'with' are ordinary words, not album/label triggers.
    expect(parseSmartEntry("Song in Album with Label").fields).toEqual({
      song: "Song in Album with Label",
    });
    expect(
      parseSmartEntry("Percolator by Stereolab from Dots and Loops").fields
    ).toEqual({
      song: "Percolator",
      artist: "Stereolab from Dots and Loops",
    });
  });

  it("treats a semicolon as ordinary literal text (not a separator)", () => {
    const r = parseSmartEntry("Track 1; Jessica Pratt");
    expect(r.fields).toEqual({ song: "Track 1; Jessica Pratt" });
    expect(r.fieldOrder).toEqual<SmartField[]>(["song"]);
  });

  it("first assignment wins — a repeated trigger is literal text", () => {
    const r = parseSmartEntry("Track by Alpha by Beta");
    expect(r.fields).toEqual({ song: "Track", artist: "Alpha by Beta" });
    expect(r.fieldOrder).toEqual<SmartField[]>(["song", "artist"]);
  });

  it("emits a pending trigger for a trailing trigger with no value", () => {
    const raw = "Vitamin C by ";
    const r = parseSmartEntry(raw);
    expect(r.fields).toEqual({ song: "Vitamin C" });
    expect(r.pendingTrigger).toEqual({
      field: "artist",
      start: offsetOf(raw, "by"),
      end: offsetOf(raw, "by") + 2,
    });
  });

  it("does not treat a just-typed trailing trigger (no space yet) as a trigger", () => {
    const r = parseSmartEntry("Vitamin C by");
    expect(r.fields).toEqual({ song: "Vitamin C by" });
    expect(r.pendingTrigger).toBeUndefined();
  });

  it("does not recognize a trigger substring inside a word", () => {
    expect(parseSmartEntry("Only Shallow").fields).toEqual({
      song: "Only Shallow",
    });
    expect(parseSmartEntry("Ison the radio").fields).toEqual({
      song: "Ison the radio",
    });
  });

  it("computes value span offsets that address the raw substring", () => {
    const raw = "Vitamin C by Can";
    const r = parseSmartEntry(raw);
    const artistSpan = r.spans.find((s) => s.field === "artist")!;
    expect(raw.slice(artistSpan.start, artistSpan.end)).toBe("Can");
    expect(artistSpan.triggerStart).toBe(offsetOf(raw, "by"));
  });

  describe("trigger suppression (Escape)", () => {
    it("treats a suppressed trigger as literal song text", () => {
      const raw = "Standing on the Corner";
      const on = offsetOf(raw, "on");
      expect(parseSmartEntry(raw).fields).toEqual({
        song: "Standing",
        album: "the Corner",
      });
      expect(
        parseSmartEntry(raw, { suppressedTriggers: [on] }).fields
      ).toEqual({ song: "Standing on the Corner" });
    });

    it("suppressing both ambiguous triggers keeps song and artist literal", () => {
      const raw = "Standing on the Corner by Standing on the Corner";
      const on1 = offsetOf(raw, "on", 1);
      const on2 = offsetOf(raw, "on", 2);
      const r = parseSmartEntry(raw, { suppressedTriggers: [on1, on2] });
      expect(r.fields).toEqual({
        song: "Standing on the Corner",
        artist: "Standing on the Corner",
      });
      expect(r.fieldOrder).toEqual<SmartField[]>(["song", "artist"]);
    });
  });
});
