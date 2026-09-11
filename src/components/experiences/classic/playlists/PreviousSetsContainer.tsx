"use client";

import type { RefObject } from "react";
import { usePlaylistSearchResults } from "@/src/hooks/playlistSearchHooks";
import { useRetainedScrollOffset } from "@/src/hooks/useRetainedScrollOffset";
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
  retainedScrollTop,
}: {
  // Server-rendered first page for the default query, so the initial HTML
  // carries rows rather than an empty table that fills in on hydration.
  initialResults?: readonly PlaylistSearchResult[];
  // Where this listing's scroll offset lives while the listing does not.
  // Opening a show unmounts this component, so the offset has to be held above
  // the branch that does it. Absent wherever the listing is never left.
  retainedScrollTop?: RefObject<number>;
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

  // Classic scrolls the shell's container, not the document and not a box of
  // its own — `html, body` clip their overflow and `#classic-container` is
  // where `src/styles/globals.css` puts the scrollport back. The element
  // belongs to the shell above this tree, so it is reached by id, as the
  // archive's own row anchor is.
  useRetainedScrollOffset(retainedScrollTop, () =>
    document.getElementById("classic-container"),
  );

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

          {/* tubafrenzy's own summary line, verbatim: nothing else on the
              screen says a row goes anywhere. */}
          {displayResults.length > 0 && (
            <p
              className="smalltext"
              style={{ textAlign: "center", padding: "0.25em" }}
            >
              Click a track to see the full show.
            </p>
          )}

          {displayResults.length > 0 && (
            <InfiniteScroll
              hasMore={hasMore}
              isLoading={isLoading}
              onLoadMore={loadNextPage}
            >
              <ResultTable results={displayResults} />
            </InfiniteScroll>
          )}
        </>
      )}
    </div>
  );
}
