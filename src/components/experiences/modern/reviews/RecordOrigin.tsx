import { useCallback, useRef, type ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { itemHolder, onReviewShelf } from "@/lib/features/reviews/holder";
import { useCancelIntakeRequestMutation } from "@/lib/features/reviews/intakeApi";
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import type { RowWriteOutcome } from "@/src/hooks/useRowWrite";
import HeadedSection from "./HeadedSection";
import { REVIEW_COPY } from "./copy";
import { whereLine } from "./ReviewFrom";
import { useAskADj } from "./useAskADj";
import { useReviewWrite } from "./useReviewWrite";

const COPY = REVIEW_COPY.intakeItem;

/**
 * The block at the top of a record's page while no review is chosen for its cover: where the record is now, then the
 * other ways to get a review. `children` is the page's Digitize a review row with its open section, which the page draws
 * here instead of in its own place. `focusCite` moves focus to the first cite button once, when the block first
 * appears. `settled` is true while the block stays only to keep an open section in place after a review was chosen;
 * it then draws only that section, so it never says where a record with its review is. The page is for music
 * directors, so the reviewers are read whenever a DJ can be asked.
 */
export default function RecordOrigin({ item, focusCite, settled, children }: { item: IntakeItem; focusCite: boolean; settled: boolean; children: ReactNode }) {
  const onShelf = onReviewShelf(item);
  const reviewers = useGetReviewersQuery(undefined, { skip: settled || !onShelf });
  const { write, lock } = useReviewWrite({ reloadMine: false, only: item.id });
  const [cancelRequest] = useCancelIntakeRequestMutation();
  const block = useRef<HTMLElement | null>(null);
  const whereNow = useRef<HTMLElement | null>(null);
  const focused = useRef(false);
  const reveal = useCallback((el: HTMLElement | null) => {
    block.current = el;
    if (!el || !focusCite || focused.current) {
      return;
    }
    focused.current = true;
    el.scrollIntoView?.();
    el.querySelector<HTMLElement>("[data-line='two'] button")?.focus();
  }, [focusCite]);
  // Cancel request and Ask a DJ… each unmount once their write lands or loses its race, since either way the reread record has moved, so focus moves to the line that now says where the record is, or to the block when no line names its place. A refused or failed write leaves the control, which keeps its focus.
  const followRecord = (outcome: RowWriteOutcome) => {
    if (outcome === "applied" || outcome === "raced") {
      (whereNow.current ?? block.current)?.focus();
    }
  };
  // A page about one record, so Ask a DJ… is named by its own words.
  const { picker } = useAskADj({ reviewers, write, lock, onSettled: (_i, outcome) => followRecord(outcome) });
  const cancel = async () => followRecord(await write(item.id, "cancel", () => cancelRequest(item.id).unwrap()));
  const titleId = `record-origin-${item.id}`;
  const line = whereLine(item, { naming: "holder" });

  return (
    <Box ref={reveal} tabIndex={-1} sx={{ outline: "none" }}>
    <HeadedSection title={COPY.originTitle} titleId={titleId} spacing={1.5}>
      {!settled && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {line && <Typography ref={whereNow} tabIndex={-1}>{line}</Typography>}
            {itemHolder(item).kind === "requested" && (
              <Button size="sm" variant="outlined" {...lock(item.id, "cancel")} onClick={cancel}>
                {REVIEW_COPY.intake.cancelRequest}
              </Button>
            )}
          </Stack>
          <Typography level="body-sm">{COPY.originOr}</Typography>
          {onShelf && (
            <Stack direction="row">
              {picker(item)}
            </Stack>
          )}
        </>
      )}
      {children}
    </HeadedSection>
    </Box>
  );
}
