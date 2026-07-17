"use client";

import { entryToFreezePayload } from "@/lib/features/flowsheet/conversions";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  useFlowsheetSearch,
  useFlowsheetSubmit,
} from "@/src/hooks/flowsheetHooks";
import { useGhostText } from "@/src/hooks/useGhostText";
import { Close, PlayArrow, QueueMusic } from "@mui/icons-material";
import { Box, Divider, IconButton, Sheet, Tooltip } from "@mui/joy";
import { ClickAwayListener, Popper, useMediaQuery } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Transition } from "react-transition-group";
import BreakpointButton from "./BreakpointButton";
import {
  ENTRY_BAR_CELL_PADDING_X,
  ENTRY_BAR_GRID_TEMPLATE,
  entryBarActiveBorder,
  entryPanelSx,
  sameWidth,
  withReducedMotion,
} from "./entryBarStyles";
import FlowsheetSearchInput from "./FlowsheetSearchInput";
import { MAX_VISIBLE_RESULTS } from "./Results/BackendResults/FlowsheetBackendResults";
import FlowsheetSearchResults from "./Results/FlowsheetSearchResults";
import RotationEntryFields from "./RotationEntryFields";
import RotationModeToggle from "./RotationModeToggle";
import TalksetButton from "./TalksetButton";

export default function FlowsheetSearchbar() {
  const dispatch = useAppDispatch();

  const {
    ctrlKeyPressed,
    handleSubmit,
    submitToQueue,
    binResults,
    catalogResults,
    rotationResults,
    lmlResults,
    selectedEntry,
  } = useFlowsheetSubmit();

  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );

  const rotationMode = useAppSelector(flowsheetSlice.selectors.getRotationMode);
  // Composing = any query field set (covers typed searches and rotation
  // picks, whose rotation_bin/album_id land in the query too).
  const searchQueryLength = useAppSelector(
    flowsheetSlice.selectors.getSearchQueryLength
  );
  const resetEpoch = useAppSelector(flowsheetSlice.selectors.getResetEpoch);

  const {
    live,
    searchOpen,
    setSearchOpen,
    resetSearch,
    searchQuery,
    setSearchProperty,
    getDisplayValue,
  } = useFlowsheetSearch();

  const thawSelection = useCallback(() => {
    if (!selectedEntry) return;
    dispatch(
      flowsheetSlice.actions.freezeSelectionToQuery(
        entryToFreezePayload(selectedEntry)
      )
    );
  }, [selectedEntry, dispatch]);

  const highlightFills = selectedResult > 0 && selectedEntry !== null;
  const autoFilled = {
    artist: highlightFills && Boolean(selectedEntry?.artist?.name),
    album: highlightFills && Boolean(selectedEntry?.title),
    label: highlightFills && Boolean(selectedEntry?.label),
  };

  const confirmedArtist = useAppSelector(
    flowsheetSlice.selectors.getConfirmedArtist
  );
  const searchRef = useRef<HTMLFormElement>(null);
  const artistRef = useRef<HTMLInputElement>(null);
  const songRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)"
  );

  // Remember the album/label we auto-filled from a track suggestion so we can
  // keep them in sync as the song narrows, without ever clobbering a value the
  // DJ typed themselves.
  const autoFilledAlbumRef = useRef<string | null>(null);
  const autoFilledLabelRef = useRef<string | null>(null);

  const artistGhost = useGhostText(
    "artist",
    searchQuery.artist as string
  );

  const songGhost = useGhostText(
    "song",
    searchQuery.song as string,
    confirmedArtist
  );

  // Album/label have no suggest endpoint — the live results are the source.
  // First prefix-match wins, in the same order the panel renders.
  const orderedResults = useMemo(
    () => [...binResults, ...rotationResults, ...catalogResults, ...lmlResults],
    [binResults, rotationResults, catalogResults, lmlResults]
  );
  const albumSuggestion = useMemo(() => {
    const typed = ((searchQuery.album as string) ?? "").toLowerCase();
    if (!typed) return null;
    return (
      orderedResults.find((r) =>
        r.title?.toLowerCase().startsWith(typed)
      )?.title ?? null
    );
  }, [orderedResults, searchQuery.album]);
  const labelSuggestion = useMemo(() => {
    const typed = ((searchQuery.label as string) ?? "").toLowerCase();
    if (!typed) return null;
    return (
      orderedResults.find((r) =>
        r.label?.toLowerCase().startsWith(typed)
      )?.label ?? null
    );
  }, [orderedResults, searchQuery.label]);

  const albumGhost = useGhostText(
    "album",
    searchQuery.album as string,
    undefined,
    albumSuggestion
  );
  const labelGhost = useGhostText(
    "label",
    searchQuery.label as string,
    undefined,
    labelSuggestion
  );

  const handleAcceptArtistGhost = useCallback(() => {
    const fullArtist = artistGhost.acceptGhostText();
    if (fullArtist) {
      setSearchProperty("artist", fullArtist);
      dispatch(flowsheetSlice.actions.setConfirmedArtist(fullArtist));
      songRef.current?.focus();
    }
  }, [artistGhost, setSearchProperty, dispatch]);

  const handleAcceptSongGhost = useCallback(() => {
    const fullSong = songGhost.acceptGhostText();
    if (fullSong) {
      setSearchProperty("song", fullSong);
      if (songGhost.trackResult?.album_title) {
        setSearchProperty("album", songGhost.trackResult.album_title);
      }
      if (songGhost.trackResult?.record_label) {
        setSearchProperty("label", songGhost.trackResult.record_label);
      }
      albumRef.current?.focus();
    }
  }, [songGhost, setSearchProperty]);

  const handleAcceptAlbumGhost = useCallback(() => {
    const fullAlbum = albumGhost.acceptGhostText();
    if (fullAlbum) {
      setSearchProperty("album", fullAlbum);
      labelRef.current?.focus();
    }
  }, [albumGhost, setSearchProperty]);

  const handleAcceptLabelGhost = useCallback(() => {
    const fullLabel = labelGhost.acceptGhostText();
    if (fullLabel) {
      setSearchProperty("label", fullLabel);
    }
  }, [labelGhost, setSearchProperty]);

  // When artist field loses focus, confirm the artist for song suggestions
  const handleArtistBlur = useCallback(() => {
    const currentArtist = searchQuery.artist as string;
    if (currentArtist && currentArtist !== confirmedArtist) {
      dispatch(flowsheetSlice.actions.setConfirmedArtist(currentArtist));
    }
  }, [searchQuery.artist, confirmedArtist, dispatch]);

  // Auto-populate album + label from the confident track suggestion as the song
  // narrows to a match — without requiring the DJ to press Tab. A field is only
  // (re)filled while it is empty or still holds the value we last auto-filled,
  // so a manually typed album/label is never overwritten.
  useEffect(() => {
    const track = songGhost.trackResult;
    if (!track) return;

    const album = (searchQuery.album as string) ?? "";
    if (
      track.album_title &&
      (album === "" || album === autoFilledAlbumRef.current)
    ) {
      if (album !== track.album_title) {
        setSearchProperty("album", track.album_title);
      }
      autoFilledAlbumRef.current = track.album_title;
    }

    const label = (searchQuery.label as string) ?? "";
    if (
      track.record_label &&
      (label === "" || label === autoFilledLabelRef.current)
    ) {
      if (label !== track.record_label) {
        setSearchProperty("label", track.record_label);
      }
      autoFilledLabelRef.current = track.record_label;
    }
  }, [
    songGhost.trackResult,
    searchQuery.album,
    searchQuery.label,
    setSearchProperty,
  ]);

  // Forget what we auto-filled once the search resets (a new entry begins), so
  // the auto-fill memory can't outlive its session and later overwrite an
  // album/label the DJ types by hand. resetSearch clears artist + song, so an
  // empty artist-and-song is the reset signal shared by every reset path (the
  // ClickAway close here and the post-submit resets in useFlowsheetSubmit).
  useEffect(() => {
    if (!searchQuery.artist && !searchQuery.song) {
      autoFilledAlbumRef.current = null;
      autoFilledLabelRef.current = null;
    }
  }, [searchQuery.artist, searchQuery.song]);

  const handleClose = useCallback(
    (event: any) => {
      resetSearch();
      searchRef.current?.querySelector("input")?.blur();
    },
    [searchRef.current]
  );

  // Latest-ref: the document listener reads volatile state through a ref so
  // the callback stays stable and the listener isn't torn down and re-added
  // on every keystroke/results change.
  const keyNavRef = useRef({
    live,
    searchOpen,
    rotationMode,
    selectedResult,
    visibleTotal: 0,
  });
  useEffect(() => {
    keyNavRef.current = {
      live,
      searchOpen,
      rotationMode,
      selectedResult,
      // Bound by the VISIBLE rows: each section paints at most
      // MAX_VISIBLE_RESULTS, so the bound must use the capped lengths or the
      // highlight walks off the rendered list onto rows the cap hid.
      visibleTotal:
        Math.min(binResults.length, MAX_VISIBLE_RESULTS) +
        Math.min(catalogResults.length, MAX_VISIBLE_RESULTS) +
        Math.min(rotationResults.length, MAX_VISIBLE_RESULTS) +
        Math.min(lmlResults.length, MAX_VISIBLE_RESULTS),
    };
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const nav = keyNavRef.current;
      if (e.key === "/") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (!nav.live) return;
        artistRef.current?.focus();
      }
      if (e.key === "ArrowDown" && nav.searchOpen && !nav.rotationMode) {
        e.preventDefault();
        const nextIndex = Math.min(nav.selectedResult + 1, nav.visibleTotal);
        dispatch(flowsheetSlice.actions.setSelectedResult(nextIndex));
      }
      if (e.key === "ArrowUp" && nav.searchOpen && !nav.rotationMode) {
        e.preventDefault();
        const prevIndex = Math.max(nav.selectedResult - 1, 0);
        dispatch(flowsheetSlice.actions.setSelectedResult(prevIndex));
      }
    },
    [dispatch]
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void handleSubmit(e);
    },
    [handleSubmit]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const panelOpen = searchOpen && !rotationMode;
  const activeBorder = entryBarActiveBorder(searchOpen, ctrlKeyPressed);
  // Rotation picks live in RotationEntryFields' local state, invisible to the query-length signal
  const showClear = rotationMode || searchQueryLength > 0;

  return (
    <ClickAwayListener onClickAway={handleClose}>
      {/* Not a Joy FormControl — it warns when multiple Joy controls register */}
      <Box
        data-testid="flowsheet-entry-bar"
        sx={{
          // No flex-grow: inside MainContent's 100dvh column this control
          // must never absorb leftover viewport height (see the regression
          // test in FlowsheetSearchbar.test.tsx).
          position: "relative",
          width: "100%",
          minWidth: 0,
          flexShrink: 0,
          alignSelf: "flex-start",
          gap: 0,
        }}
      >
        <Sheet
          ref={setAnchorEl}
          variant="outlined"
          sx={{
            borderRadius: "md",
            flexShrink: 0,
            bgcolor: "background.level1",
            borderColor: activeBorder,
            ...withReducedMotion({ transition: "border-color 0.15s" }),
            "&:hover": {
              borderColor:
                live && !searchOpen ? "neutral.500" : undefined,
            },
            // While the panel is open, square the bottom and hide the border
            // line between the shell and the panel so the active outline flows
            // down into the results box as one continuous shape.
            ...(panelOpen
              ? {
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  borderBottomColor: "transparent",
                }
              : {}),
          }}
        >
          <Box
            ref={searchRef}
            component="form"
            onSubmit={handleFormSubmit}
            data-testid="flowsheet-search-form"
            sx={{
              // Mirrors the entries table's column template (see entryBarStyles)
              display: "grid",
              gridTemplateColumns: ENTRY_BAR_GRID_TEMPLATE,
              alignItems: "stretch",
              minWidth: 0,
              minHeight: "2.75rem",
              cursor: live ? "text" : "default",
              // Set here (not on the inputs) so the ghost-text spans inherit
              // the same metrics as the inputs
              fontSize: "var(--wxyc-fontSize-md)",
              "& input": {
                background: "transparent !important",
                outline: "none !important",
                border: "none !important",
                fontFamily: "inherit !important",
                fontSize: "inherit",
                minWidth: "0 !important",
                flex: 1,
                minHeight: 0,
                height: "2.75rem",
                cursor: live ? "text" : "default",
              },
              "& .entry-field-cell": {
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: "8px",
                  bottom: "8px",
                  width: "1px",
                  bgcolor: "divider",
                },
              },
            }}
            onClick={() => live && !rotationMode && artistRef.current?.focus()}
            onFocus={() => live && setSearchOpen(true)}
            suppressHydrationWarning
          >
            <Box
              sx={{
                display: { xs: "none", sm: "flex" },
                alignItems: "center",
                justifyContent: "center",
                minHeight: 0,
              }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
            >
              <RotationModeToggle />
            </Box>
            {rotationMode ? (
              <Box
                className="entry-field-cell"
                sx={{
                  gridColumn: { xs: "1 / -2", sm: "2 / -2" },
                  display: "flex",
                  alignItems: "center",
                  minWidth: 0,
                  position: "relative",
                }}
              >
                <RotationEntryFields key={resetEpoch} disabled={!live} />
              </Box>
            ) : (
              <>
                <FlowsheetSearchInput
                  name={"artist"}
                  value={getDisplayValue("artist")}
                  isAutoFilled={autoFilled.artist}
                  onThaw={thawSelection}
                  inputRef={artistRef}
                  disabled={!live}
                  ghostSuffix={artistGhost.ghostSuffix}
                  onAcceptGhost={handleAcceptArtistGhost}
                  onBlur={handleArtistBlur}
                  suppressHydrationWarning
                />
                <FlowsheetSearchInput
                  name={"song"}
                  value={getDisplayValue("song")}
                  inputRef={songRef}
                  disabled={!live}
                  required={true}
                  ghostSuffix={songGhost.ghostSuffix}
                  onAcceptGhost={handleAcceptSongGhost}
                  suppressHydrationWarning
                />
                <FlowsheetSearchInput
                  name={"album"}
                  value={getDisplayValue("album")}
                  isAutoFilled={autoFilled.album}
                  onThaw={thawSelection}
                  inputRef={albumRef}
                  disabled={!live}
                  ghostSuffix={albumGhost.ghostSuffix}
                  onAcceptGhost={handleAcceptAlbumGhost}
                  suppressHydrationWarning
                />
                <FlowsheetSearchInput
                  name={"label"}
                  value={getDisplayValue("label")}
                  isAutoFilled={autoFilled.label}
                  onThaw={thawSelection}
                  inputRef={labelRef}
                  disabled={!live}
                  ghostSuffix={labelGhost.ghostSuffix}
                  onAcceptGhost={handleAcceptLabelGhost}
                  suppressHydrationWarning
                />
              </>
            )}
            <input type="submit" hidden />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 0.5,
                pr: 1,
                minWidth: 0,
              }}
              // Button interactions must not bubble into the form's
              // open-search focus/click handlers
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
            >
              {showClear && (
                <>
                  <Tooltip
                    placement="top"
                    size="sm"
                    variant="outlined"
                    title="Clear entry"
                  >
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      disabled={!live}
                      data-testid="flowsheet-search-clear"
                      onClick={() => {
                        resetSearch();
                        if (!rotationMode) artistRef.current?.focus();
                      }}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Divider orientation="vertical" sx={{ my: 1 }} />
                </>
              )}
              {searchQueryLength === 0 ? (
                <>
                  <BreakpointButton />
                  <TalksetButton />
                </>
              ) : (
                <>
                  <Tooltip
                    placement="top"
                    size="sm"
                    variant="outlined"
                    title="Add to queue (Ctrl+Enter)"
                  >
                    <IconButton
                      size="sm"
                      variant="soft"
                      color="success"
                      disabled={!live}
                      data-testid="flowsheet-search-queue"
                      onClick={() => submitToQueue()}
                    >
                      <QueueMusic fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip
                    placement="top"
                    size="sm"
                    variant="outlined"
                    title="Play now (Enter)"
                  >
                    <IconButton
                      size="sm"
                      variant="solid"
                      color={ctrlKeyPressed ? "success" : "primary"}
                      disabled={!live}
                      data-testid="flowsheet-search-submit"
                      onClick={() => searchRef.current?.requestSubmit()}
                    >
                      <PlayArrow fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>
        </Sheet>
        <Popper
          open={panelOpen && Boolean(anchorEl)}
          anchorEl={anchorEl}
          placement="bottom-start"
          disablePortal
          transition
          // Sit flush below the shell (which hides its bottom border) so the
          // two read as one continuous outlined shape.
          modifiers={[sameWidth, { name: "offset", options: { offset: [0, 0] } }]}
          style={{ zIndex: 1300 }}
        >
          {({ TransitionProps }) => (
            <Transition
              {...TransitionProps}
              nodeRef={panelRef}
              appear
              timeout={prefersReducedMotion ? 0 : 180}
            >
              {(status) => (
                <Box
                  ref={panelRef}
                  // CSS-only enter/exit — MUI Material transitions (Grow)
                  // crash here because the app provides a Joy theme with no
                  // theme.transitions. Scale + fade from the top edge.
                  sx={{
                    transformOrigin: "top center",
                    transition: prefersReducedMotion
                      ? "none"
                      : "opacity 180ms ease, transform 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                    opacity:
                      status === "entering" || status === "entered" ? 1 : 0,
                    transform:
                      status === "entering" || status === "entered"
                        ? "scaleY(1)"
                        : "scaleY(0.97)",
                  }}
                >
                  <Sheet variant="outlined" sx={entryPanelSx(activeBorder)}>
                    <FlowsheetSearchResults
                      binResults={binResults}
                      catalogResults={catalogResults}
                      rotationResults={rotationResults}
                      lmlResults={lmlResults}
                    />
                  </Sheet>
                </Box>
              )}
            </Transition>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
