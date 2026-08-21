"use client";

import Link from "next/link";
import {
  useGetArtistCardQuery,
  useGetArtistReleasesQuery,
  useGetGenresQuery,
} from "@/lib/features/catalog/api";
import {
  formatArtistCodeWithPunctuation,
  formatEntireLibraryCode,
} from "@/lib/features/catalog/libraryCode";

const RELEASES_PER_PAGE = 100;

/**
 * "View an Artist Card" — reproduces `lucene/artistCardDisplay.jsp`, the screen
 * a catalog result's artist name opens.
 *
 * Ungated, unlike the librarian's modify card. The JSP carries no role check
 * and catalog search is the DJ-facing screen, so a DJ who follows a result
 * row's artist must land on something they can read. The two screens are one
 * URL in the JSP, separated by `mode=view`; here they are two routes, because
 * the role gate is a property of the route.
 *
 * Divergences:
 *
 *  - **Cross-reference blocks omitted.** The JSP renders them below the release
 *    table, with each cross-referencing artist linking to another view card.
 *    Read-only cross-reference display is owned separately, for this screen and
 *    the modify card together.
 *  - **No sortable column headers.** The JSP's `libcodeHeader` / `titleHeader` /
 *    `formatHeader` ids drive a client-side sort the release endpoint does not
 *    expose an ordering parameter for.
 */
export default function ArtistCardView({ artistId }: { artistId: number }) {
  const { data: artist, isLoading, isError } = useGetArtistCardQuery(artistId);
  const { data: genres } = useGetGenresQuery();
  const { data: releaseData, isLoading: releasesLoading } = useGetArtistReleasesQuery({
    artistId,
    limit: RELEASES_PER_PAGE,
  });

  if (isLoading) {
    return (
      <div className="label" style={{ textAlign: "center" }}>
        Loading the artist card...
      </div>
    );
  }

  if (isError || !artist) {
    return (
      <div data-testid="artist-view-error" role="alert" className="artist-error-message">
        This artist card could not be loaded.
      </div>
    );
  }

  const genreName = genres?.find((genre) => genre.id === artist.genre_id)?.genre_name;
  const artistCode = formatArtistCodeWithPunctuation({
    code_letters: artist.code_letters,
    code_artist_number: artist.code_artist_number,
    genre_id: artist.genre_id,
  });
  const releases = releaseData?.releases ?? [];
  const total = releaseData?.total ?? 0;

  return (
    <div id="searchResultsPanel">
      <table className="entry-table" style={{ width: "100%" }}>
        <tbody>
          <tr className="entry-header">
            <th style={{ textAlign: "left" }} data-testid="artist-view-code">
              {genreName ? `${genreName} ` : ""}
              {artistCode.replace(/-$/, "")}
            </th>
            <th style={{ textAlign: "center" }}>{artist.artist_name}</th>
            <th style={{ textAlign: "right" }}># of releases: {total}</th>
          </tr>
        </tbody>
      </table>

      {releasesLoading ? (
        <div className="label" style={{ textAlign: "center" }}>
          Loading releases...
        </div>
      ) : total > 0 ? (
        <>
          <table className="entry-table" style={{ width: "100%" }}>
            <thead>
              <tr className="entry-header">
                <th style={{ textAlign: "left" }}>Library Code</th>
                <th style={{ textAlign: "left" }}>Artist</th>
                <th style={{ textAlign: "left" }}>Title of Release</th>
                <th style={{ textAlign: "left" }}>Format</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((release, index) => (
                <tr
                  key={release.id}
                  className={`entry-row ${
                    index % 2 === 0 ? "entry-row-even" : "entry-row-odd"
                  }`}
                >
                  <td>
                    {formatEntireLibraryCode({
                      genreName,
                      code_letters: release.code_letters,
                      code_artist_number: release.code_artist_number,
                      genre_id: release.genre_id,
                      code_number: release.code_number,
                      code_volume_letters: release.code_volume_letters,
                    })}
                  </td>
                  {/* The JSP prints the release's own artist string, which
                      differs from the card's artist on a compilation or an
                      alternate-artist row. */}
                  <td>{release.alternate_artist_name || artist.artist_name}</td>
                  <td>
                    <Link href={`/dashboard/library/release/${release.id}`}>
                      {release.album_title}
                    </Link>
                  </td>
                  <td>{release.format_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > releases.length ? (
            <div className="live-results-status">
              Showing the first {releases.length} of {total}.
            </div>
          ) : null}
        </>
      ) : (
        <div style={{ textAlign: "center" }}>
          The artist does not have any library releases.
        </div>
      )}
    </div>
  );
}
