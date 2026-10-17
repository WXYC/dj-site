"use client";

import { useState, type ReactNode } from "react";
import { Button, Chip, Link, Stack, Typography } from "@mui/joy";
import type { IntakeItem, Review } from "@wxyc/shared";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useAcceptIntakeItemMutation,
  usePassIntakeItemMutation,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { useCreateReviewMutation } from "@/lib/features/reviews/reviewApi";
import { byKind, overdueMark } from "@/lib/features/reviews/kind";
import ConfirmDialog from "../ConfirmDialog";
import IntakeLane from "./IntakeLane";
import { REVIEW_COPY } from "./copy";
import RecordRow from "./RecordRow";
import { intakeRecord, recordLine } from "./recordLine";
import { useReviewRecord } from "./useReviewRecord";
import { day, type ReviewWrite } from "./useReviewWrite";

/** A review's row: the record as parts (artist, album, label) once it has landed. Until then, a library review shows `myReviews.libraryRelease` and a logged-record review shows nothing in its place. Either way the row carries the status, the last-saved date and Open. */
function MyReviewRow({ review }: { review: Review }) {
  const record = useReviewRecord(review);
  const fromLibrary = review.intake_item_id == null && review.album_id != null;
  const meta = (
    <>
      {fromLibrary && <Chip size="sm" variant="outlined">{REVIEW_COPY.myReviews.fromTheLibrary}</Chip>}
      <Chip size="sm">{review.status === "draft" ? REVIEW_COPY.myReviews.draft : REVIEW_COPY.myReviews.submitted}</Chip>
      <Typography level="body-sm">{`${REVIEW_COPY.myReviews.lastSaved} ${day(review.last_modified)}`}</Typography>
    </>
  );
  const open = <Link href={`/dashboard/reviews/${review.id}`}>{REVIEW_COPY.myReviews.open}</Link>;
  if (record) {
    return <RecordRow record={record} meta={<Stack direction="row" spacing={1} alignItems="center">{meta}</Stack>} actions={open} />;
  }
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      {review.intake_item_id == null && <Typography>{REVIEW_COPY.myReviews.libraryRelease}</Typography>}
      {meta}
      {open}
    </Stack>
  );
}

/** The requests, checkouts and My reviews lanes. It assumes its caller has applied the `useCanSeeReviews` check and the load-failed gate, and takes the one `useReviewWrite` the caller shares with the review shelf. `between` renders after the checkouts lane and before My reviews, where the form for a new record and the review shelf sit. */
export default function MyReviewsScreen({ items, myReviews, formats, me, between, write, lock }: { items: IntakeItem[]; myReviews: Review[]; formats: { id: number; format_name: string }[] | undefined; me: string | undefined; between?: ReactNode } & ReviewWrite) {
  const [accept] = useAcceptIntakeItemMutation();
  const [pass] = usePassIntakeItemMutation();
  const [release] = useReleaseIntakeItemMutation();
  const [createReview] = useCreateReviewMutation();
  const router = useRouter();
  const [returning, setReturning] = useState<IntakeItem | null>(null);
  const [passing, setPassing] = useState<IntakeItem | null>(null);

  const requests = items.filter((i) => i.effective_state === "requested" && i.requested_dj_id === me);
  const checkouts = [
    ...items.filter((i) => i.effective_state === "checked_out" && i.checked_out_by === me),
    ...items.filter((i) => i.effective_state === "reviewed" && i.checked_out_by === me),
  ];
  const describe = (i: IntakeItem) => recordLine(intakeRecord(i), formats);

  return (
    <>
      <IntakeLane title={REVIEW_COPY.screen.requestsTitle} rows={requests} empty={REVIEW_COPY.screen.requestsEmpty} row={(i) => (
        <RecordRow
          record={intakeRecord(i)}
          meta={<Typography level="body-sm">{`${REVIEW_COPY.screen.asked} ${day(i.requested_at)}`}</Typography>}
          actions={
            <>
              <Button
                size="sm"
                {...lock(i.id, "accept")}
                onClick={() =>
                  write(i.id, "accept", async () => {
                    await accept(i.id).unwrap();
                    // The record is the DJ's now, so a create that fails is its own toast: neither a lost race nor the generic failure.
                    try {
                      const draft = myReviews.find((r) => r.intake_item_id === i.id && r.status === "draft");
                      const review = draft ?? (await createReview({ intake_item_id: i.id }).unwrap());
                      router.push(`/dashboard/reviews/${review.id}?arrived=request`);
                    } catch {
                      toast.error(REVIEW_COPY.couldNotStart);
                    }
                  })
                }
              >
                {REVIEW_COPY.writeReview}
              </Button>
              <Button size="sm" variant="outlined" {...lock(i.id, "pass")} onClick={() => setPassing(i)}>{REVIEW_COPY.screen.pass}</Button>
            </>
          }
        />
      )} />
      <IntakeLane title={REVIEW_COPY.screen.checkoutsTitle} rows={checkouts} empty={REVIEW_COPY.screen.checkoutsEmpty} label={(i) => <Typography>{describe(i)}</Typography>} extra={(i) => {
        const mineHere = myReviews.filter((r) => r.intake_item_id === i.id);
        const submitted = mineHere.find((r) => r.status === "submitted");
        const draft = mineHere.find((r) => r.status === "draft");
        const reviewed = i.effective_state === "reviewed";
        const mark = overdueMark(i);
        const note = reviewed
          ? byKind(i, { disc: REVIEW_COPY.screen.reviewedReturn, digital: null })
          : submitted
            ? REVIEW_COPY.screen.reviewSubmitted
            : byKind(i, { disc: null, digital: REVIEW_COPY.screen.filesComing });
        return (
        <>
          <Typography level="body-sm">{`${REVIEW_COPY.screen.taken} ${day(i.checked_out_at)}`}</Typography>
          {mark && <Chip color="danger">{mark}</Chip>}
          {note && <Typography level="body-sm">{note}</Typography>}
          {submitted ? (
            <Button size="sm" variant={reviewed ? "outlined" : "solid"} onClick={() => router.push(`/dashboard/reviews/${submitted.id}`)}>{REVIEW_COPY.screen.editReview}</Button>
          ) : (
            <Button
              size="sm"
              variant={reviewed ? "outlined" : "solid"}
              {...lock(i.id, "write")}
              onClick={() =>
                write(i.id, "write", async () => {
                  const review = draft ?? (await createReview({ intake_item_id: i.id }).unwrap());
                  router.push(`/dashboard/reviews/${review.id}`);
                })
              }
            >
              {REVIEW_COPY.writeReview}
            </Button>
          )}
          <Button size="sm" variant={reviewed ? "solid" : "outlined"} {...lock(i.id, "release")} onClick={() => setReturning(i)}>{REVIEW_COPY.screen.returnToShelf}</Button>
        </>
        );
      }} />
      {between}
      <IntakeLane title={REVIEW_COPY.myReviews.title} rows={myReviews} empty={REVIEW_COPY.myReviews.empty} row={(r) => <MyReviewRow review={r} />} />
      <ConfirmDialog
        open={returning !== null}
        onClose={() => setReturning(null)}
        title={REVIEW_COPY.screen.returnToShelf}
        actions={
          <>
            <Button
              onClick={async () => {
                const id = returning!.id;
                setReturning(null);
                await write(id, "release", () => release(id).unwrap());
              }}
            >
              {REVIEW_COPY.screen.returnToShelf}
            </Button>
            <Button variant="plain" onClick={() => setReturning(null)}>{REVIEW_COPY.screen.cancel}</Button>
          </>
        }
      >
        {returning && byKind(returning, { disc: REVIEW_COPY.screen.returnQuestion, digital: REVIEW_COPY.screen.returnQuestionDigital })}
      </ConfirmDialog>
      <ConfirmDialog
        open={passing !== null}
        onClose={() => setPassing(null)}
        title={passing && REVIEW_COPY.screen.passTitle(passing.album_title, passing.artist_name)}
        actions={
          <>
            <Button
              onClick={async () => {
                const id = passing!.id;
                setPassing(null);
                await write(id, "pass", async () => {
                  await pass(id).unwrap();
                  toast.success(REVIEW_COPY.screen.passed);
                });
              }}
            >
              {REVIEW_COPY.screen.pass}
            </Button>
            <Button variant="plain" onClick={() => setPassing(null)}>{REVIEW_COPY.screen.cancel}</Button>
          </>
        }
      >
        {REVIEW_COPY.screen.passConfirm}
      </ConfirmDialog>
    </>
  );
}
