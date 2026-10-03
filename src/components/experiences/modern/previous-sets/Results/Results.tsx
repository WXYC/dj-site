"use client";

import type {
  SortField,
  SortOrder,
} from "@/lib/features/playlist-search/frontend";
import {
  isChronologicalMode,
  usePlaylistSearchResults,
} from "@/src/hooks/playlistSearchHooks";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { useArchiveStreamListing } from "@/src/hooks/archiveStreamHooks";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import { Box, CircularProgress, Link, Table, Typography } from "@mui/joy";
import NextLink from "next/link";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { hrefForShowEntry } from "@/lib/features/schedule-week/showUrl";
import { useRetainedScrollOffset } from "@/src/hooks/useRetainedScrollOffset";
import FailedSearchNotice from "../FailedSearchNotice";
import ArchiveStreamTable from "../ArchiveStreamTable";
import ResultsContainer from "./ResultsContainer";

function SortableHeader({
  field,
  label,
  currentSort,
  currentOrder,
  onSort,
}: {
  field: SortField;
  label: string;
  currentSort: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        cursor: "pointer",
        userSelect: "none",
        "&:hover": { color: "primary.plainColor" },
      }}
      onClick={() => onSort(field)}
    >
      {label}
      {isActive && (
        <Box component="span" sx={{ ml: 0.5, display: "flex" }}>
          {currentOrder === "asc" ? (
            <ArrowUpward sx={{ fontSize: 16 }} />
          ) : (
            <ArrowDownward sx={{ fontSize: 16 }} />
          )}
        </Box>
      )}
    </Box>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * One link per row, stretched over it by Joy's `overlay`: a <tr> cannot be
 * wrapped in an <a>, and per-cell links would announce the same destination six
 * times. `overlay` drops the link's own `position: relative` so its ::after
 * resolves against the row, which is why the row is positioned.
 */
function ResultDateCell({ result }: { result: PlaylistSearchResult }) {
  const date = formatDate(new Date(result.play_date));
  // Null for a play that belongs to no show, which then renders plain.
  const href = hrefForShowEntry(result.show_id, result.id);

  if (!href) {
    return (
      <Typography level="body-sm" sx={{ color: "text.secondary" }}>
        {date}
      </Typography>
    );
  }

  return (
    <Link
      component={NextLink}
      href={href}
      // Leads with the date so the Date column's own content survives: an
      // aria-label replaces the link's text outright, and nothing else on the
      // row announces when the play aired.
      aria-label={`${date} — see the full show for ${result.track_title} by ${result.artist_name}`}
      // The destination is this same route with a different query, and the show
      // itself is a client query, so a per-row prefetch on an infinitely
      // scrolling listing buys nothing.
      prefetch={false}
      overlay
      underline="none"
      level="body-sm"
      sx={{ color: "text.secondary" }}
    >
      {date}
    </Link>
  );
}

/** Each mode's offset into the listing, held by the surface above both. */
export type RetainedScrollTops = {
  chronological: RefObject<number>;
  ranked: RefObject<number>;
};

/** How close to the bottom, in pixels, counts as "there" for either listing's
 * load-more check. Shared so the ranked and chronological listings cannot
 * drift onto two different thresholds. */
const LOAD_MORE_THRESHOLD_PX = 100;

function isNearBottom(el: Element): boolean {
  return el.scrollHeight <= el.scrollTop + el.clientHeight + LOAD_MORE_THRESHOLD_PX;
}

/**
 * The chronological listing, mounted only in that mode so its archive-stream
 * walk starts on first need. It drives the walk from the scrollport its parent
 * owns: the parent's scroll handler runs only on a scroll event, so a page that
 * adds no rows, or a head too short to fill the scrollport, re-checks the
 * bottom when it lands.
 */
function ChronologicalRows({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const listing = useArchiveStreamListing();
  const { rows, isHeadLoading, isNextPageLoading, hasMore, loadNextPage } =
    listing;

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const loadWhenAtBottom = () => {
      if (isNearBottom(scroller) && !isHeadLoading && !isNextPageLoading && hasMore) {
        loadNextPage();
      }
    };

    loadWhenAtBottom();
    scroller.addEventListener("scroll", loadWhenAtBottom);
    return () => scroller.removeEventListener("scroll", loadWhenAtBottom);
  }, [scrollRef, rows, isHeadLoading, isNextPageLoading, hasMore, loadNextPage]);

  return <ArchiveStreamTable listing={listing} albumInfo rowLinks />;
}

export default function Results({
  retainedScrollTop,
}: {
  // Where this listing's scroll offset lives while the listing does not.
  // Opening a show unmounts this component, so the offset has to be held above
  // the branch that does it. Absent wherever the listing is never left.
  retainedScrollTop?: RetainedScrollTops;
} = {}) {
  const {
    effectiveQuery,
    displayResults,
    hasMore,
    isLoading,
    isError,
    sortBy,
    sortOrder,
    handleSort,
    loadNextPage,
    showResults,
    isRealQuery,
    usingSeed,
    retry,
    failedPage,
    isRetrying,
    failedRetries,
  } = usePlaylistSearchResults({ skipChronological: true });
  const chronological = isChronologicalMode(effectiveQuery, sortBy, sortOrder);

  const ariaSort = (field: SortField) =>
    sortBy === field
      ? sortOrder === "asc"
        ? ("ascending" as const)
        : ("descending" as const)
      : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || chronological) return;

    const onScroll = () => {
      if (isNearBottom(scroller) && !isLoading && hasMore) {
        loadNextPage();
      }
    };

    scroller.addEventListener("scroll", onScroll);
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [isLoading, hasMore, loadNextPage, chronological]);

  // Restoring needs no wait for row height: the walked pages are still in the
  // RTK cache when this remounts, so the rows are in the very commit the
  // restore runs after.
  const resolveScrollport = useCallback(() => scrollRef.current, []);
  useRetainedScrollOffset(
    retainedScrollTop?.[chronological ? "chronological" : "ranked"],
    resolveScrollport,
  );

  return (
    <ResultsContainer showResults={showResults}>
      {/* tubafrenzy's own summary line, verbatim: nothing else on the screen
          says a row goes anywhere. */}
      {(chronological || displayResults.length > 0) && (
        <Typography
          level="body-xs"
          sx={{ px: 1.5, py: 1, color: "text.secondary", flex: "0 0 auto" }}
        >
          Click a track to see the full show.
        </Typography>
      )}

      <Box
        ref={scrollRef}
        data-testid="previous-sets-scrollport"
        sx={{
          // Sized by the flex frame rather than `calc(100vh - <chrome>)`: that
          // constant silently goes wrong the moment anything is added above it,
          // and the overflow then falls through to the frame as a second bar.
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {chronological && <ChronologicalRows scrollRef={scrollRef} />}
        {!chronological && <Table
          aria-label="playlist search results"
          stickyHeader
          hoverRow
          sx={{
            "--TableCell-headBackground": (theme) =>
              theme.vars.palette.background.level1,
            "--Table-headerUnderlineThickness": "1px",
            "--TableRow-hoverBackground": (theme) =>
              theme.vars.palette.background.level1,
          }}
        >
          <thead>
            <tr>
              <th aria-sort={ariaSort("date")} style={{ width: 160, padding: 12 }}>
                <SortableHeader
                  field="date"
                  label="Date"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
              </th>
              <th aria-sort={ariaSort("artist")} style={{ width: 180, padding: 12 }}>
                <SortableHeader
                  field="artist"
                  label="Artist"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
              </th>
              <th aria-sort={ariaSort("song")} style={{ width: 200, padding: 12 }}>
                <SortableHeader
                  field="song"
                  label="Song"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
              </th>
              <th style={{ width: 180, padding: 12 }}>Release</th>
              <th style={{ width: 140, padding: 12 }}>Label</th>
              <th aria-sort={ariaSort("dj")} style={{ width: 120, padding: 12 }}>
                <SortableHeader
                  field="dj"
                  label="DJ"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !isRetrying && displayResults.length === 0 ? (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    paddingTop: "3rem",
                    background: "transparent",
                  }}
                >
                  <CircularProgress color="primary" size="md" />
                </td>
              </tr>
            ) : (
              displayResults.map((result) => (
                <tr key={result.id} style={{ position: "relative" }}>
                  <td>
                    <ResultDateCell result={result} />
                  </td>
                  <td>
                    <Typography level="body-sm" fontWeight="md">
                      {result.artist_name}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {result.track_title}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                      {result.album_title}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                      {result.record_label}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {result.dj_name}
                    </Typography>
                  </td>
                </tr>
              ))
            )}

            {isLoading && !isRetrying && displayResults.length > 0 && (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", padding: "1rem" }}
                >
                  <CircularProgress color="primary" size="sm" />
                </td>
              </tr>
            )}

            {/* Unlike the empty-state row below, not scoped to a real query:
                the default listing is exactly where an unreadable response
                is indistinguishable from an archive with nothing in it. */}
            {failedPage !== null && (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", paddingTop: "2rem" }}
                >
                  <FailedSearchNotice
                    onRetry={retry}
                    retrying={isRetrying}
                    failedRetries={failedRetries}
                  />
                </td>
              </tr>
            )}

            {isRealQuery && !isError && !isLoading && displayResults.length === 0 && (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", paddingTop: "2rem" }}
                >
                  <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                    No results found
                  </Typography>
                </td>
              </tr>
            )}

            {/* Suppressed while the server seed is on screen. `hasMore`
                describes the client query, which has not answered yet, so the
                footer would sit under fifty seeded rows announcing the end of
                a list it cannot see.

                It counts the rows on screen rather than the response's
                `total`, which the backend caps and reports a sentinel past —
                an end-of-list claim must not name a figure scrolling cannot
                reach. */}
            {!usingSeed && !isLoading && !hasMore && displayResults.length > 0 && (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", padding: "1rem" }}
                >
                  <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {displayResults.length.toLocaleString()} results
                  </Typography>
                </td>
              </tr>
            )}
          </tbody>
        </Table>}
      </Box>
    </ResultsContainer>
  );
}
