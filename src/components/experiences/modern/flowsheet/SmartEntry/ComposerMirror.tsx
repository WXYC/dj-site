"use client";

import { Box } from "@mui/joy";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

  // Keep the affordance inline at the caret while it comfortably fits after the
  // text; drop it to its own row when it doesn't. Without this a hover-expanded
  // button can tip the cluster over the edge and wrap to the next line — moving
  // it out from under the cursor, which un-hovers it, shrinks it, unwraps… i.e.
  // jitter. The decision is measured off a zero-width sentinel at the end of the
  // text (its position doesn't change when the affordance moves), so it's
  // stable and can't oscillate.
  const mirrorRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const affordanceRef = useRef<HTMLSpanElement>(null);
  const [ownRow, setOwnRow] = useState(false);

  useEffect(() => {
    if (!caretAffordance) {
      setOwnRow(false);
      return;
    }
    const measure = () => {
      const mirror = mirrorRef.current;
      const sentinel = sentinelRef.current;
      const affordance = affordanceRef.current;
      if (!mirror || !sentinel || !affordance) return;
      const m = mirror.getBoundingClientRect();
      const s = sentinel.getBoundingClientRect();
      // Room to the right of where the text ends, minus a little padding slack.
      const available = m.right - s.left - 12;
      // Reserve headroom for a hover-expanded label so a hover never wraps.
      const HOVER_BUDGET = 72;
      setOwnRow(affordance.offsetWidth + HOVER_BUDGET > available);
    };
    measure();
    if (typeof ResizeObserver === "undefined" || !mirrorRef.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(mirrorRef.current);
    return () => observer.disconnect();
  }, [raw, ghostSuffix, caretAffordance]);

  return (
    <Box
      ref={mirrorRef}
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
        <>
          {/* Zero-width marker at the end of the text — the anchor the fit
              measurement reads. */}
          <Box
            component="span"
            ref={sentinelRef}
            sx={{ display: "inline-block", width: 0 }}
          />
          <Box
            component="span"
            ref={affordanceRef}
            // Raise above the textarea (z-index 1) and re-enable pointer events
            // (the mirror root disables them) so the chips are clickable. Inline
            // right after the text when it fits; on its own row (block-level,
            // sized to content) when it doesn't — see the fit measurement above.
            sx={{
              position: "relative",
              zIndex: 2,
              pointerEvents: "auto",
              display: ownRow ? "flex" : "inline-flex",
              width: ownRow ? "fit-content" : undefined,
              verticalAlign: "middle",
              ml: ownRow ? 0 : 1,
              mt: ownRow ? 0.5 : 0,
            }}
          >
            {caretAffordance}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
