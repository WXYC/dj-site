"use client";

import { Box, Divider, Sheet } from "@mui/joy";
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
 * existing four-source search. Slots into the flowsheet page in place of the
 * old segmented bar (results panel + ghost text land in later phases).
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
        </Box>

        <Divider />

        <SmartToolbar
          disabled={!live}
          onPlay={() => formRef.current?.requestSubmit()}
          onQueue={(e) => entry.submitToQueue(e)}
        />
      </form>
    </Sheet>
  );
}
