"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector, useAppStore } from "@/lib/hooks";
import {
  useFlowsheetSearch,
  useFlowsheetSubmit,
} from "@/src/hooks/flowsheetHooks";
import { useDocumentKeydown } from "@/src/hooks/useDocumentKeydown";
import { useGhostText } from "@/src/hooks/useGhostText";
import { PlayArrow, QueueMusic, Troubleshoot } from "@mui/icons-material";
import { Box, Button, Divider, FormControl, Sheet, Stack } from "@mui/joy";
import { useCallback, useRef } from "react";
import BreakpointButton from "./BreakpointButton";
import FlowsheetSearchSegment from "./FlowsheetSearchSegment";
import {
  useFlowsheetAllResults,
} from "./FlowsheetSearchProvider";
import FlowsheetResultsListbox from "./Results/FlowsheetResultsListbox";
import MobileFlowsheetEntry from "./MobileFlowsheetEntry";
import ScopeControl from "./ScopeControl";
import TalksetButton from "./TalksetButton";
import TrackCombobox from "./TrackCombobox";
import {
  flowsheetSearchShellSx,
  flowsheetSegmentGridSx,
  flowsheetSegmentSx,
  flowsheetSubmitButtonSx,
} from "./flowsheetSearchBarStyles";

export default function FlowsheetSearchbar() {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  const {
    ctrlKeyPressed,
    handleSubmit,
  } = useFlowsheetSubmit();

  const { live, searchOpen, setSearchOpen, resetSearch, searchQuery, setSearchProperty } =
    useFlowsheetSearch();

  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );
  const scope = useAppSelector(flowsheetSlice.selectors.getSearchScope);
  const stagedRelease = useAppSelector(flowsheetSlice.selectors.getStagedRelease);
  const confirmedArtist = useAppSelector(
    flowsheetSlice.selectors.getConfirmedArtist
  );

  const allResults = useFlowsheetAllResults();

  const searchRef = useRef<HTMLFormElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const artistRef = useRef<HTMLInputElement>(null);
  const songRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const flushersRef = useRef<(() => void)[]>([]);

  const registerFlusher = useCallback((flush: () => void) => {
    if (!flushersRef.current.includes(flush)) {
      flushersRef.current.push(flush);
    }
  }, []);

  const artistGhost = useGhostText("artist", searchQuery.artist as string);
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
    }
  }, [songGhost, setSearchProperty]);

  const handleArtistBlur = useCallback(() => {
    const currentArtist = searchQuery.artist as string;
    if (currentArtist && currentArtist !== confirmedArtist) {
      dispatch(flowsheetSlice.actions.setConfirmedArtist(currentArtist));
    }
  }, [searchQuery.artist, confirmedArtist, dispatch]);

  const stageRelease = useCallback(
    (entry: AlbumEntry) => {
      dispatch(
        flowsheetSlice.actions.stageRelease({
          album_id: entry.id > 0 ? entry.id : undefined,
          rotation_id: entry.rotation_id,
          rotation_bin: entry.rotation_bin,
          artist: entry.artist?.name ?? "",
          album: entry.title ?? "",
          label: entry.label ?? "",
        })
      );
      songRef.current?.focus();
    },
    [dispatch]
  );

  const stageHighlightedRelease = useCallback(() => {
    if (selectedResult <= 0) return;
    const entry = allResults[selectedResult - 1];
    if (entry) stageRelease(entry);
  }, [selectedResult, allResults, stageRelease]);

  const totalResults =
    allResults.length;

  const moveHighlight = useCallback(
    (delta: number) => {
      const max = totalResults;
      let next = selectedResult + delta;
      if (next < 0) next = max;
      if (next > max) next = 0;
      dispatch(flowsheetSlice.actions.setSelectedResult(next));
    },
    [dispatch, selectedResult, totalResults]
  );

  useDocumentKeydown((e) => {
    if (e.key === "/") {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      if (!live) return;
      artistRef.current?.focus();
    }
    if (e.key === "?" && !(e.target as HTMLElement)?.closest("input")) {
      e.preventDefault();
    }
  });

  const handleBarKeyDown = (e: React.KeyboardEvent) => {
    if (scope === "rotation") return;

    switch (e.key) {
      case "Escape":
        if (searchOpen) {
          setSearchOpen(false);
        } else if (stagedRelease) {
          dispatch(flowsheetSlice.actions.unstageRelease());
        } else {
          resetSearch();
        }
        e.preventDefault();
        break;
      case "ArrowDown":
        if (!searchOpen) setSearchOpen(true);
        else moveHighlight(1);
        e.preventDefault();
        break;
      case "ArrowUp":
        if (searchOpen) moveHighlight(-1);
        e.preventDefault();
        break;
      case "Enter":
        if (searchOpen && selectedResult > 0 && !stagedRelease) {
          e.preventDefault();
          stageHighlightedRelease();
        }
        break;
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    flushersRef.current.forEach((flush) => flush());
    const committed = flowsheetSlice.selectors.getSearchQuery(store.getState());
    void handleSubmit(e, committed);
  };

  const barContent = (
    <FormControl size="sm" sx={{ flex: 1, minWidth: 0 }}>
      <FlowsheetResultsListbox
        anchorEl={shellRef.current}
        onStageRelease={stageRelease}
      />
      <Stack direction="row" spacing={0.5} alignItems="center">
        <BreakpointButton />
        <TalksetButton />
        <ScopeControl disabled={!live} />
        <Sheet
          ref={(el) => {
            if (el instanceof HTMLFormElement) {
              searchRef.current = el;
              shellRef.current = el;
            }
          }}
          component="form"
          onSubmit={handleFormSubmit}
          data-testid="flowsheet-search-form"
          onKeyDown={handleBarKeyDown}
          onClick={() => live && artistRef.current?.focus()}
          onFocus={() => live && setSearchOpen(true)}
          sx={{
            ...flowsheetSearchShellSx,
            cursor: live ? "text" : "default",
            "&:focus-within": {
              borderColor: ctrlKeyPressed ? "success.400" : "primary.400",
              boxShadow: ctrlKeyPressed
                ? "0 0 0 1px var(--joy-palette-success-400)"
                : "0 0 0 1px var(--joy-palette-primary-400)",
            },
          }}
          suppressHydrationWarning
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              marginInlineEnd: "0.5rem",
              color: "text.tertiary",
              pointerEvents: "none",
              "& svg": { fill: "var(--wxyc-palette-neutral-400)" },
            }}
          >
            <Troubleshoot />
          </Box>
          <Box sx={flowsheetSegmentGridSx}>
            <FlowsheetSearchSegment
              name="artist"
              label="Artist"
              inputRef={artistRef}
              required={selectedResult === 0}
              disabled={!live}
              ghostSuffix={artistGhost.ghostSuffix}
              onAcceptGhost={handleAcceptArtistGhost}
              onBlur={handleArtistBlur}
              searchOpen={searchOpen}
              selectedResult={selectedResult}
              registerFlusher={registerFlusher}
            />
            <Divider orientation="vertical" />
            {stagedRelease && stagedRelease.album_id && stagedRelease.album_id > 0 ? (
              <Box sx={flowsheetSegmentSx}>
                <TrackCombobox
                  albumId={stagedRelease.album_id}
                  disabled={!live}
                  inputRef={songRef}
                />
              </Box>
            ) : (
              <FlowsheetSearchSegment
                name="song"
                label="Song"
                inputRef={songRef}
                disabled={!live}
                required
                ghostSuffix={songGhost.ghostSuffix}
                onAcceptGhost={handleAcceptSongGhost}
                searchOpen={searchOpen}
                selectedResult={selectedResult}
                registerFlusher={registerFlusher}
              />
            )}
            <Divider orientation="vertical" />
            <FlowsheetSearchSegment
              name="album"
              label="Album"
              inputRef={albumRef}
              disabled={!live}
              required={selectedResult === 0}
              searchOpen={searchOpen}
              selectedResult={selectedResult}
              registerFlusher={registerFlusher}
            />
            <Divider orientation="vertical" />
            <FlowsheetSearchSegment
              name="label"
              label="Label"
              inputRef={labelRef}
              disabled={!live}
              searchOpen={searchOpen}
              selectedResult={selectedResult}
              registerFlusher={registerFlusher}
            />
          </Box>
          <input type="submit" hidden />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mr: -0.5,
            }}
          >
            {!searchOpen && <Divider orientation="vertical" />}
            <Button
              type="button"
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
              sx={flowsheetSubmitButtonSx}
              onClick={() => {
                if (searchOpen) {
                  searchRef.current?.requestSubmit();
                } else {
                  artistRef.current?.focus();
                }
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
        </Sheet>
      </Stack>
    </FormControl>
  );

  return (
    <MobileFlowsheetEntry live={live}>
      {barContent}
    </MobileFlowsheetEntry>
  );
}
