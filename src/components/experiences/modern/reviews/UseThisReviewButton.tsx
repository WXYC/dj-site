"use client";

import { useState } from "react";
import { Button } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { isIntakeAcceptReviewRefused, useAcceptReviewMutation } from "@/lib/features/reviews/intakeApi";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intakeItem;

/**
 * Chooses `review` for the cover of the record `itemId`. It asks first when a review is already on the
 * cover (`replacing`), and says nothing of its own on success: the review moving up is the confirmation.
 * Once the write succeeds the confirmation closes and `onWritten` hands the page the reread; the page
 * disables the button (`disabled`) until that reread settles, so a press in that window cannot send the write twice.
 * `onPending` tells the page a write is in flight (true at the press, false once it fails, after the failure's own reload on a refusal), so no other
 * review button acts on the stale cover meanwhile. `reload` is the page's reload (`useItemPageReload`), which also tells whether the page is still mounted;
 * the line goes out through `onNotice`, so it survives this button leaving the page with a deleted review.
 */
export default function UseThisReviewButton({ itemId, review, replacing, disabled, reload, onPending, onWritten, onNotice }: {
  itemId: number;
  review: Review;
  replacing: boolean;
  disabled: boolean;
  reload: () => Promise<{ mounted: boolean }>;
  onPending: (pending: boolean) => void;
  onWritten: () => Promise<void>;
  onNotice: (line: string | null) => void;
}) {
  const [accept, { isLoading }] = useAcceptReviewMutation();
  const [confirming, setConfirming] = useState(false);

  const choose = async () => {
    onNotice(null);
    onPending(true);
    try {
      await accept({ id: itemId, reviewId: review.id }).unwrap();
      setConfirming(false);
      await onWritten();
    } catch (err) {
      setConfirming(false);
      // Only this button's own rejection reads the 400 predicate: filing onto a release is refused with the same status.
      if (!isIntakeAcceptReviewRefused(err)) onNotice(REVIEW_COPY.screen.writeFailed);
      else if ((await reload()).mounted) onNotice(COPY.reviewGone);
      onPending(false);
    }
  };

  const label = replacing ? COPY.useThisReviewInstead : COPY.useThisReview;
  return (
    <>
      <Button size="sm" variant="outlined" loading={isLoading && !confirming} disabled={disabled} onClick={replacing ? () => setConfirming(true) : choose} sx={{ alignSelf: "flex-start" }}>
        {label}
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        pending={isLoading}
        title={COPY.replaceCover}
        titleId="use-this-review-title"
        actions={
          <>
            <Button variant="plain" onClick={() => setConfirming(false)} disabled={isLoading}>{REVIEW_COPY.screen.cancel}</Button>
            <Button loading={isLoading} onClick={choose}>{COPY.useThisReviewInstead}</Button>
          </>
        }
      >
        {null}
      </ConfirmDialog>
    </>
  );
}
