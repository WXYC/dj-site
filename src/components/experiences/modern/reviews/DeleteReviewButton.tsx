"use client";

import { useState } from "react";
import { Button, Typography } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { namedAuthor } from "@/lib/features/reviews/author";
import { isReviewAccepted, useDeleteReviewMutation } from "@/lib/features/reviews/reviewApi";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intakeItem;

/**
 * Deletes `review` after asking, with the page's own `confirmation` as the question. `blocked` is the
 * filed-cover case the page can already see: the button is disabled and the sentence sits beside it.
 * `disabled` is the page's hold from a review write until its reread settles. Use this review and Record a review (ticked or not) hold from the press, each on a handle of its own, and let go if the write fails; a delete holds only once it has succeeded, through its reread. `onWritten` hands the page the reread after a delete.
 * Every failure reloads the page (`reload`, `useItemPageReload`) and then goes out through `onNotice`,
 * so the line survives the reload that removes this button when the review is already gone.
 */
export default function DeleteReviewButton({ review, confirmation, blocked, disabled, reload, onWritten, onNotice }: {
  review: Review;
  confirmation: string;
  blocked: boolean;
  disabled: boolean;
  reload: () => Promise<{ mounted: boolean }>;
  onWritten: () => Promise<void>;
  onNotice: (line: string | null) => void;
}) {
  const [remove, { isLoading }] = useDeleteReviewMutation();
  const [confirming, setConfirming] = useState(false);
  const author = namedAuthor(review);

  const confirm = async () => {
    onNotice(null);
    try {
      await remove(review.id).unwrap();
      setConfirming(false);
      await onWritten();
    } catch (err) {
      setConfirming(false);
      if ((await reload()).mounted) onNotice(isReviewAccepted(err) ? COPY.deleteCoverFiled : REVIEW_COPY.couldNotDelete);
    }
  };

  return (
    <>
      <Button
        size="sm"
        color="danger"
        variant="outlined"
        disabled={blocked || disabled}
        onClick={() => setConfirming(true)}
        aria-label={author ? COPY.deleteReviewBy(author) : COPY.deleteReview}
        sx={{ alignSelf: "flex-start" }}
      >
        {COPY.deleteReview}
      </Button>
      {blocked && <Typography level="body-sm">{COPY.deleteCoverFiled}</Typography>}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        pending={isLoading}
        title={confirmation}
        titleId="delete-review-title"
        actions={
          <>
            <Button variant="plain" onClick={() => setConfirming(false)} disabled={isLoading}>{REVIEW_COPY.cancel}</Button>
            <Button color="danger" loading={isLoading} onClick={confirm}>{REVIEW_COPY.delete}</Button>
          </>
        }
      >
        {null}
      </ConfirmDialog>
    </>
  );
}
