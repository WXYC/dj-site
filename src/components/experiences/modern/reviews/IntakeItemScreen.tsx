"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Chip, Stack, Typography } from "@mui/joy";
import type { IntakeItem, Review } from "@wxyc/shared";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { itemHolder } from "@/lib/features/reviews/holder";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import {
  isIntakeAlreadyFiled,
  isIntakeNotReviewed,
  isIntakeReleaseRefused,
  isIntakeStateChanged,
  useDeleteIntakeItemMutation,
  useFileIntakeItemMutation,
  useGetIntakeItemQuery,
} from "@/lib/features/reviews/intakeApi";
import { useGetItemReviewsQuery, useGetReviewQuery } from "@/lib/features/reviews/reviewApi";
import { unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useMounted } from "@/src/hooks/useRowWrite";
import ConfirmDialog from "../ConfirmDialog";
import RotationFilingBench, { type FilingSubmit } from "../admin/rotation/RotationFilingBench";
import { REVIEW_COPY } from "./copy";
import FccNotesPanel from "./FccNotesPanel";
import { intakeRecord, recordLine, releaseRecord } from "./recordLine";
import ReleasePicker from "./ReleasePicker";
import { fromLine, newestFirst } from "./ReviewFrom";
import DeleteReviewButton from "./DeleteReviewButton";
import UseThisReviewButton from "./UseThisReviewButton";
import { Group } from "./ReviewsPanel";
import { useItemPageReload } from "./useItemPageReload";
import { usePrintedVersion } from "./usePrintedVersion";

const COPY = REVIEW_COPY.intakeItem;

/** Distinct non-empty names, in first-appearance order. */
const distinctNames = (names: (string | null | undefined)[]) => [...new Set(names.filter((n): n is string => !!n))];

const STATE_LABELS: Record<IntakeItem["effective_state"], string> = {
  pool: REVIEW_COPY.intake.onShelf,
  requested: REVIEW_COPY.intake.requested,
  checked_out: REVIEW_COPY.intake.checkedOut,
  reviewed: REVIEW_COPY.intake.reviewed,
  filed: REVIEW_COPY.intake.filed,
  finalized: REVIEW_COPY.intake.filed,
};

/** A record whose review is already on the library entry: nothing is left to file. */
const isFiledState = (state: IntakeItem["effective_state"]) => state === "filed" || state === "finalized";

/** The music directors' page for one logged record: its reviews, and the filing bench. */
export default function IntakeItemScreen({ id }: { id: number }) {
  const visible = useCanSeeReviews();
  // Set once the record is gone: its reads stop (they would 404) and the page shows only this line.
  const [deletedLine, setDeletedLine] = useState<string | null>(null);
  const item = useGetIntakeItemQuery(id, { skip: !visible || deletedLine !== null });
  const reviews = useGetItemReviewsQuery(id, { skip: !visible || deletedLine !== null });
  const [fileItem, filing] = useFileIntakeItemMutation();
  const [deleteItem, deletion] = useDeleteIntakeItemMutation();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picked, setPicked] = useState<AlbumEntry | null>(null);
  // Set from a successful review write until the page's reload settles, so no review button acts on the stale cover.
  const [awaitingReread, setAwaitingReread] = useState(false);

  const coverId = item.data?.accepted_review_id ?? null;
  const ownCover = reviews.data?.find((r) => r.id === coverId);
  // The review on the cover can be one of a cited or filed release, which the item's own list lacks.
  // Decided once: the query below reads it and the reload refreshes it, so the two cannot drift.
  const coverById = coverId != null && reviews.data && !ownCover ? coverId : undefined;
  const fetchedCover = useGetReviewQuery(coverById ?? 0, { skip: !visible || coverById === undefined });

  const cover = ownCover ?? (fetchedCover.data?.id === coverId ? fetchedCover.data : undefined);
  // The one cover rule: the print link's hook call and the cover group below both read it, so a later gate change moves them together.
  const isOnCover = (r: Review) => r.id === coverId;
  const printedVersion = usePrintedVersion(cover, { onCover: cover != null && isOnCover(cover) });

  const reload = useItemPageReload(id, coverById);
  const mounted = useMounted();
  const reviewWritten = async () => {
    setAwaitingReread(true);
    await reload();
    if (mounted.current) setAwaitingReread(false);
  };

  if (!visible) return null;
  if (deletedLine !== null) return <Typography role="status">{deletedLine}</Typography>;
  if ([item, reviews, fetchedCover].some(hasNothingToShow)) {
    return <Typography role="alert">{COPY.loadFailed}</Typography>;
  }
  if (!item.data || !reviews.data) return null;

  const record = intakeRecord(item.data);
  const recordOf = (review: Review) => (review.intake_item_id === id ? record : undefined);
  const others = reviews.data
    .filter((r) => r.id !== coverId)
    .sort(newestFirst);

  const holder = itemHolder(item.data);
  const coverConfirmation =
    holder.kind === "checked_out" ? COPY.deleteCoverHeld(holder.name) : holder.kind === "removed" ? COPY.deleteCoverRemoved : COPY.deleteCoverShelf;
  // Every review of this record can be deleted, drafts included; a cited release's review is deleted from its own record's page.
  const deleteControl = (review: Review) =>
    review.intake_item_id === id && (
      <DeleteReviewButton
        review={review}
        confirmation={isOnCover(review) ? coverConfirmation : COPY.deleteReviewConfirm(review.author ?? "")}
        blocked={isOnCover(review) && isFiledState(item.data!.effective_state)}
        disabled={awaitingReread}
        reload={reload}
        onWritten={reviewWritten}
        onNotice={setNotice}
      />
    );

  // The From line and Use this review are for a submitted review of this record only.
  const othersExtra = (review: Review) => {
    const submittedHere = review.status === "submitted" && review.intake_item_id === id;
    const line = submittedHere ? fromLine(review, item.data!) : null;
    return (
      <>
        {line && <Typography level="body-sm">{line}</Typography>}
        {submittedHere && <UseThisReviewButton itemId={id} review={review} replacing={coverId != null || awaitingReread} disabled={awaitingReread} reload={reload} onWritten={reviewWritten} onNotice={setNotice} />}
        {deleteControl(review)}
      </>
    );
  };

  const stillOut = cover && holder.kind === "checked_out" && holder.name && holder.id !== cover.author_user_id ? COPY.stillOutWith(holder.name) : null;

  // The intake refusals are worded here; the server's text is never shown.
  const submitNew: FilingSubmit = async (request) => {
    setNotice(null);
    try {
      await fileItem({ id, body: { kind: "new_release", ...request } }).unwrap();
    } catch (err) {
      const refusal = isIntakeStateChanged(err) ? COPY.alreadyFiled : isIntakeNotReviewed(err) ? COPY.notReviewed : null;
      if (refusal === null) throw unwrapEndpointError("intakeWriteError", err) ?? err;
      if ((await reload()).mounted) setNotice(refusal);
      // Nothing was filed, so the bench keeps what was typed.
      return false;
    }
  };

  const fileOntoPicked = async () => {
    if (picked?.id == null || filing.isLoading) return;
    setNotice(null);
    try {
      await fileItem({ id, body: { kind: "existing_release", album_id: picked.id } }).unwrap();
    } catch (err) {
      // Only a refusal the server worded reloads the record; any other failure files nothing and says so.
      const refusal = isIntakeStateChanged(err)
        ? COPY.alreadyFiled
        : isIntakeNotReviewed(err)
          ? COPY.notReviewed
          : isIntakeReleaseRefused(err)
            ? COPY.pickedGone
            : null;
      if (refusal === null) {
        if (mounted.current) setNotice(COPY.fileFailed);
        return;
      }
      if ((await reload()).mounted) setNotice(refusal);
    }
  };

  // The names are for this confirmation only: they never go to analytics, breadcrumbs or logs.
  // The item's reviews also include drafts the caller can see; only submitted ones are named as reviews.
  const reviewAuthors = distinctNames(reviews.data.filter((r) => r.status === "submitted").map((r) => r.author));
  const draftAuthors = distinctNames(item.data.draft_authors ?? []);
  const confirmDelete = async () => {
    try {
      const { deleted_review_authors } = await deleteItem(id).unwrap();
      if (!mounted.current) return;
      const names = distinctNames(deleted_review_authors);
      setDeletedLine(names.length > 0 ? COPY.deleted(names) : COPY.deletedPlain);
    } catch (err) {
      // A delete that lost a race to a filing is a notice, and the page reloads to show the record as filed.
      const lostRace = isIntakeAlreadyFiled(err);
      if (lostRace && !(await reload()).mounted) return;
      if (!mounted.current) return;
      setConfirmingDelete(false);
      setNotice(lostRace ? COPY.alreadyFiled : COPY.deleteFailed);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography level="title-lg">{recordLine(record)}</Typography>
        <Chip>{STATE_LABELS[item.data.effective_state]}</Chip>
      </Stack>
      {cover ? (
        <Group title={REVIEW_COPY.albumPanel.coverOne} reviews={[cover]} recordOf={recordOf} newSlipHref={`/dashboard/admin/intake/${id}/slip`} onCover={isOnCover} extra={deleteControl} />
      ) : (
        coverId == null && <Typography>{COPY.noCover}</Typography>
      )}
      {others.length > 0 && <Group title={REVIEW_COPY.albumPanel.others} reviews={others} recordOf={recordOf} onCover={() => false} extra={othersExtra} />}
      {!!item.data.draft_authors?.length && (
        <Typography level="body-sm">{COPY.stillWriting} {item.data.draft_authors.join(", ")}.</Typography>
      )}
      <FccNotesPanel intakeItemId={id} />
      {notice && <Typography role="status">{notice}</Typography>}
      {!isFiledState(item.data.effective_state) && (
        <Button color="danger" variant="outlined" onClick={() => setConfirmingDelete(true)} sx={{ alignSelf: "flex-start" }}>
          {COPY.delete}
        </Button>
      )}
      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        pending={deletion.isLoading}
        title={COPY.deleteTitle(item.data.artist_name, item.data.album_title)}
        titleId="delete-intake-item-title"
        actions={
          <>
            <Button variant="plain" onClick={() => setConfirmingDelete(false)} disabled={deletion.isLoading}>{COPY.keep}</Button>
            <Button color="danger" loading={deletion.isLoading} onClick={confirmDelete}>{COPY.delete}</Button>
          </>
        }
      >
        {reviewAuthors.length > 0 && <Typography>{COPY.deleteReviews(reviewAuthors)}</Typography>}
        {draftAuthors.length > 0 && <Typography>{COPY.deleteDrafts(draftAuthors)}</Typography>}
        {reviewAuthors.length + draftAuthors.length === 0 && <Typography>{COPY.deleteNoReviews}</Typography>}
        <Typography>{COPY.deleteFinal}</Typography>
      </ConfirmDialog>
      {coverId != null &&
        (cover?.medium === "handwritten" ? (
          <Typography>{REVIEW_COPY.intakeSlip.handwritten}</Typography>
        ) : (
          <Link href={`/dashboard/admin/intake/${id}/slip`}>{printedVersion === "edited" ? REVIEW_COPY.printedNote.printNew : COPY.printSlip}</Link>
        ))}
      {stillOut && <Typography>{stillOut}</Typography>}
      {isFiledState(item.data.effective_state) ? (
        <Typography>{COPY.filed}</Typography>
      ) : coverId == null ? (
        <Typography>{COPY.chooseFirst}</Typography>
      ) : (
        <>
          <Typography level="title-sm" component="h3">{COPY.fileNew}</Typography>
          <RotationFilingBench
            submit={submitNew}
            initial={{
              artist: item.data.artist_name,
              album: item.data.album_title,
              label: item.data.record_label ?? "",
              formatId: item.data.format_id,
              discogsReleaseId: item.data.discogs_release_id,
            }}
          />
          <Typography level="title-sm" component="h3">{COPY.fileExisting}</Typography>
          <ReleasePicker onPick={setPicked} selectedId={picked?.id ?? null} onSearch={() => setPicked(null)} />
          {picked && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button onClick={fileOntoPicked} loading={filing.isLoading}>{COPY.fileOnto}</Button>
              <Typography>{recordLine(releaseRecord(picked))}</Typography>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
