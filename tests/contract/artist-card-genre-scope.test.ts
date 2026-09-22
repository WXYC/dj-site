import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { sourceFiles } from "@/tests/helpers/source-files";

// `artistCardHref`'s genre argument is required so that omitting it is a type
// error — but `null` satisfies a required `number | null`, and that is how
// every link into the artist card except catalog search came to send no genre
// for months after the parameter landed. An unscoped card collapses a
// multi-genre artist onto its lowest `genre_id`, which for two acts sharing a
// name is a page showing a different band's records.
//
// So the type guard needs a companion that the type system cannot express:
// no call site may hard-code the collapse, and no screen may reach the card
// around the builder. Both halves are source facts, checkable here and
// nowhere else.
const SCAN_ROOTS = ["src", "app", "lib"];

// The card path as a bare substring, deliberately broader than a route
// match: string concatenation, a hoisted prefix constant, and an aliased
// import all still have to spell this literal somewhere, so policing the
// substring is what an alias or a refactor cannot slip past. The cost is
// that legitimate sub-route builders (`/view`, `/new`, `/delete`) match
// too, so each allowed file below carries the reason it may hold the
// literal.
const CARD_PATH_LITERAL = "/dashboard/library/artist/";

const MAY_SPELL_THE_PATH: Record<string, string> = {
  "lib/features/catalog/artistCardRoute.ts": "the builder itself, plus the delete-screen href",
  "src/components/experiences/classic/catalog/SearchResults.tsx":
    "the read-only /view sub-route for non-modifying DJs; it appends the genre itself, mirroring the builder",
  "src/components/experiences/classic/catalog/ArtistSearchForm.tsx":
    "the /new create-form route, which is not the card",
  "src/components/experiences/classic/catalog/VariousArtistsCard.tsx":
    "bounces a V/A row that reached the ordinary card to the bucket card; a bucket takes no genre — it is a shelf SECTION spanning every genre it holds records in",
  "src/components/experiences/classic/library/ArtistCrossReferences.tsx":
    "the cross-REFERENCING artist column: the row carries two artist ids and a call number for the target only, and the JSP rendered this column as a bare name — there is no genre to name without inventing a filing the record does not claim",
  "src/components/experiences/classic/library/ReleaseCrossReferences.tsx":
    "same column, and the row's one genre_id belongs to the cross-referenced RELEASE, filed under someone else; borrowing it would ask the card for a shelf this artist need not be on, which answers 404",
};

// Each `artistCardHref(` occurrence paired with the first `genreId:` value
// after it — which is that call's own, since the argument is required and
// appears exactly once per call. Matching the VALUE token, not its
// surroundings, is what a paren counter cannot do reliably here: this
// codebase writes prose comments inside these calls, and one `)` in a
// comment would silently truncate a counted extraction before the value.
const CALL_GENRE_VALUES = /artistCardHref\([\s\S]*?genreId:\s*([A-Za-z0-9_.?[\]$]+|null)/g;

const files = sourceFiles(SCAN_ROOTS, /\.tsx?$/).map((path) => ({
  path,
  source: readFileSync(path, "utf8"),
}));

describe("every link into the artist card names a shelf (source contract)", () => {
  it("finds the call sites to check", () => {
    // A rename that empties the scan would make both assertions below pass
    // vacuously, which is the one way this guard can fail silently.
    const withCalls = files.filter(({ source }) => source.includes("artistCardHref("));
    expect(withCalls.length).toBeGreaterThan(5);
  });

  // `X ?? null` is a different statement from `null`: it says the read itself
  // can arrive without a genre, and the unscoped card is then the honest
  // answer. A bare literal — however it is punctuated or cast — says the
  // caller did not look.
  it("no call site hard-codes the unscoped card", () => {
    const offenders = files
      .filter(({ source }) =>
        [...source.matchAll(CALL_GENRE_VALUES)].some((match) => match[1] === "null"),
      )
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  // The builder is where the genre decision is forced; a path assembled by
  // hand skips it entirely, which is how both cross-reference columns came
  // to link unscoped without anything failing.
  it("no other file spells the card path", () => {
    const offenders = files
      .filter(
        ({ path, source }) =>
          source.includes(CARD_PATH_LITERAL) && !(path in MAY_SPELL_THE_PATH),
      )
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it("allows no stale entries in the path allowlist", () => {
    // An allowlisted file that no longer spells the literal is a rule with a
    // dead subject; retire the entry so the list stays exactly the set of
    // decisions in force.
    const stale = Object.keys(MAY_SPELL_THE_PATH).filter(
      (path) => !files.some((file) => file.path === path && file.source.includes(CARD_PATH_LITERAL)),
    );
    expect(stale).toEqual([]);
  });
});
