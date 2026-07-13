import { describe, it, expect } from "vitest";
import {
  formatTone,
  FORMAT_TONES,
  GENRE_TONES,
  ROTATION_TONES,
} from "@/lib/features/experiences/modern/tokens/roles";

describe("formatTone", () => {
  // `Format` is a cast string, not a closed union — the backend sends "cd",
  // "LP", "CD-R", etc. formatTone must never index-crash and always return a
  // valid tone (regression: ArtistAvatar crashed on FORMAT_TONES["cd"].color).
  it.each([
    ["Vinyl", FORMAT_TONES.Vinyl],
    ["vinyl", FORMAT_TONES.Vinyl],
    ["12\" Vinyl", FORMAT_TONES.Vinyl],
    ["CD", FORMAT_TONES.CD],
    ["cd", FORMAT_TONES.CD],
    ["CD-R", FORMAT_TONES.CD],
    ["Unknown", FORMAT_TONES.Unknown],
    ["LP", FORMAT_TONES.Unknown],
    ["", FORMAT_TONES.Unknown],
  ])("maps %s to the expected tone", (input, expected) => {
    expect(formatTone(input)).toEqual(expected);
  });

  it("handles null/undefined without throwing", () => {
    expect(formatTone(undefined)).toEqual(FORMAT_TONES.Unknown);
    expect(formatTone(null)).toEqual(FORMAT_TONES.Unknown);
  });
});

describe("role maps are exhaustive over their domains", () => {
  it("covers every genre and rotation bin", () => {
    // Compile-time exhaustiveness is enforced by Record<Genre|Rotation, Tone>;
    // spot-check a couple at runtime.
    expect(GENRE_TONES.Rock.color).toBe("primary");
    expect(GENRE_TONES.Unknown).toBeDefined();
    expect(ROTATION_TONES.H.color).toBe("primary");
    expect(ROTATION_TONES.S.color).toBe("neutral");
  });
});
