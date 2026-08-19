import { describe, it, expect } from "vitest";
import {
  formatLabel,
  formatTone,
  FORMAT_TONES,
  genreTone,
  GENRE_TONES,
  ROTATION_TONES,
} from "@/lib/features/experiences/modern/tokens/roles";

describe("formatTone", () => {
  // Format is server-owned text, not a closed union — the shelf holds "cd",
  // "LP", "CD-R", '12" Vinyl', "Cassette". Resolution is deliberately fuzzy
  // (substring, case-insensitive) rather than exact-key: a format whose name
  // merely *contains* Vinyl or CD still earns the dedicated hue, and anything
  // else degrades to neutral instead of index-crashing.
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

  // FORMAT_TONES is a presentation table, not the format vocabulary, and it is
  // pinned so it is never mistaken for one: the two dedicated hues plus the
  // neutral fallback for a release with no format at all. Every other format
  // the station files under reaches a hue through the substring match above,
  // or degrades to the fallback.
  it("keeps the format tone table to its designed keys", () => {
    expect(Object.keys(FORMAT_TONES).sort()).toEqual(["CD", "Unknown", "Vinyl"]);
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
  // Case- and whitespace-insensitive, because the filter chips and the result
  // chips resolve through this one function and must agree on a genre however
  // the server cased it.
  it.each([
    ["rock", "Rock"],
    ["JAZZ", "Jazz"],
    ["  Blues  ", "Blues"],
  ])("resolves %s to the %s tone", (input, expected) => {
    expect(genreTone(input)).toEqual(
      GENRE_TONES[expected as keyof typeof GENRE_TONES]
    );
  });

  it("falls back to the Unknown tone for a genre with no designed color", () => {
    expect(genreTone("Not Real")).toEqual(GENRE_TONES.Unknown);
  });

  // A plain-object lookup answers Object.prototype members truthily, so this
  // input would otherwise resolve to a function and the caller would read
  // `.color` off it as undefined. Reachable: an MD creates a genre by typing
  // its name.
  it.each(["constructor", "__proto__"])(
    "resolves the inherited property name %s to the Unknown tone",
    (name) => {
      expect(genreTone(name)).toEqual(GENRE_TONES.Unknown);
    },
  );

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
      ],
    );
  });
});

describe("formatLabel", () => {
  // One label helper for every format chip in the modern experience. Two
  // helpers drift: a result row and a picker row showing the same release
  // must not disagree on its format, and the DJ has no way to tell which code
  // path drew which row.
  it.each([
    ["cd", "CD"],
    ["CD", "CD"],
    ["vinyl", "Vinyl"],
  ])("tidies the bare lowercase format %s to %s", (input, expected) => {
    expect(formatLabel(input)).toBe(expected);
  });

  // Anything already carrying casing or punctuation is a name the station
  // chose; title-casing it would render "Cd-r" and '12" vinyl'.
  it.each(["CD-R", "LP", '12" Vinyl', "7-inch Single", "Cassette", "Unknown"])(
    "preserves %s as sent",
    (format) => {
      expect(formatLabel(format)).toBe(format);
    },
  );

  it("leaves an empty format empty rather than inventing a placeholder", () => {
    expect(formatLabel("")).toBe("");
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
