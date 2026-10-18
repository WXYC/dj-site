"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { Button, Link, Typography } from "@mui/joy";
import type { IntakeItem, Reviewer } from "@wxyc/shared";
import { useCancelIntakeRequestMutation, useCheckoutIntakeItemMutation, useRequestIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import { onReviewShelf } from "@/lib/features/reviews/holder";
import { byKind } from "@/lib/features/reviews/kind";
import { foldReviewers } from "@/lib/features/reviews/reviewerMatch";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { useMounted } from "@/src/hooks/useRowWrite";
import IntakeLane from "./IntakeLane";
import IntakeRequestPicker from "./IntakeRequestPicker";
import { REVIEW_COPY } from "./copy";
import { intakeRecord, recordLine } from "./recordLine";
import { day, type ReviewWrite } from "./useReviewWrite";

/** The review shelf lane, and for a music director the reviewers-load alert and each record's Ask a DJ… button. It assumes its caller has applied the `useCanSeeReviews` check and the load-failed gate, and takes the reviewers read and the one `useReviewWrite` the caller shares with My reviews. */
export default function ReviewShelfScreen({ items, formats, isMD, reviewers, write, lock }: { items: IntakeItem[]; formats: { id: number; format_name: string }[] | undefined; isMD: boolean; reviewers: { isError: boolean; isLoading: boolean; data?: Reviewer[] } } & ReviewWrite) {
  const [checkout] = useCheckoutIntakeItemMutation();
  const [requestReview] = useRequestIntakeItemMutation();
  const [cancelRequest] = useCancelIntakeRequestMutation();
  const onShelf = items.filter(onReviewShelf);
  // Folded once per reviewers read, not per row or per keystroke.
  const folded = useMemo(() => foldReviewers(reviewers.data ?? []), [reviewers.data]);
  const reviewersFailed = hasNothingToShow(reviewers);
  // A write outlives the screen when the music director navigates away mid-click; its Asked toast, whose Cancel request could then fail unheard, is skipped.
  const mounted = useMounted();

  // Names each record's Ask a DJ… button for the record it acts on.
  const shelfRecordId = (i: IntakeItem) => `review-shelf-record-${i.id}`;
  const describe = (i: IntakeItem) => recordLine(intakeRecord(i), formats);
  // The toast waits for the write to finish, so its Cancel request never meets the row's lock.
  const ask = async (i: IntakeItem, reviewer: Reviewer) => {
    let sent = false;
    await write(i.id, "request", async () => {
      await requestReview({ id: i.id, djId: reviewer.id }).unwrap();
      sent = true;
    });
    if (sent && mounted.current) {
      toast(REVIEW_COPY.intake.askDone(reviewer.name), {
        action: { label: REVIEW_COPY.intake.cancelRequest, onClick: () => write(i.id, "cancel", () => cancelRequest(i.id).unwrap()) },
      });
    }
  };

  return (
    <>
      {isMD && reviewersFailed && <Typography role="alert">{REVIEW_COPY.intake.reviewersLoadFailed}</Typography>}
      <IntakeLane title={REVIEW_COPY.screen.shelfTitle} rows={onShelf} empty={REVIEW_COPY.screen.shelfEmpty} label={(i) => (isMD ? <Link id={shelfRecordId(i)} href={`/dashboard/admin/intake/${i.id}`}>{describe(i)}</Link> : <Typography>{describe(i)}</Typography>)} extra={(i) => (
        <>
          <Typography level="body-sm">{`${REVIEW_COPY.screen.logged} ${day(i.logged_at)}`}</Typography>
          <Button size="sm" {...lock(i.id, "checkout")} onClick={() => write(i.id, "checkout", () => checkout(i.id).unwrap())}>{byKind(i, { disc: REVIEW_COPY.screen.checkOut, digital: REVIEW_COPY.screen.take })}</Button>
          {isMD && (
            <IntakeRequestPicker
              reviewers={folded}
              loading={reviewers.isLoading}
              failed={reviewersFailed}
              labelledBy={shelfRecordId(i)}
              artist={i.artist_name}
              album={i.album_title}
              busy={lock(i.id, "request")}
              onRequest={(reviewer) => ask(i, reviewer)}
            />
          )}
        </>
      )} />
    </>
  );
}
