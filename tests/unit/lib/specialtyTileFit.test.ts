import { describe, it, expect } from "vitest";
import {
  fitShortName,
  TILE_PADDING_FRACTION,
  GLYPH_WIDTH_EM,
  MIN_FONT_SIZE,
} from "@/lib/features/specialty/fitShortName";

// The nine programs Backend-Service migration 0201 seeds.
const SEEDED_SHORT_NAMES = [
  "Sunset Soundtrack",
  "Sunday Punk Radio",
  "Inside Track",
  "HyperLocal",
  "Story Hour",
  "OCS",
  "TNF",
  "NSE",
  "BYBBQ",
];

describe("fitShortName", () => {
  const cases = SEEDED_SHORT_NAMES.flatMap((name) =>
    [28, 40, 56, 96].map((size) => [name, size] as const),
  );

  // Names that cannot reach MIN_FONT_SIZE fall back to no text.
  const LONG_NAMES = ["Sunset Soundtrack", "Sunday Punk Radio", "HyperLocal"];
  const NO_TEXT: Record<number, string[]> = {
    28: [...LONG_NAMES, "Inside Track"],
    40: LONG_NAMES,
    56: [],
    96: [],
  };

  it.each(cases)("fits %s in a %ipx tile without clipping", (name, size) => {
    const { lines, fontSize } = fitShortName(name, size);
    if (NO_TEXT[size].includes(name)) {
      expect(lines).toEqual([]);
      expect(fontSize).toBe(0);
      return;
    }
    expect(fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
    const widest = Math.max(...lines.map((l) => l.length));
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.join(" ")).toBe(name);
    expect(widest * GLYPH_WIDTH_EM * fontSize).toBeLessThanOrEqual(
      size * (1 - 2 * TILE_PADDING_FRACTION) + 1e-6,
    );
    expect(fontSize).toBeLessThanOrEqual(size * 0.32);
  });

  it.each(SEEDED_SHORT_NAMES)("keeps %s legible at 56px", (name) => {
    expect(fitShortName(name, 56).lines.length).toBeGreaterThan(0);
  });

  it("breaks only on word boundaries, balancing the two lines", () => {
    expect(fitShortName("Sunset Soundtrack", 56).lines).toEqual([
      "Sunset",
      "Soundtrack",
    ]);
    expect(fitShortName("Sunday Punk Radio", 56).lines).toEqual([
      "Sunday",
      "Punk Radio",
    ]);
    expect(fitShortName("HyperLocal", 56).lines).toEqual(["HyperLocal"]);
  });

  it("keeps a short name at the full size when it already fits", () => {
    expect(fitShortName("TNF", 56).fontSize).toBeCloseTo(56 * 0.32);
  });
});
