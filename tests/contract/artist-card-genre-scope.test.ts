import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// `artistCardHref`'s genre argument is required so that omitting it is a type
// error — but `null` satisfies a required `number | null`, and that is how
// every link into the artist card except catalog search came to send no genre
// for months after the parameter landed. An unscoped card collapses a
// multi-genre artist onto its lowest `genre_id`, which for two acts sharing a
// name is a page showing a different band's records.
//
// So the type guard needs a companion that the type system cannot express:
// no call site may hard-code the collapse, and no screen may reach the card by
// hand-building its path and bypassing the builder altogether. Both halves are
// source facts, which makes them checkable here and nowhere else.
const SCAN_ROOTS = ["src", "app", "lib"];
// A hand-built path that ENDS at the artist id: the card root, the thing
// `artistCardHref` exists to build. The `/new`, `/view` and `/delete`
// sub-routes are different screens with their own builders, so the pattern
// stops at the closing brace or quote rather than matching any path that
// begins this way.
const HAND_BUILT_CARD_PATH = /\/dashboard\/library\/artist\/\$\{[^}]+\}\s*(?=[`"'?])/;

// Every file allowed to name the card path itself. Each entry is a decision
// with a reason, so a fourth arrival has to earn its place here rather than
// merge quietly; the two cross-reference columns are each also pinned by name
// in their own component suite.
const HAND_BUILT_BY_DESIGN = [
  // The builder itself.
  "lib/features/catalog/artistCardRoute.ts",
  // A V/A row that reached the ordinary card is bounced to the bucket card.
  // A bucket takes no genre in any case: it is a shelf SECTION spanning every
  // genre it holds records in, not a performer with one membership.
  "src/components/experiences/classic/catalog/VariousArtistsCard.tsx",
  // The cross-REFERENCING artist columns, whose rows carry two artist ids and
  // a call number for the TARGET only. The JSP rendered this column as a bare
  // presentation name with no call code, so there is no genre to name without
  // inventing a filing the record does not claim.
  "src/components/experiences/classic/library/ArtistCrossReferences.tsx",
  // Same column, and the one `genre_id` the row does carry belongs to the
  // cross-referenced RELEASE, filed under someone else — that difference is
  // the association the record exists to hold. Borrowing it would ask the card
  // for a shelf this artist need not be on, which answers 404.
  "src/components/experiences/classic/library/ReleaseCrossReferences.tsx",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Each `artistCardHref(...)` call's own text, by balanced parentheses. */
function artistCardHrefCalls(source: string): string[] {
  const calls: string[] = [];
  const opener = "artistCardHref(";
  let from = 0;
  for (;;) {
    const start = source.indexOf(opener, from);
    if (start === -1) return calls;
    let depth = 0;
    let end = start + opener.length - 1;
    for (; end < source.length; end += 1) {
      if (source[end] === "(") depth += 1;
      else if (source[end] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push(source.slice(start, end + 1));
    from = end + 1;
  }
}

const files = SCAN_ROOTS.flatMap((root) => sourceFiles(join(process.cwd(), root))).map((file) => ({
  path: relative(process.cwd(), file),
  source: readFileSync(file, "utf8"),
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
  // answer. A bare literal says the caller did not look.
  it("no call site hard-codes the unscoped card", () => {
    const offenders = files.flatMap(({ path, source }) =>
      artistCardHrefCalls(source)
        .filter((call) => /genreId:\s*null\s*[,}]/.test(call))
        .map(() => path),
    );

    expect(offenders).toEqual([]);
  });

  // The builder is where the genre decision is forced. A path assembled by
  // hand skips that entirely, which is how the two columns below came to link
  // unscoped without anything failing.
  it("no screen hand-builds the card path around the builder", () => {
    const offenders = files
      .filter(
        ({ path, source }) =>
          HAND_BUILT_CARD_PATH.test(source) && !HAND_BUILT_BY_DESIGN.includes(path),
      )
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});
