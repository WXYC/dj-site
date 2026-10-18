"use client";

import { useState } from "react";
import { Button, Chip, Link, List, ListItem, Stack, Typography } from "@mui/joy";
import type { IntakeItem, Review } from "@wxyc/shared";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMounted } from "@/src/hooks/useRowWrite";
import {
  useAcceptIntakeItemMutation,
  usePassIntakeItemMutation,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { useCreateReviewMutation } from "@/lib/features/reviews/reviewApi";
import { itemHolder } from "@/lib/features/reviews/holder";
import { byKind, overdueMark } from "@/lib/features/reviews/kind";
import { editorHref } from "@/lib/features/reviews/paths";
import { rowKey, sortMyReviews, STAGES, type MyReviewsRow, type Stage } from "@/lib/features/reviews/myReviews";
import ConfirmDialog from "../ConfirmDialog";
import StageChips from "../StageChips";
import { REVIEW_COPY } from "./copy";
import RecordRow from "./RecordRow";
import { intakeRecord } from "./recordLine";
import { useReviewRecord } from "./useReviewRecord";
import { day, type ReviewWrite } from "./useReviewWrite";

/** A review's row: the record as parts (artist, album, label) once it has landed. Until then, a library review shows `myReviews.libraryRelease` and a logged-record review shows nothing in its place. Either way the row carries the status, the last-saved date and Open. */
function MyReviewRow({ review, href, cover }: { review: Review; href: string; cover: 72 | 56 }) {
  const record = useReviewRecord(review);
  const fromLibrary = review.intake_item_id == null && review.album_id != null;
  const meta = (
    <>
      {fromLibrary && <Chip size="sm" variant="outlined">{REVIEW_COPY.myReviews.fromTheLibrary}</Chip>}
      <Chip size="sm">{review.status === "draft" ? REVIEW_COPY.myReviews.draft : REVIEW_COPY.myReviews.submitted}</Chip>
      <Typography level="body-sm">{`${REVIEW_COPY.myReviews.lastSaved} ${day(review.last_modified)}`}</Typography>
    </>
  );
  const open = <Link href={href}>{REVIEW_COPY.myReviews.open}</Link>;
  if (record) {
    return <RecordRow record={record} cover={cover} meta={<Stack direction="row" spacing={1} alignItems="center">{meta}</Stack>} actions={open} />;
  }
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      {review.intake_item_id == null && <Typography>{REVIEW_COPY.myReviews.libraryRelease}</Typography>}
      {meta}
      {open}
    </Stack>
  );
}

/** Submitted and Published show this many reviews at a time. */
const PAGE_SIZE = 20;

/** Open reviews are the DJ's own records, with 72 px covers; Submitted and Published are the denser list, at 56 px. */
const coverFor = (stage: Stage): 72 | 56 => (stage === "open" ? 72 : 56);

/** The DJ's request row: who asked, when the record names them. */
function requestLine(i: IntakeItem): string {
  const holder = itemHolder(i);
  const date = day(i.requested_at);
  return holder.kind === "requested" && holder.askedBy ? REVIEW_COPY.screen.requestedBy(holder.askedBy, date) : REVIEW_COPY.screen.requestedNoAsker(date);
}

/** The Open reviews, Submitted and Published stages. It assumes its caller has applied the `useCanSeeReviews` check and the load-failed gate, and takes the `useReviewWrite` the caller built for this tab: the review shelf is a separate tab with its own write wiring, so a lock set here does not carry over to it. */
export default function MyReviewsScreen({ items, myReviews, me, write, lock }: { items: IntakeItem[]; myReviews: Review[]; me: string | undefined } & ReviewWrite) {
  const [accept] = useAcceptIntakeItemMutation();
  const [pass] = usePassIntakeItemMutation();
  const [release] = useReleaseIntakeItemMutation();
  const [createReview] = useCreateReviewMutation();
  const router = useRouter();
  // Every opener carries the stage its row is drawn under, which is the one StageChips shows (its fallback included), so the editor's back link returns to the stage the DJ was looking at.
  const openHref = (id: number, stage: Stage, extra?: Record<string, string>) => editorHref(id, { from: "mine", stage }, extra);
  // A write outlives the screen when the DJ navigates away mid-click; what it does after that (open the editor, toast) is skipped.
  const mounted = useMounted();
  const [returning, setReturning] = useState<IntakeItem | null>(null);
  const [passing, setPassing] = useState<IntakeItem | null>(null);
  // How many rows each stage shows; a stage that was never asked for shows one page.
  const [shown, setShown] = useState<Partial<Record<Stage, number>>>({});

  const lanes = sortMyReviews(items, myReviews, me);

  const requestRow = (i: IntakeItem, stage: Stage) => (
    <RecordRow
      record={intakeRecord(i)}
      cover={coverFor(stage)}
      meta={<Typography level="body-sm">{requestLine(i)}</Typography>}
      actions={
        <>
          <Button
            size="sm"
            {...lock(i.id, "accept")}
            onClick={() =>
              write(i.id, "accept", async () => {
                await accept(i.id).unwrap();
                // The record is the DJ's now, so a create that fails is its own toast: neither a lost race nor the generic failure. A DJ who has left the page gets neither the editor nor the toast; the record is in their list either way.
                try {
                  const draft = myReviews.find((r) => r.intake_item_id === i.id && r.status === "draft");
                  const review = draft ?? (await createReview({ intake_item_id: i.id }).unwrap());
                  if (mounted.current) {
                    router.push(openHref(review.id, stage, { arrived: "request" }));
                  }
                } catch {
                  if (mounted.current) {
                    toast.error(REVIEW_COPY.couldNotStart);
                  }
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
  );

  const heldRow = (i: IntakeItem, stage: Stage) => {
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
      <RecordRow
        record={intakeRecord(i)}
        cover={coverFor(stage)}
        meta={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography level="body-sm">{`${REVIEW_COPY.screen.reviewingSince} ${day(i.checked_out_at)}`}</Typography>
            {mark && <Chip color="danger">{mark}</Chip>}
            {note && <Typography level="body-sm">{note}</Typography>}
          </Stack>
        }
        actions={
          <>
            {submitted ? (
              <Button size="sm" variant={reviewed ? "outlined" : "solid"} onClick={() => router.push(openHref(submitted.id, stage))}>{REVIEW_COPY.screen.editReview}</Button>
            ) : (
              <Button
                size="sm"
                variant={reviewed ? "outlined" : "solid"}
                {...lock(i.id, "write")}
                onClick={() =>
                  write(i.id, "write", async () => {
                    const review = draft ?? (await createReview({ intake_item_id: i.id }).unwrap());
                    if (mounted.current) {
                      router.push(openHref(review.id, stage));
                    }
                  })
                }
              >
                {REVIEW_COPY.writeReview}
              </Button>
            )}
            <Button size="sm" variant={reviewed ? "solid" : "outlined"} {...lock(i.id, "release")} onClick={() => setReturning(i)}>{REVIEW_COPY.screen.returnToShelf}</Button>
          </>
        }
      />
    );
  };

  const renderRow = (row: MyReviewsRow, stage: Stage) => {
    switch (row.kind) {
      case "request":
        return requestRow(row.item, stage);
      case "held":
        return heldRow(row.item, stage);
      case "review":
        return <MyReviewRow review={row.review} href={openHref(row.review.id, stage)} cover={coverFor(stage)} />;
    }
  };

  return (
    <>
      <StageChips
        label={REVIEW_COPY.myReviews.stagesLabel}
        stages={STAGES.map((id) => ({ id, label: REVIEW_COPY.myReviews.stages[id], count: lanes[id].length }))}
        fallback={lanes.open.length > 0 ? "open" : "submitted"}
      >
        {(stage) => {
          const rows = lanes[stage];
          // Open reviews is the DJ's to-do list, so it is never cut short.
          const visible = stage === "open" ? rows : rows.slice(0, shown[stage] ?? PAGE_SIZE);
          if (rows.length === 0) {
            return <Typography level="body-sm">{stage === "open" ? REVIEW_COPY.myReviews.openEmpty : REVIEW_COPY.intake.empty}</Typography>;
          }
          return (
            <>
              <List>
                {visible.map((row) => (
                  <ListItem key={rowKey(row)}>{renderRow(row, stage)}</ListItem>
                ))}
              </List>
              {visible.length < rows.length && (
                <Button variant="plain" onClick={() => setShown({ ...shown, [stage]: visible.length + PAGE_SIZE })}>{REVIEW_COPY.myReviews.showOlder}</Button>
              )}
            </>
          );
        }}
      </StageChips>
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
                  if (mounted.current) {
                    toast.success(REVIEW_COPY.screen.passed);
                  }
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
