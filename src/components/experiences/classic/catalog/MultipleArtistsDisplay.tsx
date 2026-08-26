"use client";

import Link from "next/link";
import { formatCallLettersAndNumbers } from "@/lib/features/catalog/libraryCode";
import type { ArtistByCodeOwner } from "@/lib/features/catalog/types";

type MultipleArtistsDisplayProps = {
  genreName: string | undefined;
  codeLetters: string;
  codeNumber: number;
  artists: ArtistByCodeOwner[];
  /** Returns to the chooser -- `multipleArtistsDisplay.jsp`'s "Choose/Add Library Codes" link. */
  onChooseAgain: () => void;
};

/**
 * Reproduces `libraryAdmin/multipleArtistsDisplay.jsp`: every artist that
 * owns the searched `(genre_id, code_letters, code_number)` triple, in the
 * order `resolveArtistByCode` returned them (server-sorted by artist name,
 * then id -- this component does not re-sort).
 *
 * Reached only from `ArtistSearchForm`'s code search matching more than one
 * owner, which the JSP frames differently but the underlying data makes the
 * same screen necessary either way: Backend-Service's catalog import
 * collapses every Various Artists sub-bucket to the identical `V/A`/0 pair
 * within a genre, so a librarian resolving a compilation code is routed here
 * to pick the specific bucket by name -- `V/A`/12/0 alone has 27 owners in
 * production (see `libraryCodeResolution.ts`).
 *
 * The JSP's "no results" branch is not reproduced: `resolveArtistByCode`
 * never answers a 200 with zero owners (see the endpoint's doc), so it is
 * unreachable here.
 *
 * Selection affordance matches the JSP exactly: each artist name links to
 * its *view* card (`mode=view` in the JSP, `/dashboard/library/artist/:id/view`
 * here), not the MD modify card a single-match code search lands on --
 * `multipleArtistsDisplay.jsp` sends every row through the DJ-facing display
 * card regardless of who is browsing it.
 */
export default function MultipleArtistsDisplay({
  genreName,
  codeLetters,
  codeNumber,
  artists,
  onChooseAgain,
}: MultipleArtistsDisplayProps) {
  const callLettersAndNumbers = formatCallLettersAndNumbers({
    code_letters: codeLetters,
    code_artist_number: codeNumber,
  });

  return (
    <div data-testid="multiple-artists-display" style={{ textAlign: "center" }}>
      <button
        type="button"
        onClick={onChooseAgain}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          fontWeight: "bold",
          textDecoration: "underline",
          cursor: "pointer",
          color: "inherit",
        }}
      >
        Choose/Add Library Codes
      </button>

      <h3>
        {genreName ? `${genreName} ` : ""}
        {callLettersAndNumbers}
      </h3>

      <table className="entry-table" style={{ width: "95%", margin: "0 auto" }}>
        <thead>
          <tr className="entry-header">
            <th colSpan={2} style={{ textAlign: "center" }}>
              Library Code
            </th>
            <th style={{ textAlign: "left" }}>Artist Name</th>
          </tr>
        </thead>
        <tbody>
          {artists.map((artist, index) => (
            <tr
              key={artist.id}
              className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
            >
              <td style={{ textAlign: "right" }}>{genreName ?? ""}</td>
              <td style={{ textAlign: "left" }}>
                {formatCallLettersAndNumbers({
                  code_letters: artist.code_letters,
                  code_artist_number: artist.code_number,
                })}
              </td>
              <td>
                <Link href={`/dashboard/library/artist/${artist.id}/view`}>
                  {artist.artist_name}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
