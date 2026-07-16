"use client";

import { Album, BusinessSharp, Person } from "@mui/icons-material";
import { Box } from "@mui/joy";
import type { ColorPaletteProp } from "@mui/joy";
import type { SvgIconComponent } from "@mui/icons-material";
import type { MouseEvent } from "react";
import type { SmartField } from "./parser/types";
import { TRIGGER_FIELDS, TRIGGER_WORD, type TriggerField } from "./triggerWords";

// Per-field visual metadata. Colours mirror the field pills in the composer
// (see SMART_ENTRY_FIELD_COLOR): artist=primary, album=success, label=warning —
// so a chip reads as the same field its highlighted value will. The field order
// and the inserted word come from ./triggerWords (shared with Tab-to-advance).
const META: Record<
  TriggerField,
  { label: string; color: ColorPaletteProp; Icon: SvgIconComponent }
> = {
  artist: { label: "artist", color: "primary", Icon: Person },
  album: { label: "album", color: "success", Icon: Album },
  label: { label: "label", color: "warning", Icon: BusinessSharp },
};

/**
 * The inline field-mode chips: tiny, colour-coded buttons floated at the caret
 * that splice a trigger word (`by` / `from` / `via`) so the text after it fills
 * the artist / album / label. A single-line analog to the old multi-field bar.
 *
 * Each chip is icon-only at rest and expands to the right to reveal the field
 * name on hover. A chip vanishes once its field is claimed — the parser is
 * first-wins, so offering a second trigger for a filled field is meaningless.
 *
 * These live inside the `aria-hidden` mirror layer and are pointer/touch
 * affordances (`tabIndex={-1}`); keyboard/screen-reader users type the word
 * (or the field's connector) directly into the textarea.
 */
export default function TriggerChips({
  isClaimed,
  onInsert,
}: {
  isClaimed: (field: SmartField) => boolean;
  onInsert: (word: string) => void;
}) {
  const available = TRIGGER_FIELDS.filter((field) => !isClaimed(field));
  if (available.length === 0) return null;

  return (
    <Box
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
      data-testid="flowsheet-trigger-chips"
    >
      {available.map((field) => {
        const { label, color, Icon } = META[field];
        const word = TRIGGER_WORD[field];
        return (
        <Box
          component="button"
          type="button"
          key={field}
          tabIndex={-1}
          aria-label={`Add ${label} ("${word}")`}
          data-testid={`flowsheet-trigger-${field}`}
          // preventDefault on mousedown keeps the composer focused (no blur +
          // focus steal) so the caret survives and the keyboard stays up on
          // touch; the insert runs on click.
          onMouseDown={(e: MouseEvent) => e.preventDefault()}
          onClick={() => onInsert(word)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            height: "1.375rem",
            px: "0.25rem",
            border: "none",
            borderRadius: "sm",
            cursor: "pointer",
            color: `${color}.softColor`,
            bgcolor: `${color}.softBg`,
            transition: "background-color 0.15s ease",
            "&:hover": { bgcolor: `${color}.softHoverBg` },
            "&:active": { bgcolor: `${color}.softActiveBg` },
            // The label collapses to nothing at rest and slides open on hover.
            "& .trigger-label": {
              display: "inline-block",
              maxWidth: 0,
              overflow: "hidden",
              whiteSpace: "nowrap",
              opacity: 0,
              marginLeft: 0,
              fontSize: "0.72rem",
              fontWeight: 600,
              lineHeight: 1,
              transition:
                "max-width 0.18s ease, opacity 0.18s ease, margin-left 0.18s ease",
            },
            "&:hover .trigger-label": {
              maxWidth: "4rem",
              opacity: 1,
              marginLeft: "0.2rem",
            },
            "@media (prefers-reduced-motion: reduce)": {
              "& .trigger-label": { transition: "none" },
              transition: "none",
            },
          }}
        >
          <Icon sx={{ fontSize: "0.95rem" }} />
          <span className="trigger-label">{label}</span>
        </Box>
        );
      })}
    </Box>
  );
}
