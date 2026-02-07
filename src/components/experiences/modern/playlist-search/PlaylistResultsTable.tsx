"use client";

import type { PlaylistSearchResult, PlaylistSearchParamsSortEnum } from "@wxyc/shared";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import { Box, Link, Table, Typography } from "@mui/joy";

interface PlaylistResultsTableProps {
  results: PlaylistSearchResult[];
  sortBy: PlaylistSearchParamsSortEnum;
  sortOrder: "asc" | "desc";
  onSort: (field: "date" | "artist" | "song" | "dj") => void;
}

function SortableHeader({
  field,
  label,
  currentSort,
  currentOrder,
  onSort,
}: {
  field: "date" | "artist" | "song" | "dj";
  label: string;
  currentSort: string;
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
        "&:hover": { color: "primary.main" },
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

export default function PlaylistResultsTable({
  results,
  sortBy,
  sortOrder,
  onSort,
}: PlaylistResultsTableProps) {
  return (
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
              onSort={onSort}
            />
          </th>
          <th style={{ width: 180, padding: 12 }}>
            <SortableHeader
              field="artist"
              label="Artist"
              currentSort={sortBy}
              currentOrder={sortOrder}
              onSort={onSort}
            />
          </th>
          <th style={{ width: 200, padding: 12 }}>
            <SortableHeader
              field="song"
              label="Song"
              currentSort={sortBy}
              currentOrder={sortOrder}
              onSort={onSort}
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
              onSort={onSort}
            />
          </th>
        </tr>
      </thead>
      <tbody>
        {results.map((result) => (
          <tr key={result.id}>
            <td>
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                {formatDate(result.play_date)}
              </Typography>
            </td>
            <td>
              <Typography level="body-sm" fontWeight="md">
                {result.artist_name}
              </Typography>
            </td>
            <td>
              <Typography level="body-sm">{result.track_title}</Typography>
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
              <Link
                level="body-sm"
                href={`/playlists?dj=${encodeURIComponent(result.dj_name)}`}
                sx={{ textDecoration: "none" }}
              >
                {result.dj_name}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
