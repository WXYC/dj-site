"use client";

import type { ArtistSearchMatch } from "@/lib/features/catalog/types";
import { artistShelfCode } from "@/lib/features/rotation/importSuggestions";

/**
 * `rotationReleaseImport.jsp`'s auto-search: the library artists whose names
 * match the rotation release's, each offering to file the release under its
 * shelf code.
 *
 * Library-wide, and one row per (artist, genre) membership: an artist filed in
 * two genres holds a different code number in each, so the genre is part of
 * what a librarian is choosing, not decoration beside it. The JSP's search is
 * library-wide too — the genre-scoped search this codebase already had backs a
 * different screen.
 */
export default function RotationImportArtistMatch({
  artistName,
  matches,
  isLoading,
  isError,
  onRetry,
  onSelect,
}: {
  artistName: string;
  matches: ArtistSearchMatch[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (match: ArtistSearchMatch) => void;
}) {
  if (isLoading) return <p style={{ textAlign: "center" }}>Loading...</p>;

  // A search that failed must never render as "no matching artists": the
  // librarian acts on that answer by creating a fresh library code, which is
  // how the duplicate this search exists to prevent gets filed.
  if (isError) {
    return (
      <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
        Artist search is unavailable, so the library can&apos;t be checked for{" "}
        &ldquo;{artistName}&rdquo; right now.{" "}
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </p>
    );
  }

  if (matches.length === 0) {
    return (
      <div style={{ textAlign: "center", margin: "20px 0 10px 0" }}>
        <span className="title">
          No matching artists found for &ldquo;{artistName}&rdquo;
        </span>
        <br />
        <span style={{ fontSize: "0.85em" }}>
          Create a new library code to catalog this release.
        </span>
      </div>
    );
  }

  return (
    <>
      <div style={{ textAlign: "center", margin: "20px 0 10px 0" }}>
        <span className="title">
          Matching artists in the library for &ldquo;{artistName}&rdquo;
        </span>
      </div>

      <table className="entry-table" style={{ maxWidth: 600, margin: "0 auto" }}>
        <thead>
          <tr className="entry-header">
            <th style={{ textAlign: "left" }}>Artist</th>
            <th style={{ textAlign: "left" }}>Library Code</th>
            <th style={{ textAlign: "center" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match, index) => (
            <tr
              key={`${match.id}:${match.genre_id ?? ""}`}
              className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
            >
              <td>{match.artist_name}</td>
              <td>{artistShelfCode(match)}</td>
              <td style={{ textAlign: "center" }}>
                <button
                  type="button"
                  className="link-button"
                  aria-label={`Select: ${match.artist_name}${match.genre_name ? ` (${match.genre_name})` : ""}`}
                  onClick={() => onSelect(match)}
                >
                  Select
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ textAlign: "center", marginTop: 15, fontSize: "0.9em" }}>
        Not the right artist? Create a new library code below.
      </p>
      <hr style={{ maxWidth: 600, margin: "15px auto" }} />
    </>
  );
}
