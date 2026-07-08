"use client";

import { Box, Stack } from "@mui/joy";
import { useCallback } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import type { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import AlbumArtThumb from "./AlbumArtThumb";
import MetaPills from "./MetaPills";
import SentenceText from "./SentenceText";
import type { SmartField } from "./parser/types";

/** Visual state of a row: plain, keyboard-highlighted, or the promoted match. */
export type SmartResultTone = "plain" | "highlight" | "promoted";

const toneSx = (tone: SmartResultTone) => {
  switch (tone) {
    case "promoted":
      return { bgcolor: "primary.700", borderRadius: "sm" };
    case "highlight":
      return { bgcolor: "primary.softBg", borderRadius: "sm" };
    default:
      return {
        bgcolor: "transparent",
        "&:hover": { bgcolor: "background.level1" },
      };
  }
};

/**
 * One result row: album art, the sentence line, and secondary metadata pills.
 * An ARIA listbox option; hovering highlights it (shared with keyboard nav),
 * clicking/mousedown selects it. `tone` sets the visual treatment — the
 * promoted match reads white-on-primary.
 */
export default function SmartResultRow({
  entry,
  index,
  fieldOrder,
  query,
  tone = "plain",
  onSelect,
  onHover,
}: {
  entry: AlbumEntry;
  index?: number;
  fieldOrder: SmartField[];
  query: FlowsheetQuery;
  tone?: SmartResultTone;
  onSelect: (entry: AlbumEntry) => void;
  onHover?: (index: number) => void;
}) {
  const promoted = tone === "promoted";
  const scrollIntoView = useCallback(
    (el: HTMLDivElement | null) => {
      // Optional-call guard: jsdom doesn't implement scrollIntoView.
      if (tone === "highlight") el?.scrollIntoView?.({ block: "nearest" });
    },
    [tone]
  );

  return (
    <Stack
      ref={scrollIntoView}
      direction="row"
      spacing={1}
      alignItems="center"
      role="option"
      {...(index !== undefined ? { id: `flowsheet-option-${index}` } : {})}
      aria-selected={tone !== "plain"}
      {...(index !== undefined
        ? { "data-testid": `flowsheet-search-result-${index}` }
        : {})}
      onMouseEnter={index !== undefined ? () => onHover?.(index) : undefined}
      onMouseDown={(e) => {
        // Keep focus in the composer; commit on click without a blur flicker.
        e.preventDefault();
        onSelect(entry);
      }}
      sx={{
        px: 1,
        py: promoted ? 0.875 : 0.75,
        minWidth: 0,
        cursor: "pointer",
        ...toneSx(tone),
      }}
    >
      <AlbumArtThumb entry={entry} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <SentenceText
          entry={entry}
          fieldOrder={fieldOrder}
          query={query}
          selected={promoted}
        />
        <MetaPills entry={entry} />
      </Box>
    </Stack>
  );
}
