import { Box, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { isFiledState } from "@/lib/features/reviews/kind";
import { formatStationShortDate } from "@/src/utilities/stationTime";
import { REVIEW_COPY } from "./copy";

const { intake } = REVIEW_COPY;

const FIXED_STEPS = [
  { label: intake.beingReviewed, at: "checked_out_at" },
  { label: intake.reviewed, at: "accepted_at" },
  { label: intake.printed, at: "printed_at" },
  { label: intake.filed, at: "filed_at" },
] as const satisfies readonly { label: string; at: keyof IntakeItem }[];

type Step = { label: string; at: "logged_at" | "requested_at" | (typeof FIXED_STEPS)[number]["at"] };

/** A request that stands names who asked; one that has lapsed reads as the review shelf, so it keeps the ordinary first step even though its fields stay set. */
function stepsFor(item: IntakeItem): Step[] {
  const name = item.requested_by_name?.trim();
  const first: Step =
    item.effective_state === "requested" && name ? { label: intake.askedBy(name), at: "requested_at" } : { label: intake.added, at: "logged_at" };
  return [first, ...FIXED_STEPS];
}

/** The step the record is at; a filed record is past them all. A requested record is still at its first step, and a printed slip is what moves a reviewed record on to Printed. */
function currentStep(item: IntakeItem): number {
  if (isFiledState(item.effective_state)) {
    return FIXED_STEPS.length + 1;
  }
  switch (item.effective_state) {
    case "checked_out":
      return 1;
    case "reviewed":
      return item.printed_at != null ? 3 : 2;
    default:
      return 0;
  }
}

/**
 * A record's life in five steps, each marked Done, Current or Not yet in text as well as style. A date shows only when it formats: a step the
 * record has passed whose date is gone (a return clears the checkout's) shows with none.
 */
export default function IntakeProgress({ item }: { item: IntakeItem }) {
  const current = currentStep(item);
  const steps = stepsFor(item);
  return (
    <Box component="ol" aria-label={intake.progress} sx={{ display: "flex", flexWrap: "wrap", gap: 3, listStyle: "none", m: 0, p: 0 }}>
      {steps.map(({ label, at }, i) => {
        const state = i < current ? intake.stepDone : i === current ? intake.stepCurrent : intake.stepAhead;
        const iso = item[at];
        const date = iso && i <= current ? formatStationShortDate(iso) : "";
        return (
          <Box component="li" key={i} aria-current={i === current ? "step" : undefined} sx={{ display: "flex", flexDirection: "column" }}>
            <Typography level="title-sm" component="span">{label}</Typography>
            <Typography level="body-xs" component="span">{state}</Typography>
            {date && <Typography level="body-xs" component="span">{date}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}
