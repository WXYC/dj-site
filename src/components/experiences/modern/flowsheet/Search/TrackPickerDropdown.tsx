"use client";

import { normalizeTrackArtists } from "@/lib/features/rotation/normalize-track-artists";
import { KeyboardArrowDown } from "@mui/icons-material";
import { Box, CircularProgress, Input, Sheet, Typography } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Minimal shape a track must expose to be rendered by this dropdown. Both the
 * rotation picker (`RotationTrack`, `library/rotation/:id/tracks`) and the
 * library picker (`LibraryTrack`, `proxy/library/:id/tracks`) project to this
 * via thin adapters at the call site — the two BS wire contracts are
 * intentionally distinct, so the unification happens here at the UI layer.
 */
export interface TrackPickerEntry {
  position: string;
  title: string;
  artists: string[];
}

function formatTrack(track: TrackPickerEntry): string {
  // Title only at rest — the position is structural metadata (vinyl side,
  // disc number) the DJ already knows from the panel; it would read as part
  // of the track title in the closed combobox ("3 El Barm" ≠ a track title).
  return track.title;
}

function matchesQuery(track: TrackPickerEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (track.title.toLowerCase().includes(q)) return true;
  if (track.position.toLowerCase().includes(q)) return true;
  return track.artists.some((a) => a.toLowerCase().includes(q));
}

export default function TrackPickerDropdown<T extends TrackPickerEntry>({
  tracks,
  isLoading,
  selectedTrack,
  onSelectTrack,
  onManualEntry,
  disabled,
}: {
  tracks: T[];
  isLoading: boolean;
  selectedTrack: T | null;
  onSelectTrack: (track: T) => void;
  onManualEntry: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleTracks = useMemo(() => {
    if (!query) return tracks;
    return tracks.filter((t) => matchesQuery(t, query));
  }, [tracks, query]);

  // While the panel is open the input mirrors the live filter query. While
  // closed it mirrors the parent-owned selection so the trigger reads
  // "A1 Track Title" at rest. Matches the rotation-picker pattern (#745).
  const displayValue = open
    ? query
    : selectedTrack
      ? formatTrack(selectedTrack)
      : "";

  const placeholder = isLoading
    ? "Loading tracks..."
    : tracks.length === 0
      ? "Song Title"
      : "Select Track...";

  const inputDisabled = disabled || isLoading;

  const openPanel = useCallback(() => {
    if (inputDisabled) return;
    setOpen(true);
    setQuery("");
    setHighlightIndex(0);
  }, [inputDisabled]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlightIndex(-1);
  }, []);

  const handleSelect = useCallback(
    (track: T) => {
      onSelectTrack(track);
      closePanel();
    },
    [onSelectTrack, closePanel]
  );

  const handleManual = useCallback(() => {
    onManualEntry();
    closePanel();
  }, [onManualEntry, closePanel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPanel();
        }
        return;
      }
      // Total navigable items = visible tracks + "Not listed" manual option.
      const totalItems = visibleTracks.length + 1;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, totalItems - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIndex === visibleTracks.length) {
            handleManual();
          } else if (
            highlightIndex >= 0 &&
            highlightIndex < visibleTracks.length
          ) {
            handleSelect(visibleTracks[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closePanel();
          inputRef.current?.blur();
          break;
      }
    },
    [
      open,
      openPanel,
      closePanel,
      visibleTracks,
      highlightIndex,
      handleSelect,
      handleManual,
    ]
  );

  return (
    <ClickAwayListener onClickAway={closePanel}>
      <Box
        sx={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Input
          size="sm"
          fullWidth
          variant="plain"
          disabled={inputDisabled}
          placeholder={placeholder}
          value={displayValue}
          onFocus={openPanel}
          // Clicking an already-focused input doesn't refire onFocus; an
          // idempotent reopen on click handles that case.
          onClick={openPanel}
          onChange={(e) => {
            if (!open) openPanel();
            setQuery(e.target.value);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
          startDecorator={
            isLoading ? (
              <CircularProgress
                size="sm"
                sx={{ "--CircularProgress-size": "14px" }}
              />
            ) : undefined
          }
          endDecorator={
            tracks.length > 0 || isLoading ? (
              <KeyboardArrowDown
                sx={{
                  fontSize: "1rem",
                  transition: "transform 0.2s",
                  transform: open ? "rotate(180deg)" : "none",
                  opacity: inputDisabled ? 0.4 : 0.7,
                }}
              />
            ) : undefined
          }
          // Sit flat inside the parent search row's square frame — no border,
          // no radius, no background tint. Matches RotationReleaseDropdown.
          sx={{
            borderRadius: 0,
            backgroundColor: "transparent",
            "--Input-focusedThickness": "0px",
            "&:hover": { backgroundColor: "transparent" },
            "&.Mui-focused": { backgroundColor: "transparent" },
          }}
          slotProps={{
            input: {
              ref: inputRef,
              "data-testid": "track-picker-combobox",
              autoComplete: "off",
              spellCheck: false,
            },
          }}
        />

        {open && (
          <Sheet
            variant="outlined"
            data-testid="track-picker-panel"
            sx={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 8002,
              borderRadius: "md",
              maxHeight: "300px",
              minWidth: "280px",
              width: "max-content",
              maxWidth: "500px",
              overflowY: "auto",
              boxShadow: "0px 8px 24px -4px rgba(0,0,0,0.4)",
              py: 0.5,
            }}
          >
            {visibleTracks.map((track, index) => {
              // Stable testid keyed off the ORIGINAL tracks-array index so
              // tests can find a row by its catalog position regardless of
              // which subset survives the current filter.
              const originalIndex = tracks.indexOf(track);
              const cleanArtists = normalizeTrackArtists(track.artists);
              return (
                <Box
                  key={`${track.position}-${originalIndex}`}
                  data-testid={`track-picker-option-${originalIndex}`}
                  // `onMouseDown` preventDefault keeps focus on the input so
                  // the ClickAway / blur path doesn't close the panel before
                  // the option's `onClick` selection handler runs.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(track)}
                  sx={{
                    display: "flex",
                    gap: 1,
                    px: 1.5,
                    py: 0.5,
                    cursor: "pointer",
                    backgroundColor:
                      highlightIndex === index ? "primary.700" : "transparent",
                    "&:hover": {
                      backgroundColor:
                        highlightIndex === index
                          ? "primary.700"
                          : "neutral.800",
                    },
                  }}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <Typography
                    level="body-xs"
                    sx={{
                      opacity: 0.5,
                      minWidth: "28px",
                      pt: 0.25,
                      color:
                        highlightIndex === index
                          ? "neutral.300"
                          : "text.tertiary",
                    }}
                  >
                    {track.position}
                  </Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      level="body-sm"
                      sx={{
                        color: highlightIndex === index ? "white" : "inherit",
                      }}
                    >
                      {track.title}
                    </Typography>
                    {cleanArtists.length > 0 && (
                      <Typography
                        level="body-xs"
                        sx={{
                          opacity: 0.6,
                          color:
                            highlightIndex === index
                              ? "neutral.300"
                              : "text.tertiary",
                        }}
                      >
                        {cleanArtists.join(", ")}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
            <Box
              data-testid="track-picker-manual"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleManual}
              sx={{
                display: "flex",
                alignItems: "center",
                px: 1.5,
                py: 0.75,
                cursor: "pointer",
                borderTop: "1px solid",
                borderColor: "divider",
                mt: 0.5,
                backgroundColor:
                  highlightIndex === visibleTracks.length
                    ? "primary.700"
                    : "transparent",
                "&:hover": {
                  backgroundColor:
                    highlightIndex === visibleTracks.length
                      ? "primary.700"
                      : "neutral.800",
                },
              }}
              onMouseEnter={() => setHighlightIndex(visibleTracks.length)}
            >
              <Typography
                level="body-sm"
                sx={{
                  fontStyle: "italic",
                  opacity: 0.7,
                  color:
                    highlightIndex === visibleTracks.length
                      ? "white"
                      : "inherit",
                }}
              >
                Not listed — enter manually
              </Typography>
            </Box>
          </Sheet>
        )}
      </Box>
    </ClickAwayListener>
  );
}
