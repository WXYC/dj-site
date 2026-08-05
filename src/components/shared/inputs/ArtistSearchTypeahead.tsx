"use client";

import { RequireMD } from "@/src/components/shared/Authorization";
import { useLazySearchArtistsInGenreQuery } from "@/lib/features/catalog/api";
import type { ArtistInGenreOption } from "@/lib/features/catalog/types";
import { ClickAwayListener } from "@mui/base/ClickAwayListener";
import { Box, CircularProgress, Input, Sheet, Typography } from "@mui/joy";
import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 10;

/**
 * Shared, MD-gated artist-search typeahead. This is the load-bearing prop
 * contract for #1076 (Rightbar album panel artist link), #1079 (add-release
 * panel), and #1080 (artist-add dedup step) — all three mount this component
 * against their own surface, so changes here ripple to all of them.
 *
 * - A controlled search input: the query text is React state owned by this
 *   component, not a caller-supplied `value`/`onChange` pair — callers only
 *   observe outcomes (`onSelect`, `onCreateNew`), never raw keystrokes.
 * - `genreId` scopes the search to `useLazySearchArtistsInGenreQuery`.
 * - `onSelect(artist)` receives the full matched artist (id AND
 *   artist_name), never just an id — downstream consumers render the name
 *   without a second lookup.
 * - `onCreateNew(searchTerm)` fires on the empty-state "create new" row and
 *   only hands the current query string back to the caller. It does not
 *   navigate or open a modal itself — the create flow (dedup, form, etc.)
 *   belongs to the caller (see #1080).
 */
export interface ArtistSearchTypeaheadProps {
  genreId: number;
  onSelect: (artist: ArtistInGenreOption) => void;
  onCreateNew: (searchTerm: string) => void;
  disabled?: boolean;
}

function ArtistSearchTypeaheadInner({
  genreId,
  onSelect,
  onCreateNew,
  disabled,
}: ArtistSearchTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [trigger, { data, isFetching }] = useLazySearchArtistsInGenreQuery();

  const trimmed = query.trim();
  const hasValidQuery = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!hasValidQuery) return;
    const timer = setTimeout(() => {
      trigger({ genre_id: genreId, q: trimmed, limit: RESULT_LIMIT });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trigger, genreId, trimmed, hasValidQuery]);

  const artists = hasValidQuery ? (data?.artists ?? []) : [];
  const showPanel = open && hasValidQuery;
  const totalRows = artists.length + 1;

  const handleSelect = useCallback(
    (artist: ArtistInGenreOption) => {
      onSelect(artist);
      setQuery(artist.artist_name);
      setOpen(false);
      setHighlightIndex(0);
    },
    [onSelect],
  );

  const handleCreateNew = useCallback(() => {
    onCreateNew(trimmed);
    setOpen(false);
    setHighlightIndex(0);
  }, [onCreateNew, trimmed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showPanel) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, totalRows - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIndex === artists.length) {
            handleCreateNew();
          } else if (highlightIndex >= 0 && highlightIndex < artists.length) {
            handleSelect(artists[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [showPanel, totalRows, highlightIndex, artists, handleSelect, handleCreateNew],
  );

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: "relative", width: "100%" }}>
        <Input
          size="sm"
          fullWidth
          disabled={disabled}
          placeholder="Search artists..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
          startDecorator={
            isFetching ? (
              <CircularProgress
                size="sm"
                sx={{ "--CircularProgress-size": "14px" }}
              />
            ) : undefined
          }
          slotProps={{
            input: {
              ref: inputRef,
              "aria-label": "Search artists",
              autoComplete: "off",
              spellCheck: false,
            },
          }}
        />

        {showPanel && (
          <Sheet
            variant="outlined"
            sx={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 8002,
              borderRadius: "md",
              maxHeight: "300px",
              overflowY: "auto",
              boxShadow: "0px 8px 24px -4px rgba(0,0,0,0.4)",
              py: 0.5,
            }}
          >
            {artists.map((artist, index) => (
              <Box
                key={artist.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(artist)}
                onMouseEnter={() => setHighlightIndex(index)}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  cursor: "pointer",
                  backgroundColor:
                    highlightIndex === index ? "primary.700" : "transparent",
                  "&:hover": {
                    backgroundColor:
                      highlightIndex === index ? "primary.700" : "neutral.800",
                  },
                }}
              >
                <Typography
                  level="body-sm"
                  sx={{ color: highlightIndex === index ? "white" : "inherit" }}
                >
                  {artist.artist_name}
                </Typography>
              </Box>
            ))}
            <Box
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreateNew}
              onMouseEnter={() => setHighlightIndex(artists.length)}
              sx={{
                px: 1.5,
                py: 0.75,
                cursor: "pointer",
                borderTop: artists.length > 0 ? "1px solid" : undefined,
                borderColor: "divider",
                backgroundColor:
                  highlightIndex === artists.length
                    ? "primary.700"
                    : "transparent",
                "&:hover": {
                  backgroundColor:
                    highlightIndex === artists.length
                      ? "primary.700"
                      : "neutral.800",
                },
              }}
            >
              <Typography
                level="body-sm"
                sx={{
                  fontStyle: "italic",
                  color: highlightIndex === artists.length ? "white" : "inherit",
                }}
              >
                {artists.length === 0
                  ? `Create new artist "${trimmed}"`
                  : `Create new artist "${trimmed}" instead`}
              </Typography>
            </Box>
          </Sheet>
        )}
      </Box>
    </ClickAwayListener>
  );
}

export default function ArtistSearchTypeahead(props: ArtistSearchTypeaheadProps) {
  return (
    <RequireMD>
      <ArtistSearchTypeaheadInner {...props} />
    </RequireMD>
  );
}
