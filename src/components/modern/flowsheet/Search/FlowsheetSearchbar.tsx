"use client";

import { convertQueryToSubmission } from "@/lib/features/flowsheet/conversions";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useBinResults } from "@/src/hooks/binHooks";
import {
  useCatalogFlowsheetSearch,
  useRotationFlowsheetSearch,
} from "@/src/hooks/catalogHooks";
import { useFlowsheet, useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { Mic, Troubleshoot } from "@mui/icons-material";
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import BreakpointButton from "./BreakpointButton";
import FlowsheetSearchInput from "./FlowsheetSearchInput";
import FlowsheetSearchResults from "./Results/FlowsheetSearchResults";

export default function FlowsheetSearchbar() {
  const dispatch = useAppDispatch();

  const { searchResults: binResults } = useBinResults();
  const { searchResults: catalogResults } = useCatalogFlowsheetSearch();
  const { searchResults: rotationResults } = useRotationFlowsheetSearch();

  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );

  const [shiftKeyPressed, setShiftKeyPressed] = useState(false);

  const { live, setSearchOpen, resetSearch } = useFlowsheetSearch();
  const searchRef = useRef<HTMLDivElement>(null);

  const { addToFlowsheet } = useFlowsheet();

  const handleClose = useCallback(
    (event: MouseEvent | TouchEvent | React.FormEvent<HTMLFormElement>) => {
      resetSearch();
      searchRef.current?.querySelector("input")?.blur();
    },
    [searchRef.current]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        if (!live) return;
        searchRef.current?.querySelector("input")?.focus();
      }
      if (e.key === "Shift") {
        setShiftKeyPressed(true);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        let nextIndex = Math.min(
          selectedResult + 1,
          binResults.length + catalogResults.length + rotationResults.length
        );
        dispatch(flowsheetSlice.actions.setSelectedResult(nextIndex));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        let prevIndex = Math.max(selectedResult - 1, 0);
        dispatch(flowsheetSlice.actions.setSelectedResult(prevIndex));
      }
    },
    [
      live,
      dispatch,
      binResults,
      catalogResults,
      rotationResults,
      selectedResult,
    ]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "Shift") {
      setShiftKeyPressed(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleClose(e);

      const formData = Object.fromEntries(
        new FormData(e.currentTarget).entries()
      );
      let data: FlowsheetQuery;
      if (selectedResult == 0) {
        data = {
          song: formData.song as string,
          artist: formData.artist as string,
          album: formData.album as string,
          label: formData.label as string,
          request: false,
        };
      } else {
        const collectedResults = [
          binResults,
          rotationResults,
          catalogResults,
        ].flat();
        console.log("COLLECTED RESULTS", collectedResults);
        console.log("SELECTED RESULT", collectedResults[selectedResult - 1]);
        data = {
          song: formData.song as string,
          artist: collectedResults[selectedResult - 1].artist?.name ?? "",
          album: collectedResults[selectedResult - 1].title ?? "",
          label: collectedResults[selectedResult - 1].label ?? "",
          album_id: collectedResults[selectedResult - 1].id ?? undefined,
          play_freq:
            collectedResults[selectedResult - 1].play_freq ?? undefined,
          rotation_id:
            collectedResults[selectedResult - 1].rotation_id ?? undefined,
          request: false,
        };
      }

      console.table(data);

      if (shiftKeyPressed) {
        addToFlowsheet(convertQueryToSubmission(data));
      } else {
        dispatch(flowsheetSlice.actions.addToQueue(data));
      }
    },
    [
      handleClose,
      addToFlowsheet,
      shiftKeyPressed,
      selectedResult,
      dispatch,
      binResults,
      catalogResults,
      rotationResults,
    ]
  );

  useEffect(() => {
    document.removeEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown]);
  return (
    <Stack direction={"row"} spacing={1}>
      <ClickAwayListener onClickAway={handleClose}>
        <FormControl size="sm" sx={{ flex: 1, minWidth: 0 }}>
          <FlowsheetSearchResults
            binResults={binResults}
            catalogResults={catalogResults}
            rotationResults={rotationResults}
          />
          <Box
            ref={searchRef}
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              flexDirection: "row",
              zIndex: 8001,
              background: "var(--joy-palette-background-surface)",
              outline: "1px solid",
              outlineColor:
                "var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-neutral-200, #D8D8DF))",
              borderRadius: "8px",
              minHeight: "var(--Input-minHeight)",
              paddingInline: "0.5rem",
              cursor: live ? "text" : "default",
              "& input": {
                background: "transparent !important",
                outline: "none !important",
                border: "none !important",
                fontFamily: "inherit !important",
                minWidth: "0 !important",
                px: 1,
                flex: 1,
                minHeight: "2rem",
                cursor: live ? "text" : "default",
              },
              "&:hover": {
                outlineColor: live
                  ? "var(--joy-palette-neutral-700)"
                  : "var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-neutral-200, #D8D8DF))",
              },
              "&:focus-within": {
                outline: "2px solid",
                outlineColor: "var(--joy-palette-primary-400, #02367D)",
              },
            }}
            onClick={() =>
              live && searchRef.current?.querySelector("input")?.focus()
            }
            onFocus={() => live && setSearchOpen(true)}
          >
            <Box
              sx={{
                marginInlineEnd: "0.5rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "min(1.5rem, var(--Input-minHeight))",
                pointerEvents: "none",
                "& svg": {
                  fill: "var(--joy-palette-neutral-400) !important",
                  pointerEvents: "none",
                },
              }}
            >
              <Troubleshoot />
            </Box>
            <FlowsheetSearchInput
              name={"song"}
              disabled={!live}
              suppressHydrationWarning
            />
            <Divider orientation="vertical" />
            <FlowsheetSearchInput
              name={"artist"}
              disabled={!live}
              suppressHydrationWarning
            />
            <Divider orientation="vertical" />
            <FlowsheetSearchInput
              name={"album"}
              disabled={!live}
              suppressHydrationWarning
            />
            <Divider orientation="vertical" />
            <FlowsheetSearchInput
              name={"label"}
              disabled={!live}
              suppressHydrationWarning
            />
            <input type="submit" hidden />
            <Box
              component="div"
              className="MuiInput-endDecorator css-x3cgwv-JoyInput-endDecorator"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mr: -0.5,
              }}
            >
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                disabled={!live}
                onClick={() => {
                  const input = searchRef.current?.querySelector("input");

                  if (input) {
                    input.value = "";
                    input.focus();
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
                /
              </Button>
            </Box>
          </Box>
        </FormControl>
      </ClickAwayListener>
      <BreakpointButton />
      <Tooltip
        placement="top"
        size="sm"
        title="Add a Talkset"
        variant="outlined"
      >
        <IconButton
          size="sm"
          variant="solid"
          color="success"
          onClick={() => {
            addToFlowsheet({
              message: "Talkset",
            });
          }}
          disabled={!live}
        >
          <Mic />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
