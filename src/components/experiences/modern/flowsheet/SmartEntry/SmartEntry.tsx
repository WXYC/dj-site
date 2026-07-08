"use client";

import { PlayArrow, QueueMusic } from "@mui/icons-material";
import {
  Box,
  Divider,
  IconButton,
  Sheet,
  Stack,
  Tooltip,
  Typography,
} from "@mui/joy";
import { ClickAwayListener, Popper } from "@mui/material";
import type { Modifier } from "@popperjs/core";
import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import SmartComposer from "./SmartComposer";
import SmartResults from "./SmartResults";
import SmartToolbar from "./SmartToolbar";
import { useFlowsheetSmartEntry } from "./useFlowsheetSmartEntry";
import { useSmartEntrySearch } from "./useSmartEntrySearch";

/** Match the results panel width to the composer shell. */
const sameWidth: Modifier<"sameWidth", object> = {
  name: "sameWidth",
  enabled: true,
  phase: "beforeWrite",
  requires: ["computeStyles"],
  fn: ({ state }) => {
    state.styles.popper.width = `${state.rects.reference.width}px`;
  },
  effect: ({ state }) => {
    const reference = state.elements.reference;
    if (reference instanceof HTMLElement) {
      state.elements.popper.style.width = `${reference.offsetWidth}px`;
    }
  },
};

/**
 * The v2 flowsheet smart-entry component: a single continuous composer that
 * parses natural-language / semicolon input into a pending entry, over the
 * existing four-source search, with an anchored results panel. Slots into the
 * flowsheet page in place of the old segmented bar.
 */
export default function SmartEntry() {
  const entry = useFlowsheetSmartEntry();
  const search = useSmartEntrySearch(entry.locks);
  const { live } = useShowControl();
  const dispatch = useAppDispatch();
  const searchOpen = useAppSelector(flowsheetSlice.selectors.getSearchOpen);
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const flatCount = search.flat.length;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        dispatch(flowsheetSlice.actions.setSearchOpen(true));
        entry.setHighlight(Math.min(entry.selectedResult + 1, flatCount));
        return;
      case "ArrowUp":
        e.preventDefault();
        entry.setHighlight(Math.max(entry.selectedResult - 1, 0));
        return;
      case "Enter":
        if (e.shiftKey) return;
        e.preventDefault();
        if (entry.selectedResult > 0 && entry.selectedResult <= flatCount) {
          // Promote the highlighted result instead of committing.
          entry.selectMatch(search.flat[entry.selectedResult - 1]);
        } else {
          formRef.current?.requestSubmit();
        }
        return;
      case "Escape":
        if (entry.handleEscape()) e.preventDefault();
        return;
    }
  };

  // Open once there is something to show or react to: a typed query (results or
  // the "log as typed" hint) or a promoted match.
  const panelOpen =
    Boolean(searchOpen && anchorEl) &&
    (entry.raw.trim() !== "" || Boolean(search.selectedMatch));

  return (
    <>
      <Sheet
        ref={setAnchorEl}
        variant="outlined"
        data-testid="flowsheet-smart-entry"
        sx={{
          borderRadius: "md",
          overflow: "hidden",
          bgcolor: "background.level1",
          transition: "border-color 0.15s, box-shadow 0.15s",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          "&:focus-within": {
            borderColor: "primary.outlinedBorder",
            boxShadow: (theme) =>
              `0 0 0 2px ${theme.vars.palette.primary.softBg}`,
          },
        }}
      >
        <form ref={formRef} onSubmit={(e) => entry.submit(e)}>
          {/* Hidden submit control so form.requestSubmit() works and the visible
              Play button stays type=button (avoids the logout-form e2e locator
              clash fixed in dbcbf940). */}
          <button
            type="submit"
            aria-hidden
            tabIndex={-1}
            style={{ display: "none" }}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 0.5,
              px: 0.75,
              pt: 0.5,
            }}
          >
            <SmartComposer
              raw={entry.raw}
              spans={entry.spans}
              pendingTrigger={entry.pendingTrigger}
              onChange={entry.onRawChange}
              onKeyDown={onKeyDown}
              inputRef={inputRef}
              disabled={!live}
              expanded={panelOpen}
            />

            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignSelf: "center", flexShrink: 0, pr: 0.25 }}
            >
              <Tooltip title="Add to queue" size="sm">
                <IconButton
                  type="button"
                  variant="soft"
                  color="success"
                  size="sm"
                  aria-label="Add to queue"
                  disabled={!live}
                  onClick={(e) => entry.submitToQueue(e)}
                >
                  <QueueMusic />
                </IconButton>
              </Tooltip>

              <Tooltip title="Play now (Enter)" size="sm">
                <IconButton
                  type="button"
                  variant="solid"
                  color="primary"
                  size="sm"
                  aria-label="Play now"
                  disabled={!live}
                  onClick={() => formRef.current?.requestSubmit()}
                >
                  <PlayArrow />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Divider />

          <SmartToolbar disabled={!live} />
        </form>
      </Sheet>

      <Popper
        open={panelOpen}
        anchorEl={anchorEl}
        placement="bottom-start"
        modifiers={[sameWidth, { name: "offset", options: { offset: [0, 4] } }]}
        style={{ zIndex: 1300 }}
      >
        <ClickAwayListener
          onClickAway={() =>
            dispatch(flowsheetSlice.actions.setSearchOpen(false))
          }
        >
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "md",
              boxShadow: "lg",
              maxHeight: "min(70vh, 460px)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <SmartResults
              selectedMatch={search.selectedMatch}
              groups={search.groups}
              fieldOrder={entry.fieldOrder}
              query={searchQuery}
              highlightIndex={entry.selectedResult}
              onSelect={entry.selectMatch}
              onHover={entry.setHighlight}
              onRemoveMatch={entry.clearMatch}
              emptyHint={
                <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                  No matches — press Enter to log it as typed.
                </Typography>
              }
            />
          </Sheet>
        </ClickAwayListener>
      </Popper>
    </>
  );
}
