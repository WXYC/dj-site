"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { sortRotationReleases } from "@/lib/features/rotation/sort";
import { KeyboardArrowDown } from "@mui/icons-material";
import { Box, Input, Sheet, Typography } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useMemo, useRef, useState } from "react";

function matchesQuery(release: AlbumEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    release.artist.name.toLowerCase().includes(q) ||
    release.title.toLowerCase().includes(q)
  );
}

export default function RotationReleaseDropdown({
  releases,
  selectedRelease,
  onSelectRelease,
  disabled,
}: {
  releases: AlbumEntry[];
  selectedRelease: AlbumEntry | null;
  onSelectRelease: (release: AlbumEntry) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);

  const visibleReleases = useMemo(() => {
    const sorted = sortRotationReleases(releases);
    return query ? sorted.filter((r) => matchesQuery(r, query)) : sorted;
  }, [releases, query]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setOpen((prev) => {
        const next = !prev;
        // Reset filter every time the dropdown reopens so the DJ doesn't see
        // stale results from a prior pick.
        if (next) setQuery("");
        return next;
      });
      setHighlightIndex(-1);
    }
  }, [disabled]);

  const handleSelect = useCallback(
    (release: AlbumEntry) => {
      onSelectRelease(release);
      setOpen(false);
      setQuery("");
    },
    [onSelectRelease]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          setQuery("");
          setHighlightIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setHighlightIndex((prev) =>
            Math.min(prev + 1, visibleReleases.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (
            highlightIndex >= 0 &&
            highlightIndex < visibleReleases.length
          ) {
            handleSelect(visibleReleases[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
          break;
      }
    },
    [open, visibleReleases, highlightIndex, handleSelect]
  );

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box
        sx={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}
        onKeyDown={handleKeyDown}
      >
        <Box
          ref={triggerRef}
          tabIndex={disabled ? -1 : 0}
          data-testid="rotation-release-trigger"
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
          {selectedRelease ? (
            <Typography
              level="body-sm"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <Typography component="span" sx={{ fontWeight: "bold" }}>
                {selectedRelease.artist.name}
              </Typography>
              {" \u2014 "}
              {selectedRelease.title}
            </Typography>
          ) : (
            <Typography
              level="body-sm"
              sx={{ opacity: 0.5 }}
            >
              Select Release...
            </Typography>
          )}
          <KeyboardArrowDown
            sx={{
              fontSize: "1rem",
              ml: 0.5,
              flexShrink: 0,
              transition: "transform 0.2s",
              transform: open ? "rotate(180deg)" : "none",
            }}
          />
        </Box>

        {open && (
          <Sheet
            variant="outlined"
            data-testid="rotation-release-panel"
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
            <Box sx={{ px: 1, pb: 0.5 }}>
              <Input
                size="sm"
                autoFocus
                placeholder="Search artist or album..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightIndex(0);
                }}
                slotProps={{
                  input: {
                    "data-testid": "rotation-release-search",
                  },
                }}
              />
            </Box>
            {releases.length === 0 ? (
              <Box sx={{ p: 2, textAlign: "center" }}>
                <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                  No releases in this bin
                </Typography>
              </Box>
            ) : visibleReleases.length === 0 ? (
              <Box sx={{ p: 2, textAlign: "center" }}>
                <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                  No releases match &ldquo;{query}&rdquo;
                </Typography>
              </Box>
            ) : (
              visibleReleases.map((release, index) => (
                <Box
                  key={release.id}
                  data-testid={`rotation-release-option-${release.id}`}
                  onClick={() => handleSelect(release)}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    px: 1.5,
                    py: 0.75,
                    cursor: "pointer",
                    backgroundColor:
                      highlightIndex === index
                        ? "primary.700"
                        : selectedRelease?.id === release.id
                          ? "neutral.800"
                          : "transparent",
                    "&:hover": {
                      backgroundColor:
                        highlightIndex === index ? "primary.700" : "neutral.800",
                    },
                  }}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <Typography
                    level="body-sm"
                    sx={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: highlightIndex === index ? "white" : "inherit",
                    }}
                  >
                    <Typography
                      component="span"
                      sx={{ fontWeight: "bold" }}
                    >
                      {release.artist.name}
                    </Typography>
                    {" \u2014 "}
                    {release.title}
                  </Typography>
                  <Typography
                    level="body-xs"
                    sx={{
                      opacity: 0.6,
                      color: highlightIndex === index ? "neutral.300" : "text.tertiary",
                    }}
                  >
                    {release.label}
                  </Typography>
                </Box>
              ))
            )}
          </Sheet>
        )}
      </Box>
    </ClickAwayListener>
  );
}
