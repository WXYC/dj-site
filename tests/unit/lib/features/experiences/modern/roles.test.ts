import { describe, it, expect } from "vitest";
import {
  formatTone,
  FORMAT_TONES,
  genreTone,
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

describe("genreTone", () => {
  // GENRE_TONES is a presentation table, not the genre vocabulary. The
  // library's genre list is server-owned (GET /library/genres) and grows
  // without a dj-site deploy, so a genre with no designed color is normal and
  // must resolve to the neutral fallback rather than an undefined chip.
  it.each(["Africa", "Asia", "Comedy", "Latin", "Spoken", "Xmas"])(
    "resolves the untoned genre %s to the neutral fallback tone",
    (genre) => {
      expect(genreTone(genre)).toEqual(GENRE_TONES.Unknown);
    },
  );

  it("resolves a toned genre to its own tone", () => {
    expect(genreTone("Rock")).toEqual(GENRE_TONES.Rock);
  });

  it("handles null/undefined without throwing", () => {
    expect(genreTone(undefined)).toEqual(GENRE_TONES.Unknown);
    expect(genreTone(null)).toEqual(GENRE_TONES.Unknown);
  });

  // GENRE_TONES is deliberately NOT exhaustive over the library's genres — the
  // untoned ones share the neutral chip. Its keys are pinned because extending
  // the table is a visual-design decision (palette coherence, contrast, which
  // tones are already load-bearing elsewhere), not something to add in passing
  // alongside a data change.
  it("keeps the genre tone table to its designed keys", () => {
    expect(Object.keys(GENRE_TONES).sort()).toEqual(
      [
        "Blues",
        "Classical",
        "Electronic",
        "Hiphop",
        "Jazz",
        "OCS",
        "Reggae",
        "Rock",
        "Soundtracks",
        "Unknown",
      ].sort(),
    );
  });
});

describe("role maps are exhaustive over their domains", () => {
  it("covers every rotation bin", () => {
    // Compile-time exhaustiveness is enforced by Record<Rotation, Tone>;
    // spot-check a couple at runtime.
    expect(ROTATION_TONES.H.color).toBe("primary");
    expect(ROTATION_TONES.S.color).toBe("neutral");
  });
});
