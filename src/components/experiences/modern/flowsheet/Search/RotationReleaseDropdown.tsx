"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { sortRotationReleases } from "@/lib/features/rotation/sort";
import { KeyboardArrowDown } from "@mui/icons-material";
import { Box, Input, Sheet, Typography } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useMemo, useRef, useState } from "react";

function formatRelease(release: AlbumEntry): string {
  return `${release.artist.name} — ${release.title}`;
}

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
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleReleases = useMemo(() => {
    const sorted = sortRotationReleases(releases);
    return query ? sorted.filter((r) => matchesQuery(r, query)) : sorted;
  }, [releases, query]);

  // While the panel is open the input mirrors the live filter query (which
  // starts empty so the DJ can see every release). While closed it mirrors
  // the parent-owned selection so the picker reads "Artist — Title" at rest.
  const displayValue = open
    ? query
    : selectedRelease
      ? formatRelease(selectedRelease)
      : "";

  const openPanel = useCallback(() => {
    if (disabled) return;
    // Idempotent: if the panel is already open, do not stomp on the live
    // filter state. Clicking inside an already-focused input fires `onClick`
    // again, so a non-idempotent reset would wipe the DJ's in-progress filter
    // mid-edit (typed "ste", clicked to reposition caret, panel resets to
    // showing every release).
    if (open) return;
    setOpen(true);
    setQuery("");
    setHighlightIndex(0);
  }, [disabled, open]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlightIndex(-1);
  }, []);

  const handleSelect = useCallback(
    (release: AlbumEntry) => {
      onSelectRelease(release);
      closePanel();
    },
    [onSelectRelease, closePanel]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPanel();
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) =>
            Math.min(prev + 1, visibleReleases.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (
            highlightIndex >= 0 &&
            highlightIndex < visibleReleases.length
          ) {
            handleSelect(visibleReleases[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closePanel();
          inputRef.current?.blur();
          break;
      }
    },
    [open, openPanel, closePanel, visibleReleases, highlightIndex, handleSelect]
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
          disabled={disabled}
          placeholder="Select Release..."
          value={displayValue}
          onFocus={openPanel}
          // Clicking an already-focused input doesn't refire onFocus; an
          // idempotent reopen on click handles that case (and is a no-op if
          // the panel is already open).
          onClick={openPanel}
          onChange={(e) => {
            if (!open) openPanel();
            setQuery(e.target.value);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
          endDecorator={
            <KeyboardArrowDown
              sx={{
                fontSize: "1rem",
                transition: "transform 0.2s",
                transform: open ? "rotate(180deg)" : "none",
                opacity: disabled ? 0.4 : 0.7,
              }}
            />
          }
          // Sit flat inside the parent search row's square frame — no border,
          // no radius, no background tint. The trigger should read as part of
          // the row's chrome, not as a nested control.
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
              "data-testid": "rotation-release-combobox",
              autoComplete: "off",
              spellCheck: false,
            },
          }}
        />

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
                  // `onMouseDown` preventDefault keeps focus on the input so
                  // the ClickAway / blur path doesn't close the panel before
                  // the option's `onClick` selection handler runs.
                  onMouseDown={(e) => e.preventDefault()}
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
                        highlightIndex === index
                          ? "primary.700"
                          : "neutral.800",
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
                    <Typography component="span" sx={{ fontWeight: "bold" }}>
                      {release.artist.name}
                    </Typography>
                    {" — "}
                    {release.title}
                  </Typography>
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
