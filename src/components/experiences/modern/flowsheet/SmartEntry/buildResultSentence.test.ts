import { describe, it, expect } from "vitest";
import { buildResultSentence } from "./buildResultSentence";
import type { SmartField } from "./parser/types";

const values = {
  artist: "Stereolab",
  album: "Dots and Loops",
  label: "Duophonic",
};

const render = (order: SmartField[]) =>
  buildResultSentence(values, order)
    .map((p) => (p.connector ? `${p.connector} ${p.value}` : p.value))
    .join(" ");

describe("buildResultSentence", () => {
  it("leads album-first without a connector when the user typed the album first", () => {
    expect(render(["album", "artist"])).toBe(
      "Dots and Loops by Stereolab via Duophonic"
    );
  });

  it("keeps the 'by' connector when the artist leads", () => {
    expect(render(["artist", "album"])).toBe(
      "by Stereolab on Dots and Loops via Duophonic"
    );
  });

  it("appends fields not named in the order using the default order", () => {
    // Only album named → album leads, then artist/label appended by default.
    const parts = buildResultSentence(values, ["album"]);
    expect(parts.map((p) => p.field)).toEqual(["album", "artist", "label"]);
  });

  it("skips absent values", () => {
    const parts = buildResultSentence(
      { artist: "Jessica Pratt", label: "" },
      ["artist"]
    );
    expect(parts.map((p) => p.field)).toEqual(["artist"]);
    expect(parts[0]).toEqual({
      field: "artist",
      value: "Jessica Pratt",
      connector: "by",
    });
  });

  it("maps each field to its connector word", () => {
    const parts = buildResultSentence(
      { song: "Percolator", artist: "Stereolab", album: "Dots", label: "Duophonic" },
      ["song", "artist", "album", "label"]
    );
    expect(parts.map((p) => p.connector)).toEqual([null, "by", "on", "via"]);
  });

  it("dedupes a field repeated in the order hint", () => {
    const parts = buildResultSentence(values, ["album", "album", "artist"]);
    expect(parts.map((p) => p.field)).toEqual(["album", "artist", "label"]);
  });
});
