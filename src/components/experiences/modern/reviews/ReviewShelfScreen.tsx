"use client";

import { Button, Link, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { useCheckoutIntakeItemMutation, useRequestIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { byKind } from "@/lib/features/reviews/kind";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import IntakeLane from "./IntakeLane";
import IntakeRequestPicker from "./IntakeRequestPicker";
import { REVIEW_COPY } from "./copy";
import { intakeRecord, recordLine } from "./recordLine";
import { day, useReviewWrite } from "./useReviewWrite";

export default function ReviewShelfScreen({ items, formats, isMD }: { items: IntakeItem[]; formats: { id: number; format_name: string }[] | undefined; isMD: boolean }) {
  const reviewers = useGetReviewersQuery(undefined, { skip: !isMD });
  const [checkout] = useCheckoutIntakeItemMutation();
  const [requestReview] = useRequestIntakeItemMutation();
  const { write, lock } = useReviewWrite(items);
  const onShelf = items.filter((i) => i.effective_state === "pool");

  // Names the request picker's group for the record it acts on.
  const shelfRecordId = (i: IntakeItem) => `review-shelf-record-${i.id}`;
  const describe = (i: IntakeItem) => recordLine(intakeRecord(i), formats);

  return (
    <>
      {isMD && hasNothingToShow(reviewers) && <Typography role="alert">{REVIEW_COPY.intake.reviewersLoadFailed}</Typography>}
      <IntakeLane title={REVIEW_COPY.screen.shelfTitle} rows={onShelf} empty={REVIEW_COPY.screen.shelfEmpty} label={(i) => (isMD ? <Link id={shelfRecordId(i)} href={`/dashboard/admin/intake/${i.id}`}>{describe(i)}</Link> : <Typography>{describe(i)}</Typography>)} extra={(i) => (
        <>
          <Typography level="body-sm">{`${REVIEW_COPY.screen.logged} ${day(i.logged_at)}`}</Typography>
          <Button size="sm" {...lock(i.id, "checkout")} onClick={() => write(i.id, "checkout", () => checkout(i.id).unwrap())}>{byKind(i, { disc: REVIEW_COPY.screen.checkOut, digital: REVIEW_COPY.screen.take })}</Button>
          {isMD && (
            <IntakeRequestPicker
              reviewers={reviewers.data ?? []}
              labelledBy={shelfRecordId(i)}
              busy={lock(i.id, "request")}
              onRequest={(djId) => write(i.id, "request", () => requestReview({ id: i.id, djId }).unwrap())}
            />
          )}
        </>
      )} />
    </>
  );
}
