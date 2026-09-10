import { describe, it, expect } from "vitest";
import {
  blankRow,
  classifySeed,
  compilationTrackCreditKey,
  isStoredKnown,
  rowFromSuggestion,
  toInput,
} from "@/lib/features/catalog/compilationTrackCredits";
import type { CompilationTrack, CompilationTrackInput } from "@/lib/features/catalog/types";

describe("compilationTrackCreditKey", () => {
  it("distinguishes an artist/title split that a plain-joined string would collide on", () => {
    const splitOne = compilationTrackCreditKey({
      artist_name: "Cat",
      track_title: "Power Ballad",
    });
    const splitTwo = compilationTrackCreditKey({
      artist_name: "Cat Power",
      track_title: "Ballad",
    });

    expect(splitOne).not.toBe(splitTwo);
  });

  it("trims both fields before keying, matching the server's dedupe on submission", () => {
    const untrimmed = compilationTrackCreditKey({
      artist_name: "  Jessica Pratt  ",
      track_title: "  Back, Baby  ",
    });
    const trimmed = compilationTrackCreditKey({
      artist_name: "Jessica Pratt",
      track_title: "Back, Baby",
    });

    expect(untrimmed).toBe(trimmed);
  });

  it("treats a null and a missing track_title identically", () => {
    const withNull = compilationTrackCreditKey({
      artist_name: "Chuquimamani-Condori",
      track_title: null,
    });
    const withUndefined = compilationTrackCreditKey({
      artist_name: "Chuquimamani-Condori",
    });

    expect(withNull).toBe(withUndefined);
  });

  // The server's uniqueness index covers artist and title together. A key that
  // dropped the artist would report a Discogs suggestion as already filed
  // because some other artist's track shares its title, and quietly refuse to
  // offer it.
  it("distinguishes two credits sharing a title but crediting different artists", () => {
    const one = compilationTrackCreditKey({
      artist_name: "Juana Molina",
      track_title: "Back, Baby",
    });
    const other = compilationTrackCreditKey({
      artist_name: "Jessica Pratt",
      track_title: "Back, Baby",
    });

    expect(one).not.toBe(other);
  });

  it("distinguishes two credits for the same artist with different titles", () => {
    const a = compilationTrackCreditKey({
      artist_name: "Stereolab",
      track_title: "Metronomic Underground",
    });
    const b = compilationTrackCreditKey({
      artist_name: "Stereolab",
      track_title: "Tone Burst",
    });

    expect(a).not.toBe(b);
  });
});

describe("draft row helpers", () => {
  it("gives each blank row a distinct key, so React never reuses one row's DOM for another", () => {
    const first = blankRow();
    const second = blankRow();

    expect(first.key).not.toBe(second.key);
    expect(first).toMatchObject({ artist_name: "", track_title: "", track_position: "" });
  });

  it("seeds a row from a suggestion, defaulting missing optional fields to empty strings", () => {
    const row = rowFromSuggestion({ artist_name: "Duke Ellington & John Coltrane", track_title: null });

    expect(row).toMatchObject({
      artist_name: "Duke Ellington & John Coltrane",
      track_title: "",
      track_position: "",
    });
  });

  it("converts a row back to an input, storing blank optional fields as NULL rather than empty strings", () => {
    const row = { key: 1, artist_name: "  Juana Molina  ", track_title: "  ", track_position: "" };

    expect(toInput(row)).toEqual({
      artist_name: "Juana Molina",
      track_title: null,
      track_position: null,
    });
  });
});

describe("isStoredKnown", () => {
  it("is unknown until the read has landed", () => {
    expect(isStoredKnown({ stored: undefined, storedError: false, storedFetching: false })).toBe(
      false,
    );
  });

  it("is unknown while the read has failed", () => {
    expect(isStoredKnown({ stored: undefined, storedError: true, storedFetching: false })).toBe(
      false,
    );
  });

  it("is unknown while a refetch is in flight, even with a prior payload still cached", () => {
    expect(
      isStoredKnown({ stored: { library_id: 53390, tracks: [] }, storedError: false, storedFetching: true }),
    ).toBe(false);
  });

  it("is known once the read has landed, succeeded, and settled", () => {
    expect(
      isStoredKnown({ stored: { library_id: 53390, tracks: [] }, storedError: false, storedFetching: false }),
    ).toBe(true);
  });
});

describe("classifySeed", () => {
  const stored = (tracks: Array<Omit<CompilationTrack, "id">>): CompilationTrack[] =>
    tracks.map((track, index) => ({ id: index + 1, ...track }));

  const suggestion = (
    artist_name: string,
    track_title: string | null = null,
  ): CompilationTrackInput => ({ artist_name, track_title });

  it("seeds from Discogs when it lists tracks not already on file", () => {
    const { seed, rows } = classifySeed(
      [suggestion("Chuquimamani-Condori", "Call Your Name"), suggestion("Jessica Pratt", "Back, Baby")],
      [],
    );

    expect(seed).toEqual({ kind: "discogs", importedCount: 2, alreadyFiledCount: 0 });
    expect(rows.map((row) => row.artist_name)).toEqual([
      "Chuquimamani-Condori",
      "Jessica Pratt",
    ]);
  });

  it("drops suggestions already on file from the seeded rows, without losing the count", () => {
    const { seed, rows } = classifySeed(
      [suggestion("Chuquimamani-Condori", "Call Your Name"), suggestion("Jessica Pratt", "Back, Baby")],
      stored([{ artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: null }]),
    );

    expect(seed).toEqual({ kind: "discogs", importedCount: 1, alreadyFiledCount: 1 });
    expect(rows.map((row) => row.artist_name)).toEqual(["Chuquimamani-Condori"]);
  });

  // The two editors used to compute this arm with different-but-equivalent
  // formulas: classic's `fresh.length === suggestions.tracks.length` and
  // modern's `alreadyFiledCount > 0`. Both are reached only once
  // `fresh.length === 0` (the "discogs" arm above handles every case where it
  // isn't), and at that point the two agree on every input: classic's "no
  // match" (`fresh.length === suggestions.length`) is exactly modern's
  // `alreadyFiledCount === 0`, i.e. `suggestions.length === 0`. This proves the
  // single surviving formula (`alreadyFiledCount > 0 ? "all-filed" :
  // "no-match"`) against both boundary cases.
  it("reports 'no-match' when Discogs listed nothing at all", () => {
    const { seed } = classifySeed([], []);

    expect(seed).toEqual({ kind: "manual", reason: "no-match" });
  });

  it("reports 'all-filed', not 'no-match', when Discogs matched only tracks already on file", () => {
    const { seed, rows } = classifySeed(
      [suggestion("Jessica Pratt", "Back, Baby")],
      stored([{ artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: null }]),
    );

    expect(seed).toEqual({ kind: "manual", reason: "all-filed" });
    // The sleeve may still hold a track Discogs missed.
    expect(rows).toHaveLength(1);
    expect(rows[0].artist_name).toBe("");
  });
});
