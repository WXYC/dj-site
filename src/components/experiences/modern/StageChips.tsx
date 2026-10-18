"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Box } from "@mui/joy";
import { usePathname, useSearchParams } from "next/navigation";
import HeadedSection from "./reviews/HeadedSection";
import { VISUALLY_HIDDEN } from "./visuallyHidden";

export type Stage<Id extends string> = { id: Id; label: string; count: number };

/**
 * A row of capsule chips that switch the list below them: tabs in the markup, so one is selected and the arrow keys move between them. The choice is kept in the URL as `?stage=`, so it can be bookmarked; a missing or unknown value selects `fallback`. A chip with a zero count is muted, and a screen reader hears its count after a comma ("Open reviews, 2").
 * A choice is written with `window.history.replaceState`, which the App Router syncs to `useSearchParams` without a server request, so the chip and its list change at once and no history entry is added.
 * `children` draws the selected stage's list. It sits in a tabpanel named by the selected chip.
 */
export default function StageChips<Id extends string>({ label, stages, fallback, onChoose, children }: {
  /** The tablist's accessible name. */
  label: string;
  stages: readonly Stage<Id>[];
  fallback: Id;
  /** Told the stage a chip chose, by a click or a key, after the URL is written; also when the chip was already selected. */
  onChoose?: (id: Id) => void;
  children: (stage: Id) => ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = useId();
  const chips = useRef<(HTMLButtonElement | null)[]>([]);

  const requested = searchParams.get("stage");
  const selected = stages.find((s) => s.id === requested) ?? stages.find((s) => s.id === fallback) ?? stages[0];
  const panelId = `${base}-panel`;

  const choose = (index: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("stage", stages[index].id);
    window.history.replaceState(null, "", `${pathname}?${next}`);
    chips.current[index]?.focus();
    onChoose?.(stages[index].id);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = stages.length - 1;
    const target = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    choose(target);
  };

  return (
    <>
      <Box role="tablist" aria-label={label} sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        {stages.map((stage, index) => {
          const active = stage === selected;
          return (
            <Box
              key={stage.id}
              component="button"
              type="button"
              role="tab"
              ref={(el: HTMLButtonElement | null) => {
                chips.current[index] = el;
              }}
              id={`${base}-tab-${stage.id}`}
              aria-selected={active}
              aria-controls={panelId}
              data-empty={stage.count === 0 ? "true" : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => choose(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              sx={{
                px: 1.5,
                py: 0.5,
                border: "none",
                borderRadius: "xl",
                cursor: "pointer",
                font: "inherit",
                fontWeight: "md",
                bgcolor: active ? "neutral.solidBg" : "neutral.softBg",
                color: active ? "neutral.solidColor" : "text.primary",
                "&[data-empty]": { opacity: 0.6 },
              }}
            >
              {stage.label}
              <Box component="span" aria-hidden="true" sx={{ ml: 0.75 }}>{stage.count}</Box>
              <Box component="span" sx={VISUALLY_HIDDEN}>{`, ${stage.count}`}</Box>
            </Box>
          );
        })}
      </Box>
      <HeadedSection id={panelId} role="tabpanel" tabIndex={0} title={selected.label} hideTitle>
        {children(selected.id)}
      </HeadedSection>
    </>
  );
}
