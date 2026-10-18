import { useCallback, useRef, type ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { itemHolder, onReviewShelf } from "@/lib/features/reviews/holder";
import { useCancelIntakeRequestMutation } from "@/lib/features/reviews/intakeApi";
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import HeadedSection from "./HeadedSection";
import { REVIEW_COPY } from "./copy";
import { whereLine } from "./ReviewFrom";
import { useAskADj } from "./useAskADj";
import { useReviewWrite } from "./useReviewWrite";

const COPY = REVIEW_COPY.intakeItem;

/**
 * The block at the top of a record's page while no review is chosen for its cover: where the record is now, then the
 * other ways to get a review. `children` is the page's Record a review row with its open section, which the page draws
 * here instead of in its own place. `focusCite` moves focus to the first cite button once, when the block first
 * appears. The page is for music directors, so the reviewers are read whenever a DJ can be asked.
 */
export default function RecordOrigin({ item, focusCite, children }: { item: IntakeItem; focusCite: boolean; children: ReactNode }) {
  const onShelf = onReviewShelf(item);
  const reviewers = useGetReviewersQuery(undefined, { skip: !onShelf });
  const { write, lock } = useReviewWrite(undefined, { reloadMine: false });
  const titleId = `record-origin-${item.id}`;
  const { picker } = useAskADj({ reviewers, write, lock, labelledBy: () => `${titleId}-line` });
  const [cancelRequest] = useCancelIntakeRequestMutation();
  const focused = useRef(false);
  const reveal = useCallback((el: HTMLElement | null) => {
    if (!el || !focusCite || focused.current) {
      return;
    }
    focused.current = true;
    el.scrollIntoView?.();
    el.querySelector<HTMLElement>("[data-line='two'] button")?.focus();
  }, [focusCite]);
  const line = whereLine(item);

  return (
    <Box ref={reveal}>
    <HeadedSection title={COPY.originTitle} titleId={titleId} spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {line && <Typography id={`${titleId}-line`}>{line}</Typography>}
        {itemHolder(item).kind === "requested" && (
          <Button size="sm" variant="outlined" {...lock(item.id, "cancel")} onClick={() => write(item.id, "cancel", () => cancelRequest(item.id).unwrap())}>
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
      {children}
    </HeadedSection>
    </Box>
  );
}
