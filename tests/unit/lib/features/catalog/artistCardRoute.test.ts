import { describe, it, expect } from "vitest";

import {
  artistCardHref,
  parseArtistCardGenreId,
} from "@/lib/features/catalog/artistCardRoute";

describe("artistCardHref", () => {
  it.each([
    ["Various Artists", "V/A"],
    ["Various Artists - Rock - A", "V/A"],
    ["Soundtracks - L", "V/A"],
    // The legacy spelling, for a row that predates or bypassed the catalog
    // import's rewrite.
    ["Various Artists - Rock - B", "Z-B"],
  ])("sends the compilation shelf row %j, filed under %j, to the bucket card", (
    _artistName,
    code_letters,
  ) => {
    expect(artistCardHref({ id: 4211, code_letters })).toBe(
      "/dashboard/library/various/4211",
    );
  });

  it.each([
    ["Juana Molina", "MOLI"],
    ["Stereolab", "STER"],
    // Keyword in the name, filed as an ordinary artist: the name must not
    // pull it onto the compilation shelf.
    ["The Soundtrack of Our Lives", "SOUN"],
    ["Various Production", "VARI"],
  ])("sends the ordinary artist %j, filed under %j, to the artist card", (
    _artistName,
    code_letters,
  ) => {
    expect(artistCardHref({ id: 4211, code_letters })).toBe(
      "/dashboard/library/artist/4211",
    );
  });
});

describe("artistCardHref genre scope", () => {
  // An artist id alone does not identify a card: `genre_artist_crossreference`
  // is unique on `(artist_id, genre_id)`, so artist 431 ('Isis') is `IS 1`
  // under Hiphop and `IS 13` under Rock -- two unrelated bands. A link that
  // knows which one it means says so.
  it("carries the genre so each membership gets its own card", () => {
    expect(artistCardHref({ id: 431, code_letters: "IS" }, { genreId: 11 })).toBe(
      "/dashboard/library/artist/431?genre_id=11",
    );
    expect(artistCardHref({ id: 431, code_letters: "IS" }, { genreId: 6 })).toBe(
      "/dashboard/library/artist/431?genre_id=6",
    );
  });

  // Every existing caller passes no genre and must keep producing the URL it
  // produced before -- an unscoped card is still a card, just the
  // lowest-membership collapse.
  it.each([
    ["omitted", undefined],
    ["null", null],
  ])("leaves the href unchanged when the genre is %s", (_label, genreId) => {
    expect(artistCardHref({ id: 4211, code_letters: "MOLI" }, { genreId })).toBe(
      "/dashboard/library/artist/4211",
    );
  });

  // A compilation bucket is a shelf section spanning many genres -- artist
  // 1087 ('Various Artists') is filed under 14 -- so scoping its card to one
  // would hide most of the section. The genre is dropped rather than honoured.
  it("drops the genre for a compilation bucket, which is not genre-scoped", () => {
    expect(artistCardHref({ id: 1087, code_letters: "V/A" }, { genreId: 11 })).toBe(
      "/dashboard/library/various/1087",
    );
  });
});

describe("artistCardHref extra query parameters", () => {
  // Three callers used to append their own `?created=1` / `?imported=...` to
  // this builder's return value. That was safe only while the builder never
  // emitted a query string of its own. Now that it can, appending yields
  // `?genre_id=11?created=1`, which `parseArtistCardGenreId` reads as
  // malformed and the route answers with `notFound()` -- a successful artist
  // create landing on a 404. Composition happens here, once.
  it("composes extra parameters alongside the genre", () => {
    expect(
      artistCardHref(
        { id: 431, code_letters: "IS" },
        { genreId: 11, params: { created: "1" } },
      ),
    ).toBe("/dashboard/library/artist/431?genre_id=11&created=1");
  });

  it("composes extra parameters when no genre is named", () => {
    expect(
      artistCardHref({ id: 4211, code_letters: "MOLI" }, { params: { created: "1" } }),
    ).toBe("/dashboard/library/artist/4211?created=1");
  });

  // A bucket takes no genre but still takes the confirmation flag: creating a
  // compilation row lands on the bucket card and has to say so.
  it("keeps extra parameters on a compilation bucket, which takes no genre", () => {
    expect(
      artistCardHref(
        { id: 1087, code_letters: "V/A" },
        { genreId: 11, params: { created: "1" } },
      ),
    ).toBe("/dashboard/library/various/1087?created=1");
  });

  // A volume letter can carry a space or a slash. The rotation import used to
  // hand-encode it before concatenating; the builder encodes now, so a
  // pre-encoded value would arrive double-encoded.
  it("encodes a parameter value exactly once", () => {
    expect(
      artistCardHref({ id: 431, code_letters: "IS" }, { params: { vol: "A/B C" } }),
    ).toBe("/dashboard/library/artist/431?vol=A%2FB+C");
  });

  it("accepts a numeric parameter value", () => {
    expect(
      artistCardHref({ id: 431, code_letters: "IS" }, { params: { imported: 5150 } }),
    ).toBe("/dashboard/library/artist/431?imported=5150");
  });
});

describe("parseArtistCardGenreId", () => {
  it("reads a genre back off the URL", () => {
    expect(parseArtistCardGenreId("11")).toBe(11);
  });

  // Absent is the unscoped card, not an error: every link built before this
  // parameter existed omits it.
  it("reports no genre for an absent parameter", () => {
    expect(parseArtistCardGenreId(undefined)).toBeUndefined();
  });

  // A repeated key names two conflicting memberships, and the backend answers
  // 400 for it. Taking the first would serve the Hiphop card for a URL that
  // also asked for Rock -- arriving at a card you did not ask for, silently,
  // which is the whole failure this parse exists to prevent. Malformed.
  it("rejects a repeated key rather than picking one of the two", () => {
    expect(parseArtistCardGenreId(["6", "11"])).toBeNull();
  });

  // One value in an array is not a conflict -- it is the same single genre the
  // string form carries.
  it("reads a single-element array as that genre", () => {
    expect(parseArtistCardGenreId(["11"])).toBe(11);
  });

  // Malformed is NOT silently treated as absent. Falling back to the unscoped
  // read would answer a broken link with the conflated card this parameter
  // exists to split -- the exact symptom, arrived at silently. `null` is the
  // caller's signal to `notFound()`, the same answer the page already gives a
  // non-numeric id.
  it.each([["blank", ""], ["non-numeric", "rock"], ["zero", "0"], ["negative", "-11"], ["fractional", "11.5"]])(
    "reports a %s genre as malformed rather than absent",
    (_label, raw) => {
      expect(parseArtistCardGenreId(raw)).toBeNull();
    },
  );
});
