"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Chip, Link, List, ListItem, Stack, Typography } from "@mui/joy";
import type { IntakeItem, Review } from "@wxyc/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useMounted, type RowWriteOutcome } from "@/src/hooks/useRowWrite";
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
import { ADDED_FLASH_SX, bringMarkedIntoView } from "./addedFlash";
import { REVIEW_COPY } from "./copy";
import ActionTooltip from "./ActionTooltip";
import RecordRow, { PRIMARY_CONTROL } from "./RecordRow";
import { intakeRecord } from "./recordLine";
import { useReviewRecord, type ReviewRecord } from "./useReviewRecord";
import { day, type ReviewWrite } from "./useReviewWrite";

/** The draft or submitted chip and the last-saved date, shared by a review's row and a held record's row that has a draft. */
function ReviewMeta({ review, fromLibrary = false }: { review: Review; fromLibrary?: boolean }) {
  return (
    <>
      {fromLibrary && <Chip size="sm" variant="outlined">{REVIEW_COPY.myReviews.fromTheLibrary}</Chip>}
      <Chip size="sm">{review.status === "draft" ? REVIEW_COPY.myReviews.draft : REVIEW_COPY.myReviews.submitted}</Chip>
      <Typography level="body-sm">{`${REVIEW_COPY.myReviews.lastSaved} ${day(review.last_modified)}`}</Typography>
    </>
  );
}

/** The ids that put a row's artist and album in its buttons' names, keyed by the row's own key so no two rows share one. */
const recordIds = (key: string) => ({ artist: `my-reviews-${key}-artist`, album: `my-reviews-${key}-album` });

/** The title and album-line props that give a row's artist and album the ids `namedByRecord` points at. */
const recordNaming = (key: string, record: ReviewRecord) => ({
  titleSlot: <Typography level="title-md" id={recordIds(key).artist}>{record.artist}</Typography>,
  titleId: recordIds(key).artist,
  albumId: recordIds(key).album,
});

/** Names a row's button by its own words, then the row's artist and album, so a screen reader's list of buttons tells one row's Pass or Open draft from another's. The row must draw its record with `recordNaming`. */
const namedByRecord = (key: string, button: string) => {
  const id = `my-reviews-${key}-${button}`;
  return { id, "aria-labelledby": `${id} ${recordIds(key).artist} ${recordIds(key).album}` };
};

/** A review's row: the record as parts (artist, album, label) once it has landed. Until then, a library review shows `myReviews.libraryRelease` and a logged-record review shows nothing in its place. Either way the row carries the status, the last-saved date and Open, or Open draft for a draft. A draft on a record the DJ no longer has opens with a button and says the draft is saved; the lists cannot tell whether the DJ passed or returned the record, so the line says neither. */
function MyReviewRow({ review, href, cover }: { review: Review; href: string; cover: 72 | 56 }) {
  const record = useReviewRecord(review);
  const fromLibrary = review.intake_item_id == null && review.album_id != null;
  const router = useRouter();
  const draft = review.status === "draft";
  const kept = draft && review.intake_item_id != null;
  const key = rowKey({ kind: "review", review });
  // The record's ids exist only once the record has landed; until then the opener is named by its own words.
  const naming = draft && record ? namedByRecord(key, "open") : {};
  const meta = (
    <>
      <ReviewMeta review={review} fromLibrary={fromLibrary} />
      {kept && <Typography level="body-sm">{REVIEW_COPY.myReviews.draftSaved}</Typography>}
    </>
  );
  const open = kept ? (
    <ActionTooltip title={REVIEW_COPY.tooltips.openEditor}><Button size="sm" {...naming} onClick={() => router.push(href)}>{REVIEW_COPY.myReviews.openDraft}</Button></ActionTooltip>
  ) : (
    <Link href={href} {...naming}>{draft ? REVIEW_COPY.myReviews.openDraft : REVIEW_COPY.myReviews.open}</Link>
  );
  if (record) {
    return <RecordRow record={record} cover={cover} {...recordNaming(key, record)} meta={<Stack direction="row" spacing={1} alignItems="center">{meta}</Stack>} actions={open} />;
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
  // A request the DJ is passing on, or a record the DJ has; the held one reads `checked_out` or `reviewed`.
  const [passing, setPassing] = useState<IntakeItem | null>(null);
  const passingHeld = passing !== null && passing.effective_state !== "requested";
  const hasDraft = (id: number) => myReviews.some((r) => r.intake_item_id === id && r.status === "draft");
  const hasSubmitted = (id: number) => myReviews.some((r) => r.intake_item_id === id && r.status === "submitted");
  // How many rows each stage shows; a stage that was never asked for shows one page.
  const [shown, setShown] = useState<Partial<Record<Stage, number>>>({});
  // The list the shown stage draws, while it has rows.
  const list = useRef<HTMLUListElement | null>(null);
  // The held record the review shelf's Open it sent the DJ to: its row is marked for a moment and brought into view.
  const highlight = Number(useSearchParams().get("highlight"));
  const highlighted = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (highlighted.current) {
      bringMarkedIntoView(highlighted.current);
    }
  }, [highlight]);

  const lanes = sortMyReviews(items, myReviews, me);
  const isHighlighted = (row: MyReviewsRow) => row.kind === "held" && row.item.id === highlight;

  /**
   * Pass and Mark as returned take their row away once the write lands, and a lost race's reload moves the record too, so
   * the focus would fall to the page. It goes to the next row's main control (`PRIMARY_CONTROL`), else the previous row's, else the
   * stage's panel. The neighbours are read before the write, while the row is drawn; React keeps each keyed row's
   * element, so they are still the rows to focus whether or not the reload has been drawn yet. A failed write leaves the
   * row, and the focus with it.
   */
  const focusAfterLeaving = (key: string) => {
    const row = Array.from(list.current?.children ?? []).find((el) => el instanceof HTMLElement && el.dataset.row === key);
    const neighbours = [row?.nextElementSibling, row?.previousElementSibling];
    const panel = row?.closest<HTMLElement>("[role='tabpanel']");
    return (outcome: RowWriteOutcome) => {
      if ((outcome !== "applied" && outcome !== "raced") || !mounted.current) {
        return;
      }
      const next = neighbours.find((el) => el?.isConnected)?.querySelector<HTMLElement>(PRIMARY_CONTROL);
      (next ?? panel)?.focus();
    };
  };

  const requestRow = (i: IntakeItem, stage: Stage, key: string) => (
    <RecordRow
      record={intakeRecord(i)}
      cover={coverFor(stage)}
      {...recordNaming(key, intakeRecord(i))}
      meta={<Typography level="body-sm">{requestLine(i)}</Typography>}
      actions={
        <>
          <ActionTooltip title={REVIEW_COPY.tooltips.writeRequest}>
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
          </ActionTooltip>
          <ActionTooltip title={REVIEW_COPY.tooltips.passRequest}><Button size="sm" variant="outlined" {...namedByRecord(key, "pass")} {...lock(i.id, "pass")} onClick={() => setPassing(i)}>{REVIEW_COPY.screen.pass}</Button></ActionTooltip>
        </>
      }
    />
  );

  const heldRow = (i: IntakeItem, stage: Stage, key: string) => {
    const mineHere = myReviews.filter((r) => r.intake_item_id === i.id);
    const submitted = mineHere.find((r) => r.status === "submitted");
    const draft = mineHere.find((r) => r.status === "draft");
    const reviewed = i.effective_state === "reviewed";
    const mark = overdueMark(i);
    const canPass = i.effective_state === "checked_out" && i.submitted_review_count === 0;
    const note = reviewed
      ? byKind(i, { disc: REVIEW_COPY.screen.reviewedReturn, digital: null })
      : submitted
        ? REVIEW_COPY.screen.reviewSubmitted
        : byKind(i, { disc: null, digital: REVIEW_COPY.screen.filesComing });
    return (
      <RecordRow
        record={intakeRecord(i)}
        cover={coverFor(stage)}
        {...recordNaming(key, intakeRecord(i))}
        meta={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography level="body-sm">{`${REVIEW_COPY.screen.reviewingSince} ${day(i.checked_out_at)}`}</Typography>
            {mark && <Chip color="danger">{mark}</Chip>}
            {draft && <ReviewMeta review={draft} />}
            {note && <Typography level="body-sm">{note}</Typography>}
          </Stack>
        }
        actions={
          <>
            {submitted ? (
              <Button size="sm" variant={reviewed ? "outlined" : "solid"} onClick={() => router.push(openHref(submitted.id, stage))}>{REVIEW_COPY.screen.editReview}</Button>
            ) : draft ? (
              <ActionTooltip title={REVIEW_COPY.tooltips.openEditor}><Button size="sm" variant={reviewed ? "outlined" : "solid"} {...namedByRecord(key, "open")} onClick={() => router.push(openHref(draft.id, stage))}>{REVIEW_COPY.myReviews.openDraft}</Button></ActionTooltip>
            ) : (
              <ActionTooltip title={REVIEW_COPY.tooltips.openEditor}>
              <Button
                size="sm"
                variant={reviewed ? "outlined" : "solid"}
                {...lock(i.id, "write")}
                onClick={() =>
                  write(i.id, "write", async () => {
                    const review = await createReview({ intake_item_id: i.id }).unwrap();
                    if (mounted.current) {
                      router.push(openHref(review.id, stage));
                    }
                  })
                }
              >
                {REVIEW_COPY.writeReview}
              </Button>
              </ActionTooltip>
            )}
            {canPass ? (
              <ActionTooltip title={REVIEW_COPY.tooltips.passHeld}><Button size="sm" variant="outlined" {...namedByRecord(key, "pass")} {...lock(i.id, "passHeld")} onClick={() => setPassing(i)}>{REVIEW_COPY.screen.pass}</Button></ActionTooltip>
            ) : (
              !i.digital && <Button size="sm" variant={reviewed ? "solid" : "outlined"} {...lock(i.id, "release")} onClick={() => setReturning(i)}>{REVIEW_COPY.intake.returned}</Button>
            )}
          </>
        }
      />
    );
  };

  const renderRow = (row: MyReviewsRow, stage: Stage) => {
    switch (row.kind) {
      case "request":
        return requestRow(row.item, stage, rowKey(row));
      case "held":
        return heldRow(row.item, stage, rowKey(row));
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
              <List ref={list}>
                {visible.map((row) => (
                  <ListItem key={rowKey(row)} data-row={rowKey(row)} {...(isHighlighted(row) && { ref: highlighted, "data-highlighted": "true", sx: ADDED_FLASH_SX })}>{renderRow(row, stage)}</ListItem>
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
        title={REVIEW_COPY.intake.returned}
        actions={
          <>
            <Button
              onClick={async () => {
                const id = returning!.id;
                // Read before the write, while the DJ's own list still says what they had sent.
                const reviewWaits = hasSubmitted(id);
                const follow = focusAfterLeaving(rowKey({ kind: "held", item: returning! }));
                setReturning(null);
                follow(
                  await write(id, "release", async () => {
                    await release(id).unwrap();
                    // Only a DJ whose review is in hears where it is; any other return says nothing, as the row's leaving says it.
                    if (mounted.current && reviewWaits) {
                      toast.success(REVIEW_COPY.screen.returnedWaiting);
                    }
                  }),
                );
              }}
            >
              {REVIEW_COPY.intake.returned}
            </Button>
            <Button variant="plain" onClick={() => setReturning(null)}>{REVIEW_COPY.screen.cancel}</Button>
          </>
        }
      >
        {returning &&
          [
            REVIEW_COPY.screen.returnQuestion,
            hasSubmitted(returning.id) && REVIEW_COPY.screen.markReturnedKeep,
            hasDraft(returning.id) && REVIEW_COPY.screen.passDraftSaved,
          ]
            .filter(Boolean)
            .join(" ")}
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
                const follow = focusAfterLeaving(rowKey({ kind: passingHeld ? "held" : "request", item: passing! }));
                setPassing(null);
                follow(
                  await write(id, passingHeld ? "passHeld" : "pass", async () => {
                    await pass(id).unwrap();
                    if (mounted.current) {
                      toast.success(REVIEW_COPY.screen.passed);
                    }
                  }),
                );
              }}
            >
              {REVIEW_COPY.screen.pass}
            </Button>
            <Button variant="plain" onClick={() => setPassing(null)}>{REVIEW_COPY.screen.cancel}</Button>
          </>
        }
      >
        {passing &&
          [
            REVIEW_COPY.screen.passConfirm,
            passingHeld && !passing.digital && REVIEW_COPY.screen.passBringDisc,
            passingHeld && hasDraft(passing.id) && REVIEW_COPY.screen.passDraftSaved,
          ]
            .filter(Boolean)
            .join(" ")}
      </ConfirmDialog>
    </>
  );
}
