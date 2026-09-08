"use client";

import Link from "next/link";
import { useListArtistCrossReferencesQuery } from "@/lib/features/catalog/api";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import { CROSSREFERENCE_QUERY_MAX_LIMIT } from "@/lib/features/catalog/constants";
import { formatCallLettersAndNumbers } from "@/lib/features/catalog/libraryCode";
import { useAuthentication } from "@/src/hooks/authenticationHooks";

const CENTERED = { textAlign: "center" } as const;

/**
 * Xeroxed from `libraryAdmin/xrefsToLibraryCodes.jsp`: the whole
 * `artist_crossreference` collection, the "see also" pointers a librarian
 * filed from one artist card to another.
 *
 * Read-only, and not merely because the JSP offers no controls: the collection
 * is frozen at the tubafrenzy cutover by project decision, and Backend-Service
 * publishes no create, update or delete sibling to the listing this reads.
 * The screen exists so a set that survives nowhere else in the app can be
 * seen.
 *
 * Deliberate divergences from the JSP:
 *
 * - **No "Time Last Modified" column.** `artist_crossreference` has no
 *   timestamp column at all — not one the endpoint declines to serve, one that
 *   does not exist — so there is nothing to render and no migration should
 *   invent it. The JSP's fourth column is dropped rather than filled with a
 *   placeholder date that would read as fact.
 * - **The cross-referenced code carries no genre word.** The JSP renders
 *   `fullLibraryCode`, which prefixes the target's genre name; the endpoint
 *   serves the target's letters and artist number but not its genre, so the
 *   prefix has no input. `MO 12` still identifies the shelf section.
 * - **The title row spans the columns that exist.** The JSP hardcodes
 *   `colspan=5` over a four-column table, which HTML honours by stretching the
 *   header past the table.
 */
export default function ArtistCrossReferences() {
  // The bearer token resolves asynchronously; a request issued before the
  // session settles goes out unauthenticated and comes back 401, which this
  // screen would then have to present as an outage.
  const { authenticating, authenticated } = useAuthentication();

  const { data, isLoading, isUninitialized, isError } =
    useListArtistCrossReferencesQuery(
      { limit: CROSSREFERENCE_QUERY_MAX_LIMIT },
      { skip: authenticating || !authenticated },
    );

  if (isUninitialized || isLoading) {
    return <p className="text">Loading...</p>;
  }

  // Never the empty state: "there are no cross-references" is a positive claim
  // about a collection this screen is the only way to see, so a reader has
  // nothing to check it against. A genuinely empty collection answers 200.
  if (isError || !data) {
    return (
      <p role="alert" className="artist-error-message" style={CENTERED}>
        The library code cross-references could not be loaded.
      </p>
    );
  }

  const { results, total } = data;

  if (results.length === 0) {
    return (
      <table className="entry-table">
        <tbody>
          <tr className="entry-header">
            <th colSpan={3} style={CENTERED}>
              There are no Library Code Cross-References
            </th>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <>
      {total > results.length && (
        <p className="text">
          Showing the first {results.length} of {total} cross-references — the
          catalog API serves at most {CROSSREFERENCE_QUERY_MAX_LIMIT} rows per
          request.
        </p>
      )}
      <table className="entry-table">
        <thead>
          <tr className="entry-header">
            <th colSpan={3} style={CENTERED}>
              Cross-References to Library Codes
            </th>
          </tr>
          <tr className="entry-header">
            <th style={CENTERED}>Cross-Referencing Artist</th>
            <th style={CENTERED}>Cross-Referenced Library Code</th>
            <th style={CENTERED}>Comment</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row, index) => (
            <tr
              key={`${row.source_artist_id}-${row.target_artist_id}`}
              data-testid="artist-crossreference-row"
              className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
            >
              <td style={CENTERED}>
                {/* The endpoint serves no `code_letters` for the referencing
                    artist, so the bucket-versus-artist card choice cannot be
                    made here. The ordinary card redirects a bucket row to the
                    bucket card, which is the same landing place. */}
                <Link href={`/dashboard/library/artist/${row.source_artist_id}`}>
                  {row.source_artist_name}
                </Link>
              </td>
              <td style={CENTERED}>
                <Link
                  href={artistCardHref({
                    id: row.target_artist_id,
                    code_letters: row.target_code_letters,
                  })}
                >
                  {formatCallLettersAndNumbers({
                    code_letters: row.target_code_letters,
                    code_artist_number: row.target_code_artist_number,
                  })}
                </Link>
                &nbsp;-&nbsp;{row.target_artist_name}
              </td>
              <td style={CENTERED}>{row.comment ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
