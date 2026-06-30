"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  useFlowsheetActions,
  useFlowsheetSearch,
  useFlowsheetSubmit,
} from "@/src/hooks/flowsheetHooks";
import { useGhostText } from "@/src/hooks/useGhostText";
import { PlayArrow, QueueMusic, Troubleshoot } from "@mui/icons-material";
import { Box, Button, Divider, FormControl, Stack, useTheme } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useEffect, useRef } from "react";
import BreakpointButton from "./BreakpointButton";
import FlowsheetSearchInput from "./FlowsheetSearchInput";
import { MAX_VISIBLE_RESULTS } from "./Results/BackendResults/FlowsheetBackendResults";
import FlowsheetSearchResults from "./Results/FlowsheetSearchResults";
import RotationEntryFields from "./RotationEntryFields";
import RotationModeToggle from "./RotationModeToggle";
import TalksetButton from "./TalksetButton";

export default function FlowsheetSearchbar() {
  const theme = useTheme();

  const dispatch = useAppDispatch();

  const {
    ctrlKeyPressed,
    handleSubmit,
    binResults,
    catalogResults,
    rotationResults,
    lmlResults,
  } = useFlowsheetSubmit();

  const { addToFlowsheet } = useFlowsheetActions();

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

  // Remember the album/label we auto-filled from a track suggestion so we can
  // keep them in sync as the song narrows, without ever clobbering a value the
  // DJ typed themselves.
  const autoFilledAlbumRef = useRef<string | null>(null);
  const autoFilledLabelRef = useRef<string | null>(null);

  // Ghost text for artist field
  const artistGhost = useGhostText(
    "artist",
    searchQuery.artist as string
  );

  // Ghost text for song field (filtered by confirmed artist)
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
      // Auto-fill album and label from the track result
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
        <FlowsheetSearchResults
          binResults={binResults}
          catalogResults={catalogResults}
          rotationResults={rotationResults}
          lmlResults={lmlResults}
        />
        <Stack direction="row" spacing={0.5} alignItems="center">
          <BreakpointButton />
          <TalksetButton />
          <RotationModeToggle />
          <Box
            ref={searchRef}
            component="form"
            onSubmit={handleFormSubmit}
            data-testid="flowsheet-search-form"
            sx={{
              display: "flex",
              justifyContent: "space-between",
              flexDirection: "row",
              flexGrow: 1,
              minWidth: 0,
              zIndex: 8001,
              background: "transparent",
              outline: "1px solid",
              outlineColor: theme.palette.neutral.outlinedBorder,
              borderRadius: "8px",
              alignItems: "center",
              minHeight: "2rem",
              paddingInline: rotationMode ? "0" : "0.5rem",
              cursor: live ? "text" : "default",
              "& input": {
                background: "transparent !important",
                outline: "none !important",
                border: "none !important",
                fontFamily: "inherit !important",
                minWidth: "0 !important",
                px: 1,
                flex: 1,
                minHeight: 0,
                height: "1.5rem",
                cursor: live ? "text" : "default",
              },
              "&:hover": {
                outlineColor: live
                  ? theme.palette.neutral["700"]
                  : theme.palette.neutral.outlinedBorder,
              },
              "&:focus-within": {
                outline: "2px solid",
                outlineColor: ctrlKeyPressed
                  ? theme.palette.success["400"]
                  : theme.palette.primary["400"],
              },
            }}
            onClick={() =>
              live && artistRef.current?.focus()
            }
            onFocus={() => live && setSearchOpen(true)}
            suppressHydrationWarning
          >
            {!rotationMode && (
              <Box
                sx={{
                  marginInlineEnd: "0.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 0,
                  pointerEvents: "none",
                  "& svg": {
                    fill: "var(--wxyc-palette-neutral-400) !important",
                    pointerEvents: "none",
                  },
                }}
              >
                <Troubleshoot />
              </Box>
            )}
            {rotationMode ? (
              <RotationEntryFields disabled={!live} />
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
                <Divider orientation="vertical" />
                <FlowsheetSearchInput
                  name={"song"}
                  inputRef={songRef}
                  disabled={!live}
                  required={true}
                  ghostSuffix={songGhost.ghostSuffix}
                  onAcceptGhost={handleAcceptSongGhost}
                  suppressHydrationWarning
                />
                <Divider orientation="vertical" />
                <FlowsheetSearchInput
                  name={"album"}
                  inputRef={albumRef}
                  disabled={!live}
                  required={selectedResult == 0}
                  suppressHydrationWarning
                />
                <Divider orientation="vertical" />
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
              component="div"
              className="MuiInput-endDecorator"
              sx={{
                display: rotationMode && !searchOpen ? "none" : "flex",
                alignItems: "center",
                justifyContent: "center",
                mr: rotationMode ? 0.5 : -0.5,
                gap: 0.5,
              }}
            >
              {!searchOpen && <Divider orientation="vertical" />}
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
                  minHeight: "22px",
                  maxWidth: "22px !important",
                  borderRadius: "0.3rem",
                  "& > button": {
                    maxWidth: "12px !important",
                  },
                }}
              >
                {searchOpen ? (
                  ctrlKeyPressed ? (
                    <QueueMusic fontSize="small" />
                  ) : (
                    <PlayArrow fontSize="small" />
                  )
                ) : (
                  "/"
                )}
              </Button>
            </Box>
          </Box>
        </Stack>
      </FormControl>
    </ClickAwayListener>
  );
}
