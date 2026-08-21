"use client";

import { useGetCompilationTracksQuery } from "@/lib/features/catalog/api";
import { useGetLibraryTracksQuery } from "@/lib/features/metadata/api";

type TracklistProps = {
  /** Backend's `library.id` — the key the per-track credit store is keyed by. */
  albumId: number;
  /**
   * The row's tubafrenzy `LIBRARY_RELEASE_ID`. A **different id space** from
   * `albumId`, and the only one the Discogs-backed tracks endpoint accepts:
   * it resolves the path param against `library.legacy_release_id`. The two
   * spaces are nearly coextensive, so passing the wrong one does not fail — it
   * returns a real but unrelated release's tracklist with a 200. `null` where
   * the row has no legacy id, in which case that source is skipped rather than
   * queried with a placeholder.
   */
  legacyReleaseId: number | null;
  /** True for a compilation, which is the only case with per-track artists. */
  variousArtists: boolean;
};

/**
 * Release tracklist, reproducing `tracklist.js`'s markup and copy.
 *
 * Two sources, because the legacy servlet's single endpoint has no single
 * equivalent here: per-track credits for a compilation are librarian-entered
 * and stored locally, while an ordinary release's tracklist is resolved
 * through Discogs. The compilation source is preferred when it has rows, since
 * it is the only one carrying a per-track artist — the column the legacy
 * renderer adds exactly when the release is various-artists and at least one
 * track names an artist.
 */
export default function Tracklist({
  albumId,
  legacyReleaseId,
  variousArtists,
}: TracklistProps) {
  const { data: compilation, isLoading: compilationLoading } =
    useGetCompilationTracksQuery({ libraryId: albumId }, { skip: !variousArtists });

  const { data: discogs, isLoading: discogsLoading } = useGetLibraryTracksQuery(
    legacyReleaseId as number,
    { skip: legacyReleaseId === null || legacyReleaseId <= 0 },
  );

  const compilationTracks = compilation?.tracks ?? [];
  const rows =
    compilationTracks.length > 0
      ? compilationTracks.map((track, index) => ({
          position: track.track_position ?? String(index + 1),
          artist: track.artist_name ?? "",
          title: track.track_title ?? "",
        }))
      : (discogs?.tracks ?? []).map((track, index) => ({
          position: track.position || String(index + 1),
          artist: track.artist_credit ?? "",
          title: track.title,
        }));

  if (compilationLoading || discogsLoading) {
    return (
      <div id="tracklistContainer">
        <p className="tracklist-loading">Loading tracklist...</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div id="tracklistContainer">
        <p className="tracklist-empty">No tracklist available.</p>
      </div>
    );
  }

  // The legacy renderer shows the artist column only when the release is
  // various-artists AND at least one track actually names an artist — a
  // compilation whose credits were never entered gets two columns, not a
  // column of blanks.
  const showArtist = variousArtists && rows.some((row) => !!row.artist);

  return (
    <div id="tracklistContainer">
      <table className="tracklist-table">
        <tbody>
          <tr className="tracklist-header">
            <th colSpan={showArtist ? 3 : 2}>Tracklist</th>
          </tr>
          {rows.map((row, index) => (
            <tr
              key={`${row.position}-${row.title}-${index}`}
              className={`tracklist-row ${
                index % 2 === 0 ? "tracklist-row-even" : "tracklist-row-odd"
              }`}
            >
              <td className="tracklist-pos">{row.position}</td>
              {showArtist ? <td>{row.artist}</td> : null}
              <td>{row.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
