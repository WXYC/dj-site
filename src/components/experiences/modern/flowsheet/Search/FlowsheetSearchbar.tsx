"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  useFlowsheetSearch,
  useFlowsheetSubmit,
} from "@/src/hooks/flowsheetHooks";
import { PlayArrow, QueueMusic, Troubleshoot } from "@mui/icons-material";
import { Box, Button, Divider, FormControl, Stack, useTheme } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useEffect, useRef } from "react";
import BreakpointButton from "./BreakpointButton";
import FlowsheetSearchInput from "./FlowsheetSearchInput";
import FlowsheetSearchResults from "./Results/FlowsheetSearchResults";
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
  } = useFlowsheetSubmit();

  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );

  const { live, searchOpen, setSearchOpen, resetSearch } = useFlowsheetSearch();
  const searchRef = useRef<HTMLFormElement>(null);

  const handleClose = useCallback(
    () => {
      resetSearch();
      searchRef.current?.querySelector("input")?.blur();
    },
    [resetSearch]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        if (!live) return;
        searchRef.current?.querySelector("input")?.focus();
      }
      if (e.key === "ArrowDown" && searchOpen) {
        e.preventDefault();
        const nextIndex = Math.min(
          selectedResult + 1,
          binResults.length + catalogResults.length + rotationResults.length
        );
        dispatch(flowsheetSlice.actions.setSelectedResult(nextIndex));
      }
      if (e.key === "ArrowUp" && searchOpen) {
        e.preventDefault();
        const prevIndex = Math.max(selectedResult - 1, 0);
        dispatch(flowsheetSlice.actions.setSelectedResult(prevIndex));
      }
    },
    [
      live,
      dispatch,
      searchOpen,
      binResults,
      catalogResults,
      rotationResults,
      selectedResult,
    ]
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit();
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
      <FormControl size="sm" sx={{ flex: 1, minWidth: 0 }}>
        <FlowsheetSearchResults
          binResults={binResults}
          catalogResults={catalogResults}
          rotationResults={rotationResults}
        />
        <Stack direction="row" spacing={0.5}>
          <BreakpointButton />
          <TalksetButton />
          <Box
            ref={searchRef}
            component="form"
            onSubmit={handleFormSubmit}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              flexDirection: "row",
              flexGrow: 1,
              zIndex: 8001,
              background: "transparent",
              outline: "1px solid",
              outlineColor: theme.palette.neutral.outlinedBorder,
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
              live && searchRef.current?.querySelector("input")?.focus()
            }
            onFocus={() => live && setSearchOpen(true)}
            suppressHydrationWarning
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
                  fill: "var(--wxyc-palette-neutral-400) !important",
                  pointerEvents: "none",
                },
              }}
            >
              <Troubleshoot />
            </Box>
            <FlowsheetSearchInput
              name={"song"}
              disabled={!live}
              required={true}
              suppressHydrationWarning
            />
            <Divider orientation="vertical" />
            <FlowsheetSearchInput
              name={"artist"}
              required={selectedResult == 0}
              disabled={!live}
              suppressHydrationWarning
            />
            <Divider orientation="vertical" />
            <FlowsheetSearchInput
              name={"album"}
              disabled={!live}
              required={selectedResult == 0}
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
              className="MuiInput-endDecorator"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mr: -0.5,
              }}
            >
              <Button
                size="sm"
                variant={searchOpen ? "solid" : "outlined"}
                color={
                  searchOpen
                    ? ctrlKeyPressed
                      ? "success"
                      : "primary"
                    : "neutral"
                }
                disabled={!live}
                onClick={() => {
                  if (searchOpen) {
                    searchRef.current?.requestSubmit();
                  } else {
                    const input = searchRef.current?.querySelector("input");
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
