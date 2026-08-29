"use client";

import { usePlaylistSearchResults } from "@/src/hooks/playlistSearchHooks";
import type { PlaylistSearchParams } from "@wxyc/shared/dtos";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import { Box, CircularProgress, Table, Typography } from "@mui/joy";
import { useEffect, useRef } from "react";
import ResultsContainer from "./ResultsContainer";

function SortableHeader({
  field,
  label,
  currentSort,
  currentOrder,
  onSort,
}: {
  field: "date" | "artist" | "song" | "dj";
  label: string;
  currentSort: PlaylistSearchParams["sort"];
  currentOrder: "asc" | "desc";
  onSort: (field: "date" | "artist" | "song" | "dj") => void;
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

export default function Results({
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
    sortBy,
    sortOrder,
    handleSort,
    loadNextPage,
    showResults,
    isRealQuery,
    usingSeed,
  } = usePlaylistSearchResults({ initialResults });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const scrolledToBottom =
        scroller.scrollHeight <=
        scroller.scrollTop + scroller.clientHeight + 100;

      if (scrolledToBottom && !isLoading && hasMore) {
        loadNextPage();
      }
    };

    scroller.addEventListener("scroll", onScroll);
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [isLoading, hasMore, loadNextPage]);

  return (
    <ResultsContainer showResults={showResults}>
      <Box
        ref={scrollRef}
        sx={{
          // Sized by the flex frame rather than `calc(100vh - <chrome>)`: that
          // constant silently goes wrong the moment anything is added above it,
          // and the overflow then falls through to the frame as a second bar.
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        <Table
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
              <th style={{ width: 160, padding: 12 }}>
                <SortableHeader
                  field="date"
                  label="Date"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
              </th>
              <th style={{ width: 180, padding: 12 }}>
                <SortableHeader
                  field="artist"
                  label="Artist"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
              </th>
              <th style={{ width: 200, padding: 12 }}>
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
              <th style={{ width: 120, padding: 12 }}>
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
            {isLoading && displayResults.length === 0 ? (
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
                <tr key={result.id}>
                  <td>
                    <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                      {formatDate(new Date(result.play_date))}
                    </Typography>
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

            {isLoading && displayResults.length > 0 && (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", padding: "1rem" }}
                >
                  <CircularProgress color="primary" size="sm" />
                </td>
              </tr>
            )}

            {isRealQuery && !isLoading && displayResults.length === 0 && (
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

            {/* Suppressed while the server seed is on screen. `total` and
                `hasMore` describe the client query, which has not answered
                yet, so the footer would sit under fifty seeded rows reading
                "0 results" — an end-of-list claim about a list it cannot
                see. */}
            {!usingSeed && !isLoading && !hasMore && displayResults.length > 0 && (
              <tr style={{ background: "transparent" }}>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", padding: "1rem" }}
                >
                  <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {total.toLocaleString()} results
                  </Typography>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Box>
    </ResultsContainer>
  );
}
