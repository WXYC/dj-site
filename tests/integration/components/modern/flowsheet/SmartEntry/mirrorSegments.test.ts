import { describe, it, expect } from "vitest";
import { parseSmartEntry } from "@/src/components/experiences/modern/flowsheet/SmartEntry/parser/parseSmartEntry";
import { buildMirrorSegments } from "@/src/components/experiences/modern/flowsheet/SmartEntry/mirrorSegments";

/** The load-bearing invariant: segments reproduce raw exactly, in order. */
function expectCoversRaw(raw: string) {
  const parse = parseSmartEntry(raw);
  const segments = buildMirrorSegments(raw, parse.spans, parse.pendingTrigger);
  expect(segments.map((s) => s.text).join("")).toBe(raw);
}

describe("buildMirrorSegments", () => {
  it("reproduces raw exactly for plain text", () => {
    expectCoversRaw("Just a title");
  });

  it("reproduces raw exactly for a full trigger sentence", () => {
    expectCoversRaw("Vitamin C by Can on Ege Bamyasi via United Artists");
  });

  it("reproduces raw exactly for semicolon input", () => {
    expectCoversRaw("Track 1; Jessica Pratt; On Your Own Love Again; Drag City");
  });

  it("reproduces raw exactly with a trailing pending trigger", () => {
    expectCoversRaw("Vitamin C by ");
  });

  it("reproduces raw exactly with suppressed triggers", () => {
    const raw = "Standing on the Corner";
    const parse = parseSmartEntry(raw, { suppressedTriggers: [9] });
    const segments = buildMirrorSegments(raw, parse.spans, parse.pendingTrigger);
    expect(segments.map((s) => s.text).join("")).toBe(raw);
  });

  it("classifies trigger words, token values, and plain gaps", () => {
    const raw = "Percolator by Stereolab";
    const parse = parseSmartEntry(raw);
    const segments = buildMirrorSegments(raw, parse.spans, parse.pendingTrigger);

    expect(segments).toEqual([
      { text: "Percolator", kind: "token", field: "song", locked: false },
      { text: " ", kind: "plain" },
      { text: "by", kind: "trigger" },
      { text: " ", kind: "plain" },
      { text: "Stereolab", kind: "token", field: "artist", locked: false },
    ]);
  });

  it("marks a locked span as locked", () => {
    const raw = "by Stereolab";
    const parse = parseSmartEntry(raw);
    const spans = parse.spans.map((s) =>
      s.field === "artist" ? { ...s, source: "locked" as const } : s
    );
    const segments = buildMirrorSegments(raw, spans, parse.pendingTrigger);
    const token = segments.find((s) => s.kind === "token");
    expect(token?.locked).toBe(true);
  });
});
