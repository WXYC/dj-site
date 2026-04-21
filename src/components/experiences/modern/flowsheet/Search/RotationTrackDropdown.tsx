"use client";

import { RotationTrack } from "@/lib/features/rotation/api";
import { KeyboardArrowDown } from "@mui/icons-material";
import { Box, CircularProgress, Sheet, Typography } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useRef, useState } from "react";

export default function RotationTrackDropdown({
  tracks,
  isLoading,
  selectedTrack,
  onSelectTrack,
  onManualEntry,
  disabled,
}: {
  tracks: RotationTrack[];
  isLoading: boolean;
  selectedTrack: RotationTrack | null;
  onSelectTrack: (track: RotationTrack) => void;
  onManualEntry: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    if (!disabled && !isLoading) {
      setOpen((prev) => !prev);
      setHighlightIndex(-1);
    }
  }, [disabled, isLoading]);

  const handleSelect = useCallback(
    (track: RotationTrack) => {
      onSelectTrack(track);
      setOpen(false);
    },
    [onSelectTrack]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          setHighlightIndex(0);
        }
        return;
      }

      // Total items = tracks + "Not listed" option
      const totalItems = tracks.length + 1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setHighlightIndex((prev) => Math.min(prev + 1, totalItems - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (highlightIndex === tracks.length) {
            // "Not listed" option
            onManualEntry();
            setOpen(false);
          } else if (highlightIndex >= 0 && highlightIndex < tracks.length) {
            handleSelect(tracks[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
          break;
      }
    },
    [open, tracks, highlightIndex, handleSelect, onManualEntry]
  );

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box
        sx={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}
        onKeyDown={handleKeyDown}
      >
        <Box
          ref={triggerRef}
          tabIndex={disabled ? -1 : 0}
          data-testid="rotation-track-trigger"
          onClick={handleToggle}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flex: 1,
            px: 1,
            minHeight: "2rem",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 1,
            overflow: "hidden",
            "&:focus-visible": {
              outline: "2px solid var(--joy-palette-primary-400)",
              outlineOffset: "-2px",
              borderRadius: "4px",
            },
          }}
        >
          {isLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size="sm" sx={{ "--CircularProgress-size": "14px" }} />
              <Typography level="body-sm" sx={{ opacity: 0.5 }}>
                Loading tracks...
              </Typography>
            </Box>
          ) : selectedTrack ? (
            <Typography
              level="body-sm"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selectedTrack.position && (
                <Typography component="span" sx={{ opacity: 0.6, mr: 0.5 }}>
                  {selectedTrack.position}
                </Typography>
              )}
              {selectedTrack.title}
            </Typography>
          ) : (
            <Typography level="body-sm" sx={{ opacity: 0.5 }}>
              {tracks.length > 0 ? "Select Track..." : "Song Title"}
            </Typography>
          )}
          {tracks.length > 0 && (
            <KeyboardArrowDown
              sx={{
                fontSize: "1rem",
                ml: 0.5,
                flexShrink: 0,
                transition: "transform 0.2s",
                transform: open ? "rotate(180deg)" : "none",
              }}
            />
          )}
        </Box>

        {open && (
          <Sheet
            variant="outlined"
            data-testid="rotation-track-panel"
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
            {tracks.map((track, index) => {
              const cleanArtists = track.artists
                .map((a) => a.replace(/\s*\(\d+\)\s*$/, ""))
                .filter((a) => a.length > 0);
              return (
                <Box
                  key={`${track.position}-${index}`}
                  data-testid={`rotation-track-option-${index}`}
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
                      backgroundColor: highlightIndex === index ? "primary.700" : "neutral.800",
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
                      color: highlightIndex === index ? "neutral.300" : "text.tertiary",
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
                          color: highlightIndex === index ? "neutral.300" : "text.tertiary",
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
              data-testid="rotation-track-manual"
              onClick={() => { onManualEntry(); setOpen(false); }}
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
                  highlightIndex === tracks.length ? "primary.700" : "transparent",
                "&:hover": {
                  backgroundColor: highlightIndex === tracks.length ? "primary.700" : "neutral.800",
                },
              }}
              onMouseEnter={() => setHighlightIndex(tracks.length)}
            >
              <Typography
                level="body-sm"
                sx={{
                  fontStyle: "italic",
                  opacity: 0.7,
                  color: highlightIndex === tracks.length ? "white" : "inherit",
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
