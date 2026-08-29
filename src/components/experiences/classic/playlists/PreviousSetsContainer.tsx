"use client";

import { usePlaylistSearchResults } from "@/src/hooks/playlistSearchHooks";
import type { PlaylistSearchResult } from "@wxyc/shared";
import SearchForm from "./SearchForm";
import ResultTable from "./ResultTable";
import InfiniteScroll from "./InfiniteScroll";
import "@/src/styles/classic/previous-sets.css";

// Top-level Classic "Previous Sets" surface. Mirrors tubafrenzy's
// `public/searchPage.jsp` + `mostRecentEntries.jsp` shape: centered title,
// single free-form search input, 5-col results table below.
export default function PreviousSetsContainer({
  initialResults,
}: {
  // Server-rendered first page for the default query, so the initial HTML
  // carries rows rather than an empty table that fills in on hydration.
  initialResults?: readonly PlaylistSearchResult[];
} = {}) {
  const {
    displayResults,
    total,
    hasMore,
    isLoading,
    isError,
    loadNextPage,
    showResults,
    isRealQuery,
  } = usePlaylistSearchResults({ initialResults });

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

      {showResults && (
        <>
          {/* Scoped to a real query. A count answers a question the DJ asked;
              over the default listing it is noise, and "No results found" over
              a populated archive is simply wrong. While a request is in flight
              "Searching..." wins so stale copy cannot flash mid-query. */}
          {isRealQuery && (
            <p
              className="text"
              style={{ textAlign: "center", padding: "0.5em" }}
            >
              {isLoading
                ? "Searching..."
                : total > 0
                ? `Found ${total.toLocaleString()} results`
                : "No results found"}
            </p>
          )}

          {isError && (
            <p
              className="redlabel"
              style={{ textAlign: "center", padding: "0.5em" }}
            >
              An error occurred while searching. Please try again.
            </p>
          )}

          {displayResults.length > 0 && (
            <InfiniteScroll
              hasMore={hasMore}
              isLoading={isLoading}
              onLoadMore={loadNextPage}
            >
              {/* PreviousSetsResult only adds optional fields on top of
                  PlaylistSearchResult, so the wider hook return type is
                  structurally assignable to the narrower table prop. */}
              <ResultTable results={displayResults} />
            </InfiniteScroll>
          )}
        </>
      )}
    </div>
  );
}
