"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  useFlowsheetSearch,
  useFlowsheetSubmit,
} from "@/src/hooks/flowsheetHooks";
import { useGhostText } from "@/src/hooks/useGhostText";
import { PlayArrow, QueueMusic } from "@mui/icons-material";
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  Sheet,
  Tooltip,
} from "@mui/joy";
import { ClickAwayListener, Popper, useMediaQuery } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
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
  } = useFlowsheetSubmit();

  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );

  const rotationMode = useAppSelector(flowsheetSlice.selectors.getRotationMode);

  const { live, searchOpen, setSearchOpen, resetSearch, searchQuery, setSearchProperty } =
    useFlowsheetSearch();

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "/") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (!live) return;
        artistRef.current?.focus();
      }
      if (e.key === "ArrowDown" && searchOpen && !rotationMode) {
        e.preventDefault();
        // Bound by the VISIBLE rows: each section paints at most
        // MAX_VISIBLE_RESULTS, so the bound must use the capped lengths or the
        // highlight walks off the rendered list onto rows the cap hid. (#657)
        const visibleTotal =
          Math.min(binResults.length, MAX_VISIBLE_RESULTS) +
          Math.min(catalogResults.length, MAX_VISIBLE_RESULTS) +
          Math.min(rotationResults.length, MAX_VISIBLE_RESULTS) +
          Math.min(lmlResults.length, MAX_VISIBLE_RESULTS);
        const nextIndex = Math.min(selectedResult + 1, visibleTotal);
        dispatch(flowsheetSlice.actions.setSelectedResult(nextIndex));
      }
      if (e.key === "ArrowUp" && searchOpen && !rotationMode) {
        e.preventDefault();
        const prevIndex = Math.max(selectedResult - 1, 0);
        dispatch(flowsheetSlice.actions.setSelectedResult(prevIndex));
      }
    },
    [
      live,
      dispatch,
      searchOpen,
      rotationMode,
      binResults,
      catalogResults,
      rotationResults,
      lmlResults,
      selectedResult,
    ]
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void handleSubmit(e);
    },
    [handleSubmit]
  );

  useEffect(() => {
    document.removeEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const panelOpen = searchOpen && !rotationMode;
  const activeBorder = entryBarActiveBorder(searchOpen, ctrlKeyPressed);

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <FormControl
        size="sm"
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
              // The field grid mirrors the entries table's column template so
              // each input sits over its column below (see entryBarStyles).
              display: "grid",
              gridTemplateColumns: ENTRY_BAR_GRID_TEMPLATE,
              alignItems: "stretch",
              minWidth: 0,
              minHeight: "2.75rem",
              cursor: live ? "text" : "default",
              "& input": {
                background: "transparent !important",
                outline: "none !important",
                border: "none !important",
                fontFamily: "inherit !important",
                fontSize: "var(--wxyc-fontSize-md)",
                minWidth: "0 !important",
                px: ENTRY_BAR_CELL_PADDING_X,
                flex: 1,
                minHeight: 0,
                height: "2.75rem",
                cursor: live ? "text" : "default",
              },
              // Field cells carry a left rule duplicating the outer outline,
              // reading as interior column borders of the "table header".
              "& .entry-field-cell": {
                borderLeft: "1px solid",
                borderColor: "neutral.outlinedBorder",
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
                }}
              >
                <RotationEntryFields disabled={!live} />
              </Box>
            ) : (
              <>
                <FlowsheetSearchInput
                  name={"artist"}
                  inputRef={artistRef}
                  required={selectedResult == 0}
                  disabled={!live}
                  ghostSuffix={artistGhost.ghostSuffix}
                  onAcceptGhost={handleAcceptArtistGhost}
                  onBlur={handleArtistBlur}
                  suppressHydrationWarning
                />
                <FlowsheetSearchInput
                  name={"song"}
                  inputRef={songRef}
                  disabled={!live}
                  required={true}
                  ghostSuffix={songGhost.ghostSuffix}
                  onAcceptGhost={handleAcceptSongGhost}
                  suppressHydrationWarning
                />
                <FlowsheetSearchInput
                  name={"album"}
                  inputRef={albumRef}
                  disabled={!live}
                  required={selectedResult == 0}
                  suppressHydrationWarning
                />
                <FlowsheetSearchInput
                  name={"label"}
                  inputRef={labelRef}
                  disabled={!live}
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
            >
              <BreakpointButton />
              <TalksetButton />
              <Divider orientation="vertical" sx={{ my: 1 }} />
              {searchOpen && (
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
              )}
              <Button
                size="sm"
                variant={searchOpen ? "solid" : "plain"}
                color={
                  searchOpen
                    ? ctrlKeyPressed
                      ? "success"
                      : "primary"
                    : "neutral"
                }
                disabled={!live}
                data-testid="flowsheet-search-submit"
                onClick={() => {
                  if (searchOpen) {
                    searchRef.current?.requestSubmit();
                  } else {
                    const input = artistRef.current;
                    if (input) {
                      input.value = "";
                      input.focus();
                    }
                  }
                }}
                sx={{
                  minHeight: "28px",
                  borderRadius: "0.3rem",
                }}
              >
                {searchOpen ? <PlayArrow fontSize="small" /> : "/"}
              </Button>
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
      </FormControl>
    </ClickAwayListener>
  );
}
