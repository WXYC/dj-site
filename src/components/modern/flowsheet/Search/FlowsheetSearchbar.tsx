"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
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
import { useCallback, useEffect, useRef } from "react";
import BreakpointButton from "./BreakpointButton";
import FlowsheetSearchInput from "./FlowsheetSearchInput";
import FlowsheetSearchResults from "./Results/FlowsheetSearchResults";

export default function FlowsheetSearchbar() {
  const { live, setSearchOpen } = useFlowsheetSearch();
  const searchRef = useRef<HTMLDivElement>(null);

  const [addToFlowsheet, addToFlowsheetResult] = useAddToFlowsheetMutation();

  const handleClose = useCallback(
    (event: MouseEvent | TouchEvent | React.FormEvent<HTMLFormElement>) => {
      setSearchOpen(false);
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
    },
    [live]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleClose(e);

      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData.entries());

      addToFlowsheet({
        track_title: data.song as string,
        artist_name: data.artist as string,
        album_title: data.album as string,
        record_label: data.label as string,
        request_flag: false,
      });
    },
    [handleClose, addToFlowsheet]
  );

  useEffect(() => {
    document.removeEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
  return (
    <Stack direction={"row"} spacing={1}>
      <ClickAwayListener onClickAway={handleClose}>
        <FormControl size="sm" sx={{ flex: 1, minWidth: 0 }}>
          <FlowsheetSearchResults />
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
