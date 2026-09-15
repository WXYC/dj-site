"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { CLASSIC_CATALOG_SEARCH_PATH } from "@/lib/features/catalog/constants";
import { isRotationAdminEnabled } from "@/lib/features/rotation/flags";
import { rotationLocationFor } from "@/lib/features/rotation/location";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import { MatchedTrackChips } from "./MatchedTrackChips";

/**
 * The rotation card number as a small circle — a CSS shape, never a Unicode
 * circled-digit glyph (①–⑳), which stops at 20 and renders inconsistently.
 * `currentColor` keeps it in step with the classic table's bold text in both
 * light and dark. Decorative only: the surrounding `<b>` owns the `title` that
 * spells out "card N", and the circle is `aria-hidden`.
 */
const CLASSIC_CARD_BADGE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "1.6em",
  height: "1.6em",
  padding: "0 0.35em",
  borderRadius: "50%",
  border: "1px solid currentColor",
  lineHeight: 1,
  boxSizing: "border-box",
};

/**
 * Which artist card this row's name opens.
 *
 * `LibraryCatalogServlet.goToArtistModifyCard` picks the card from the
 * viewer's authority, never from the `mode=view` the legacy row href carries —
 * `ArtistViewServlet` reads only `id`, so that parameter names nothing. A
 * viewer with admin access gets `artistCardModify.jsp`, whose "Add a Library
 * Release for This Artist" form is the whole reason to reach an artist from a
 * search; everyone else gets the read-only `artistCardDisplay.jsp`, which has
 * no add form.
 *
 * Only the modify branch distinguishes a compilation bucket, matching the JSP:
 * its non-admin branch forwards every artist to the one display card, and
 * there is no bucket-shaped read-only screen to route to here either.
 */
const artistRowHref = (
  artist: { id: number; lettercode?: string },
  canModify: boolean,
): string =>
  canModify
    ? artistCardHref({ id: artist.id, code_letters: artist.lettercode ?? "" })
    : `/dashboard/library/artist/${artist.id}/view`;

/**
 * `canModify` is resolved once, server-side, by the page and threaded down
 * rather than re-derived here: a client component cannot read the station role
 * without a round trip, and the catalog stays reachable by any authenticated
 * DJ — the authority decides the destination, never the access.
 */
export default function SearchResults({
  canModify,
  searchPath = CLASSIC_CATALOG_SEARCH_PATH,
}: {
  canModify: boolean;
  /** The screen these results are mounted on; see the constant's doc. */
  searchPath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchString = searchParams.get("searchString") || "";
  const exclusive = searchParams.get("exclusive") === "true";
  const hasQuery = searchString.trim().length > 0;
  // Either a free-text query OR the Exclusive filter constitutes a search.
  // Skip only when neither is active so we don't fire empty requests.
  const skip = !hasQuery && !exclusive;

  const { data: results, isLoading, error } = useSearchCatalogQuery(
    {
      artist_name: hasQuery ? searchString : undefined,
      album_title: hasQuery ? searchString : undefined,
      n: 50,
      on_streaming: exclusive ? false : undefined,
    },
    { skip }
  );

  if (skip) {
    return null;
  }

  const clearExclusive = () => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete("exclusive");
    const qs = params.toString();
    router.replace(qs ? `${searchPath}?${qs}` : searchPath);
  };

  // Mirrors tubafrenzy's facet bar: the Exclusive availability filter renders
  // as an active chip that a click dismisses.
  const facetBar = exclusive ? (
    <div id="facetBar">
      <div className="facet-bar">
        <span
          className="facet-chip exclusive-chip active"
          data-testid="classic-facet-chip-exclusive"
          onClick={clearExclusive}
        >
          Exclusive &times;
        </span>
      </div>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div id="liveResults">
        {facetBar}
        <div className="live-results-loading">Searching...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="liveResults">
        {facetBar}
        <div className="live-results-error">Error loading search results. Please try again.</div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div id="liveResults">
        {facetBar}
        <div className="live-results-empty">
          {hasQuery
            ? `No results found for "${searchString}"`
            : "No exclusive albums found"}
        </div>
      </div>
    );
  }

  return (
    <div id="liveResults">
      {facetBar}
      <div className="live-results-summary">
        {exclusive && !hasQuery ? (
          <>
            Browsing <b>{results.length}</b> exclusive releases.
          </>
        ) : (
          <>
            Your search <b>&quot;{searchString}&quot;</b> matched{" "}
            <b>{results.length}</b> releases.
            {exclusive && (
              <>
                {" "}
                <span className="exclusive-capsule">EXCLUSIVE ONLY</span>
              </>
            )}
          </>
        )}
      </div>
      <table className="entry-table" cellPadding={8} style={{ width: "100%" }}>
        <thead>
          <tr className="entry-header">
            <th style={{ width: "12%" }}>Genre</th>
            <th style={{ width: "10%" }}>Code</th>
            <th style={{ width: "28%" }}>Artist</th>
            <th style={{ width: "38%" }}>Release</th>
            <th style={{ width: "12%" }}>Format</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => {
            const rotationLocation = isRotationAdminEnabled()
              ? rotationLocationFor(result.rotation_bin, result.card)
              : null;
            return (
            <tr
              key={result.id}
              className={`entry-row ${
                index % 2 === 0 ? "entry-row-even" : "entry-row-odd"
              }`}
            >
              <td>{result.artist?.genre ?? ""}</td>
              {/* nowrap: the bin + card badge outsizes the call numbers this
                  column was sized for, and a mid-token wrap would rag the Code
                  column against every non-rotating row beside it. */}
              <td style={{ whiteSpace: "nowrap" }}>
                {rotationLocation ? (
                  <b title={rotationLocation.title}>
                    {rotationLocation.bin}
                    {rotationLocation.cardNumber != null && (
                      <>
                        {" "}
                        <span aria-hidden style={CLASSIC_CARD_BADGE_STYLE}>
                          {rotationLocation.cardNumber}
                        </span>
                      </>
                    )}
                  </b>
                ) : (
                  <>
                    {result.artist?.lettercode} {result.artist?.numbercode}/
                    {result.entry}
                  </>
                )}
              </td>
              <td>
                {/*
                  `artist.id` is only present once the search response carries
                  `artist_id`; a row without it renders as plain text rather
                  than a link to an unresolvable id.
                */}
                {result.artist?.id ? (
                  <Link
                    href={artistRowHref(
                      { id: result.artist.id, lettercode: result.artist.lettercode },
                      canModify,
                    )}
                  >
                    {result.album_artist
                      ? "Various Artists"
                      : result.artist.name || "Unknown"}
                  </Link>
                ) : result.album_artist ? (
                  "Various Artists"
                ) : (
                  result.artist?.name || "Unknown"
                )}
              </td>
              <td>
                {/*
                  The release title links to the classic release view,
                  mirroring `card-catalog-search`'s
                  `<a href="libraryRelease?id=…">`.

                  NOT `/dashboard/album/[id]`: that URL has no page in either
                  experience slot — both fall through to `default.tsx` and
                  render `ExperienceGap`. Its album card exists only as the
                  `@information` slot's client-side portal, so it survives a
                  soft navigation and breaks on reload, bookmark, or paste.

                  Guarded on a positive id: `convertToAlbumEntry` synthesizes a
                  NEGATIVE id (a hash, or a contentless counter) for a row with
                  no Backend `library.id` behind it, and there is no album card
                  to route to for those. They stay plain text.
                */}
                {result.id != null && result.id > 0 ? (
                  <Link href={`/dashboard/library/release/${result.id}`}>
                    {result.title}
                  </Link>
                ) : (
                  result.title
                )}
                {result.on_streaming === false && (
                  <>
                    {" "}
                    <span className="exclusive-capsule">EXCLUSIVE</span>
                  </>
                )}
                <MatchedTrackChips matched_via={result.matched_via} />
              </td>
              <td>{result.format}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div className="live-results-status">
        Showing {results.length} of {results.length}
      </div>
    </div>
  );
}
