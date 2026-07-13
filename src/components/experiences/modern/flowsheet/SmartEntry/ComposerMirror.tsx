"use client";

import { Box } from "@mui/joy";
import type { ReactNode } from "react";
import type { FieldSpan, PendingTrigger } from "./parser/types";
import { buildMirrorSegments } from "./mirrorSegments";
import {
  smartEntryBoxSx,
  smartEntryGhostSx,
  smartEntryTextMetricsSx,
  smartEntryTokenSx,
  smartEntryTriggerSx,
} from "./smartEntryStyles";

/**
 * The highlight layer rendered directly behind the transparent textarea. It
 * reproduces the raw text exactly (see `buildMirrorSegments`) with trigger
 * words dimmed and field values tinted, plus an optional grey ghost suffix.
 * `aria-hidden` and non-interactive — the real textarea owns caret, selection,
 * and accessibility.
 */
export default function ComposerMirror({
  raw,
  spans,
  pendingTrigger,
  ghostSuffix = "",
  caretAffordance,
}: {
  raw: string;
  spans: FieldSpan[];
  pendingTrigger?: PendingTrigger;
  ghostSuffix?: string;
  /** Interactive node floated inline at the end of the text (the trigger
   *  chips). Rendered above the textarea — see the wrapper below. */
  caretAffordance?: ReactNode;
}) {
  const segments = buildMirrorSegments(raw, spans, pendingTrigger);

  return (
    <Box
      aria-hidden
      sx={{
        ...smartEntryBoxSx,
        ...smartEntryTextMetricsSx,
        // In-flow (static): the mirror's wrapped height drives the composer
        // height and it paints behind the absolutely-positioned textarea. It
        // deliberately does NOT establish a stacking context (no position/
        // z-index) so the caret affordance below can raise itself above the
        // textarea (z-index 1) to stay clickable.
        minHeight: "1.7em",
        pointerEvents: "none",
        color: "text.primary",
        // A trailing zero-width space guarantees the final (possibly empty)
        // line keeps height, matching the textarea's own trailing line.
        "&::after": { content: '"\\200b"' },
      }}
    >
      {segments.map((seg, i) => {
        if (seg.kind === "plain") {
          return <span key={i}>{seg.text}</span>;
        }
        if (seg.kind === "trigger") {
          return (
            <Box component="span" key={i} sx={smartEntryTriggerSx}>
              {seg.text}
            </Box>
          );
        }
        return (
          <Box
            component="span"
            key={i}
            sx={smartEntryTokenSx(seg.field!, seg.locked ?? false)}
          >
            {seg.text}
          </Box>
        );
      })}
      {ghostSuffix ? (
        <Box component="span" sx={smartEntryGhostSx}>
          {ghostSuffix}
        </Box>
      ) : null}
      {caretAffordance ? (
        <Box
          component="span"
          // Raise above the textarea (z-index 1) and re-enable pointer events
          // (the mirror root disables them) so the chips are clickable while
          // sitting inline right after the typed text — i.e. at the caret.
          sx={{
            position: "relative",
            zIndex: 2,
            pointerEvents: "auto",
            display: "inline-flex",
            verticalAlign: "middle",
            ml: 1,
          }}
        >
          {caretAffordance}
        </Box>
      ) : null}
    </Box>
  );
}
