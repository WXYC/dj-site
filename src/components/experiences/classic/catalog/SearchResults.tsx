"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { MatchedTrackChips } from "./MatchedTrackChips";

export default function SearchResults() {
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
    router.replace(qs ? `/dashboard/catalog?${qs}` : `/dashboard/catalog`);
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
          {results.map((result, index) => (
            <tr
              key={result.id}
              className={`entry-row ${
                index % 2 === 0 ? "entry-row-even" : "entry-row-odd"
              }`}
            >
              <td>{result.artist?.genre ?? ""}</td>
              <td>
                {result.artist?.lettercode} {result.artist?.numbercode}/
                {result.entry}
              </td>
              <td>
                {result.album_artist
                  ? "Various Artists"
                  : result.artist?.name || "Unknown"}
              </td>
              <td>
                {result.title}
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
          ))}
        </tbody>
      </table>
      <div className="live-results-status">
        Showing {results.length} of {results.length}
      </div>
    </div>
  );
}
