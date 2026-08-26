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
 * then id -- this component does not re-sort). The JSP's own query carries no
 * `ORDER BY` at all, so a deterministic order is the one thing here that is
 * strictly better than the original rather than equal to it.
 *
 * Reached only from `ArtistSearchForm`'s code search matching more than one
 * owner, which the JSP frames differently but the underlying data makes the
 * same screen necessary either way: Backend-Service's catalog import collapses
 * every Various Artists sub-bucket to the identical `V/A`/0 pair within a
 * genre, so a librarian resolving a compilation code is routed here to pick
 * the specific bucket by name -- `V/A`/12/0 alone has 27 owners in production
 * (see `libraryCodeResolution.ts`).
 *
 * The JSP's "no results" branch is not reproduced: `resolveArtistByCode` never
 * answers a 200 with zero owners (see the endpoint's doc), and the caller
 * refuses a zero-length list rather than routing here, so it is unreachable.
 *
 * Every row displays the searched code rather than re-deriving one per owner.
 * The wire shape carries `code_letters`/`code_number` on each entry, but
 * Backend-Service projects both from the request, so they are the searched
 * values by construction -- sharing the triple is what makes these artists
 * collide at all.
 *
 * Selection affordance matches the JSP's real behavior, which its own markup
 * misstates: the row link carries `mode=view`, but `ArtistViewServlet` never
 * reads `mode` and forwards unconditionally to the modify card for an admin --
 * and only an admin can reach this screen, since `LibraryCodeServlet` bounces
 * everyone else to the DJ search. So each artist name opens the same modify
 * card a single-match code search lands on, not the read-only view card the
 * DJ-facing catalog results link to.
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
      <div style={{ width: "95%", margin: "0 auto" }}>
        {/* The JSP's header is a three-cell layout table, reproduced as one
            so the return link and the code sit on a line rather than
            stacking. Presentational: it carries no tabular data, and leaving
            it in the accessibility tree would announce a second table on a
            screen whose point is the one below. */}
        <table role="presentation" cellPadding={4} style={{ width: "100%", borderSpacing: 1 }}>
          <tbody>
            <tr>
              <td className="text" style={{ width: "33%", textAlign: "center" }}>
                <button type="button" className="link-button" onClick={onChooseAgain}>
                  <b>Choose/Add Library Codes</b>
                </button>
              </td>
              <td className="title" style={{ width: "34%", textAlign: "center" }}>
                {genreName ? `${genreName} ` : ""}
                {callLettersAndNumbers}
              </td>
              <td className="text" style={{ width: "33%", textAlign: "center" }} />
            </tr>
          </tbody>
        </table>

        <br />

        <table className="entry-table">
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
                <td style={{ textAlign: "left" }}>{callLettersAndNumbers}</td>
                <td>
                  <Link href={`/dashboard/library/artist/${artist.id}`}>{artist.artist_name}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
