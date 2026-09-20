"use client";

import Link from "next/link";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import { formatCallLettersAndNumbers } from "@/lib/features/catalog/libraryCode";
import type { MultiMatchResult } from "./ArtistSearchForm";

type MultipleArtistsDisplayProps = MultiMatchResult & {
  /** Returns to the chooser -- `multipleArtistsDisplay.jsp`'s "Choose/Add Library Codes" link. */
  onChooseAgain: () => void;
  /**
   * A row link was taken, with its position in the list.
   *
   * This screen has TWO exits, and they mean opposite things: the header link
   * above abandons the list, a row link resolves it. Only the header link runs
   * through React state, so without this the successful exit -- the one a
   * librarian takes after finding the right bucket -- leaves no trace at all.
   */
  onChoose?: (artist: { id: number }, index: number) => void;
};

/**
 * Reproduces `libraryAdmin/multipleArtistsDisplay.jsp`, which the servlet
 * reaches from both of its searches: every artist that owns one fully
 * specified `(genre_id, code_letters, code_number)` triple, and every artist
 * filed under a `(genre_id, code_letters)` pair when the librarian left the
 * call number blank.
 *
 * Rows are in the order `resolveArtistByCode` returned them -- this component
 * does not re-sort. That is load-bearing for the browse rather than merely
 * economical: Backend-Service orders it by `artist_genre_code`, and the
 * librarian's whole reason for asking is to read the highest assigned number
 * off the bottom of the list. A defensive client-side sort would hide a
 * Backend regression in exactly the requirement this screen exists to meet.
 *
 * A compilation code is the case that makes the fully-specified arm
 * load-bearing rather than defensive: every Various Artists bucket in a genre
 * collides on one triple, so picking the bucket by name is the only way
 * through. See `composeLibraryCodeSearchArgs` for why. Those rows are also the
 * reason each link is built by `artistCardHref` rather than hard-coded: a
 * bucket is filed and edited as a shelf section, on a different card from a
 * performer.
 *
 * **Each row shows its OWN number, read from the row.** In a fully-specified
 * lookup that is the searched number by construction, so the two sources
 * agree and either would pass a test; in a browse the number varies row to
 * row and is the entire point. Both responses have the same wire shape, so
 * hoisting the number out of the rows typechecks and renders plausibly while
 * answering the wrong question -- the same trap Backend-Service's own handler
 * has available to it, where echoing the request back would emit one number on
 * every row.
 *
 * `codeNumber` is therefore the HEADER's number, not the rows'. `null` is a
 * browse, and the header drops to the partial code the servlet composes for
 * it (`genre.getReferenceName() + " " + artistLetters`).
 *
 * The JSP's "no results" branch IS reproduced, and the browse is what reaches
 * it. It was unreachable while every caller was a fully-specified lookup --
 * an unassigned code answers 404, and a zero-length 200 is refused upstream as
 * untrustworthy -- but unused call letters are a 200 with no rows, and a
 * librarian checking whether a section is free is asking a normal question.
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
  onChoose,
}: MultipleArtistsDisplayProps) {
  const searchedCode = formatCallLettersAndNumbers({
    code_letters: codeLetters,
    code_artist_number: codeNumber,
  });

  return (
    <div
      data-testid="multiple-artists-display"
      style={{ textAlign: "center", width: "95%", margin: "0 auto" }}
    >
      {/* The JSP's header is a three-cell layout table, reproduced as one so
          the return link and the code sit on a line rather than stacking.
          Presentational: it carries no tabular data, and leaving it in the
          accessibility tree would announce a second table on a screen whose
          point is the one below. */}
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
              {searchedCode}
            </td>
            <td className="text" style={{ width: "33%", textAlign: "center" }} />
          </tr>
        </tbody>
      </table>

      <br />

      {artists.length === 0 ? (
        <>
          <p className="text">
            There are currently no artists in the catalog that match these criteria.
          </p>
          {/* The JSP points this at `searchCardCatalog`, its own separate
              search page. Here that search is mounted on the chooser, above
              the swap this screen lives in, so returning to the chooser IS
              landing on it -- one destination rather than a route this app
              does not have. */}
          <p className="text">
            <button type="button" className="link-button" onClick={onChooseAgain}>
              <b>Do another search</b>
            </button>
          </p>
        </>
      ) : (
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
                {/* Sourced from the row, never from `codeNumber` above: a
                    browse's numbers differ row to row, and reading the header's
                    would put one number on every line. */}
                <td style={{ textAlign: "left" }}>
                  {formatCallLettersAndNumbers({
                    code_letters: artist.code_letters,
                    code_artist_number: artist.code_number,
                  })}
                </td>
                <td>
                  <Link href={artistCardHref(artist)} onClick={() => onChoose?.(artist, index)}>
                    {artist.artist_name}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
