"use client";

import { PlayArrow, QueueMusic } from "@mui/icons-material";
import { Box, Divider, IconButton, Sheet, Stack, Tooltip } from "@mui/joy";
import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { useAppSelector } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import SmartComposer from "./SmartComposer";
import SmartToolbar from "./SmartToolbar";
import { useFlowsheetSmartEntry } from "./useFlowsheetSmartEntry";

/**
 * The v2 flowsheet smart-entry component: a single continuous composer that
 * parses natural-language / semicolon input into a pending entry, over the
 * existing four-source search. The Queue / Play commit buttons sit in the
 * composer row, next to the sentence they commit. Slots into the flowsheet page
 * in place of the old segmented bar (results panel + ghost text land later).
 */
export default function SmartEntry() {
  const entry = useFlowsheetSmartEntry();
  const { live } = useShowControl();
  const searchOpen = useAppSelector(flowsheetSlice.selectors.getSearchOpen);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Newlines never belong in an entry; Enter commits.
      e.preventDefault();
      // P4: when a result is highlighted, Enter promotes it instead of
      // committing. Until the results panel lands, Enter always commits.
      formRef.current?.requestSubmit();
      return;
    }
    if (e.key === "Escape") {
      if (entry.handleEscape()) e.preventDefault();
    }
  };

  return (
    <Sheet
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
            Play button can stay type=button (avoids the logout-form e2e locator
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
            expanded={searchOpen}
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
  );
}
