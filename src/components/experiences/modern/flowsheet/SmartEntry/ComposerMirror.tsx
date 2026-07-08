"use client";

import { Box } from "@mui/joy";
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
}: {
  raw: string;
  spans: FieldSpan[];
  pendingTrigger?: PendingTrigger;
  ghostSuffix?: string;
}) {
  const segments = buildMirrorSegments(raw, spans, pendingTrigger);

  return (
    <Box
      aria-hidden
      sx={{
        ...smartEntryBoxSx,
        ...smartEntryTextMetricsSx,
        // In-flow: the mirror's wrapped height drives the composer height; the
        // textarea is absolutely positioned to fill it (see SmartComposer).
        position: "relative",
        zIndex: 0,
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
    </Box>
  );
}
