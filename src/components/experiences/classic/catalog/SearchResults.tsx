"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { Capsule } from "@/src/components/experiences/classic/flowsheet/Capsule";
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

  const filterChips = exclusive ? (
    <div className="classic-filter-chips">
      <span
        className="classic-filter-chip classic-filter-chip--exclusive"
        data-testid="classic-filter-chip-exclusive"
      >
        <span className="classic-filter-chip__label">Exclusive</span>
        <button
          type="button"
          className="classic-filter-chip__dismiss"
          aria-label="Remove Exclusive filter"
          onClick={() => {
            const params = new URLSearchParams(
              Array.from(searchParams.entries())
            );
            params.delete("exclusive");
            const qs = params.toString();
            router.replace(
              qs ? `/dashboard/catalog?${qs}` : `/dashboard/catalog`
            );
          }}
        >
          &times;
        </button>
      </span>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div style={{ textAlign: "center" }} className="text">
        {filterChips}
        <p>Loading search results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center" }} className="text">
        {filterChips}
        <p>Error loading search results. Please try again.</p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    const emptyContext = hasQuery
      ? `No results found for "${searchString}"`
      : "No exclusive albums found";
    return (
      <div style={{ textAlign: "center" }} className="text">
        {filterChips}
        <p>{emptyContext}</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      {filterChips}
      <table
        cellPadding={4}
        cellSpacing={2}
        border={0}
        style={{ width: "100%", marginTop: "20px" }}
      >
        <thead>
          <tr className="searchResultsHeader">
            <th>Artist</th>
            <th>Album</th>
            <th>Format</th>
            <th>Library Code</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id} className="text">
              <td align="left">{result.album_artist ? "Various Artists" : result.artist.name}</td>
              <td align="left">
                {result.title}
                {result.on_streaming === false && (
                  <>
                    {" "}
                    <Capsule variant="exclusive" label="EXCLUSIVE" />
                  </>
                )}
                <MatchedTrackChips matched_via={result.matched_via} />
              </td>
              <td align="left">{result.format}</td>
              <td align="left">
                {result.artist.lettercode} {result.entry}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
