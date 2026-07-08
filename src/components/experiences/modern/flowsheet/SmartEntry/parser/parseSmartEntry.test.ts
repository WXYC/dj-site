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

describe("parseSmartEntry — trigger mode", () => {
  it("empty input yields no fields", () => {
    const r = parseSmartEntry("");
    expect(r.mode).toBe("trigger");
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

  it("treats 'off' as an explicit song trigger when there is no leading text", () => {
    const r = parseSmartEntry("off Percolator by Stereolab");
    expect(r.fields).toEqual({ song: "Percolator", artist: "Stereolab" });
    expect(r.fieldOrder).toEqual<SmartField[]>(["song", "artist"]);
  });

  it("maps 'in' to album and 'with' to label", () => {
    const r = parseSmartEntry("Song in Album with Label");
    expect(r.fields).toEqual({
      song: "Song",
      album: "Album",
      label: "Label",
    });
  });

  it("maps 'from' to album", () => {
    const r = parseSmartEntry("Percolator by Stereolab from Dots and Loops");
    expect(r.fields).toEqual({
      song: "Percolator",
      artist: "Stereolab",
      album: "Dots and Loops",
    });
    expect(r.fieldOrder).toEqual<SmartField[]>(["song", "artist", "album"]);
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

describe("parseSmartEntry — semicolon mode", () => {
  it("fills default order song → artist → album → label", () => {
    const r = parseSmartEntry(
      "Track 1; Shape Fixture Artist Alpha; Shape Fixture Album Alpha 2; Fixture Records"
    );
    expect(r.mode).toBe("semicolon");
    expect(r.fields).toEqual({
      song: "Track 1",
      artist: "Shape Fixture Artist Alpha",
      album: "Shape Fixture Album Alpha 2",
      label: "Fixture Records",
    });
    expect(r.fieldOrder).toEqual<SmartField[]>([
      "song",
      "artist",
      "album",
      "label",
    ]);
  });

  it("supports a partial prefix of the default order", () => {
    const r = parseSmartEntry("Track 1; Jessica Pratt");
    expect(r.fields).toEqual({ song: "Track 1", artist: "Jessica Pratt" });
    expect(r.fieldOrder).toEqual<SmartField[]>(["song", "artist"]);
  });

  it("parses the first segment with the full trigger grammar (hybrid)", () => {
    const r = parseSmartEntry("Halleluhwah by Can; Tago Mago");
    expect(r.fields).toEqual({
      song: "Halleluhwah",
      artist: "Can",
      album: "Tago Mago",
    });
    expect(r.fieldOrder).toEqual<SmartField[]>(["song", "artist", "album"]);
  });

  it("treats trigger words in later segments as literal", () => {
    const r = parseSmartEntry("Track 1; Standing on the Corner");
    expect(r.fields).toEqual({
      song: "Track 1",
      artist: "Standing on the Corner",
    });
  });

  it("ignores a trailing empty segment", () => {
    const r = parseSmartEntry("Track 1;");
    expect(r.fields).toEqual({ song: "Track 1" });
    expect(r.fieldOrder).toEqual<SmartField[]>(["song"]);
  });

  it("keeps spans ordered by start offset", () => {
    const raw = "Track 1; Jessica Pratt; On Your Own Love Again";
    const r = parseSmartEntry(raw);
    const starts = r.spans.map((s) => s.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (const span of r.spans) {
      expect(raw.slice(span.start, span.end)).toBe(r.fields[span.field]);
    }
  });
});
