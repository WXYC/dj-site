"use client";

import Link from "next/link";
import {
  useGetGenresQuery,
  useListReleaseCrossReferencesQuery,
} from "@/lib/features/catalog/api";
import { CROSSREFERENCE_QUERY_MAX_LIMIT } from "@/lib/features/catalog/constants";
import {
  formatEntireLibraryCode,
  formatReleaseArtistTitle,
} from "@/lib/features/catalog/libraryCode";
import { useAuthentication } from "@/src/hooks/authenticationHooks";

const CENTERED = { textAlign: "center" } as const;

/**
 * Xeroxed from `libraryAdmin/xrefsToLibraryReleases.jsp`: the whole
 * `artist_library_crossreference` collection, the pointers a librarian filed
 * from an artist card to a specific release.
 *
 * Read-only for the same reason as its artist sibling — the collection is
 * frozen and Backend-Service publishes no write path — and with the same
 * dropped column: `artist_library_crossreference` carries no timestamp, so the
 * JSP's "Time Last Modified" has nothing behind it.
 *
 * Two further divergences:
 *
 * - **The column headings carry no hard line break.** The JSP splits three of
 *   them with `<br>` to narrow the columns; reproduced literally, the
 *   accessible name of each cell would run its two words together.
 * - **The title row spans the columns that exist**, rather than the JSP's
 *   hardcoded `colspan=5` over what is now a four-column table.
 *
 * Each row names two artists, and the difference between them is the whole
 * point of the record: the first column is the artist the cross-reference
 * hangs off, while the release named in the third is filed under someone else.
 */
export default function ReleaseCrossReferences() {
  const { authenticating, authenticated } = useAuthentication();

  const { data, isLoading, isUninitialized, isError } =
    useListReleaseCrossReferencesQuery(
      { limit: CROSSREFERENCE_QUERY_MAX_LIMIT },
      { skip: authenticating || !authenticated },
    );
  // The call number's genre word is resolved from the genres list, exactly as
  // the artist card's release table resolves it. `formatEntireLibraryCode`
  // drops the prefix while that list is in flight rather than withholding the
  // rest of a code a librarian can already act on.
  const { data: genres } = useGetGenresQuery();

  if (isUninitialized || isLoading) {
    return <p className="text">Loading...</p>;
  }

  if (isError || !data) {
    return (
      <p role="alert" className="artist-error-message" style={CENTERED}>
        The library release cross-references could not be loaded.
      </p>
    );
  }

  const { results, total } = data;

  if (results.length === 0) {
    return (
      <table className="entry-table">
        <tbody>
          <tr className="entry-header">
            <th colSpan={4} style={CENTERED}>
              There are no Library Release Cross-References
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
            <th colSpan={4} style={CENTERED}>
              Cross-References to Library Releases
            </th>
          </tr>
          <tr className="entry-header">
            <th style={CENTERED}>Cross-Referencing Artist</th>
            <th style={CENTERED}>Cross-Referenced Release Code</th>
            <th style={CENTERED}>Cross-Referenced Release Name</th>
            <th style={CENTERED}>Comment</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row, index) => {
            const releaseHref = `/dashboard/library/release/${row.library_id}`;
            return (
              <tr
                key={`${row.artist_id}-${row.library_id}`}
                data-testid="release-crossreference-row"
                className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
              >
                <td style={CENTERED}>
                  {/* As on the sibling screen, the referencing artist's
                      `code_letters` are not served, and the ordinary card
                      forwards a bucket row to the bucket card. */}
                  <Link href={`/dashboard/library/artist/${row.artist_id}`}>
                    {row.artist_name}
                  </Link>
                </td>
                <td style={CENTERED}>
                  <Link href={releaseHref}>
                    {formatEntireLibraryCode({
                      genreName: genres?.find((genre) => genre.id === row.genre_id)
                        ?.genre_name,
                      code_letters: row.code_letters,
                      code_artist_number: row.code_artist_number,
                      genre_id: row.genre_id,
                      code_number: row.code_number,
                      code_volume_letters: row.code_volume_letters,
                    })}
                  </Link>
                </td>
                <td>
                  <Link href={releaseHref}>
                    {formatReleaseArtistTitle(row)}
                    &nbsp;({row.format_name})
                  </Link>
                </td>
                <td style={CENTERED}>{row.comment ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
