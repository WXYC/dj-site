"use client";

import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import SearchForm from "./SearchForm";
import ResultTable from "./ResultTable";
import InfiniteScroll from "./InfiniteScroll";
import type { PreviousSetsResult } from "./ResultRow";
import "@/src/styles/classic/previous-sets.css";

// Top-level Classic "Previous Sets" surface. Mirrors tubafrenzy's
// `public/searchPage.jsp` + `mostRecentEntries.jsp` shape: centered title,
// single free-form search input, 5-col results table below.
export default function PreviousSetsContainer() {
  const {
    results,
    total,
    hasMore,
    isLoading,
    isError,
    loadNextPage,
    effectiveQuery,
  } = usePlaylistSearch();

  const hasQuery = effectiveQuery.trim().length >= 2;

  return (
    <div className="classic-previous-sets">
      <h2 className="bigblue" style={{ textAlign: "center" }}>
        Playlist Archive
      </h2>
      <p
        className="smalltext"
        style={{ textAlign: "center", marginBottom: "1em" }}
      >
        Search through WXYC playlists from November 2004 to present. Use AND,
        OR, NOT operators and quotes for exact phrases.
      </p>

      <SearchForm />

      {hasQuery && (
        <div className="classic-previous-sets-results">
          <p
            className="text"
            style={{ textAlign: "center", padding: "0.5em" }}
          >
            {isLoading && results.length === 0
              ? "Searching..."
              : total > 0
              ? `Found ${total.toLocaleString()} results`
              : "No results found"}
          </p>

          {isError && (
            <p
              className="redlabel"
              style={{ textAlign: "center", padding: "0.5em" }}
            >
              An error occurred while searching. Please try again.
            </p>
          )}

          {results.length > 0 && (
            <InfiniteScroll
              hasMore={hasMore}
              isLoading={isLoading}
              onLoadMore={loadNextPage}
            >
              <ResultTable results={results as PreviousSetsResult[]} />
            </InfiniteScroll>
          )}
        </div>
      )}
    </div>
  );
}
