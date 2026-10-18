"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Box, Button, Chip, Divider, Radio, RadioGroup, Stack, Typography } from "@mui/joy";
import type { IntakeItem, IntakeItemPatch, Review } from "@wxyc/shared";
import { displayedArtist, isVariousArtists } from "@/lib/features/catalog/libraryCode";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { namedAuthor } from "@/lib/features/reviews/author";
import { itemHolder } from "@/lib/features/reviews/holder";
import { byKind, isFiledState, recordKind } from "@/lib/features/reviews/kind";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import {
  isIntakeAlreadyFiled,
  isIntakeInvalidCitation,
  isIntakeNotReviewed,
  isIntakeReleaseRefused,
  isIntakeStateChanged,
  useDeleteIntakeItemMutation,
  useFileIntakeItemMutation,
  useGetIntakeItemQuery,
  useUpdateIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { useGetAlbumReviewsForReleaseQuery } from "@/lib/features/reviews/albumReviewApi";
import { reviewApi, useGetItemReviewsQuery, useGetReviewQuery, useGetReviewsForReleaseQuery } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useLeaveGuard } from "@/src/hooks/useLeaveGuard";
import { useMounted } from "@/src/hooks/useRowWrite";
import ConfirmDialog from "../ConfirmDialog";
import HeadedSection from "./HeadedSection";
import LeaveDialog from "./LeaveDialog";
import RotationFilingBench, { type FilingSubmit } from "../admin/rotation/RotationFilingBench";
import { REVIEW_COPY } from "./copy";
import FccNotesPanel from "./FccNotesPanel";
import { useGetInformationQuery } from "@/lib/features/catalog/api";
import IntakeProgress from "./IntakeProgress";
import { intakeRecord, recordLine, releaseRecord } from "./recordLine";
import RecordHeader from "./RecordHeader";
import ReleasePicker from "./ReleasePicker";
import { fromLine, newestFirst, placeLine } from "./ReviewFrom";
import { CiteSection, RemoveCitation } from "./CiteControls";
import DeleteReviewButton from "./DeleteReviewButton";
import UseThisReviewButton from "./UseThisReviewButton";
import { EMPTY_START, PAPER_START, formReviewStart, type RecordFormStart } from "@/lib/features/reviews/formReviewStart";
import RecordPrompt, { type OpenSection } from "./RecordPrompt";
import RecordReviewForm from "./RecordReviewForm";
import { Group } from "./ReviewsPanel";
import { useItemPageReload } from "./useItemPageReload";
import type { PrintedVersion } from "./usePrintedVersion";

const COPY = REVIEW_COPY.intakeItem;

/** Two columns from a page 800px wide (a 1440px window beside both sidebars is about 826). The side column holds only the FCC notes; the main column keeps at least about 456px at that width. */
const TWO_COLUMNS = "@container (min-width: 800px)";

/**
 * A query's `data` is the last result the hook rendered, so it ignores a write into the cache while a read is pending
 * or has failed; `currentData` is the cache's own. The page reads the latter, so an answer written after a successful
 * write (`acceptReview`, `createReview`) still shows when the reread that follows fails.
 */
const fromCache = <R extends { currentData?: unknown }>(result: R) => ({ ...result, data: result.currentData as R["currentData"] });

/** Distinct non-empty names, in first-appearance order. */
const distinctNames = (names: (string | null | undefined)[]) => [...new Set(names.filter((n): n is string => !!n))];

const STATE_LABELS: Record<Exclude<IntakeItem["effective_state"], "pool">, string> = {
  requested: REVIEW_COPY.intake.requested,
  checked_out: REVIEW_COPY.intake.checkedOut,
  reviewed: REVIEW_COPY.intake.reviewed,
  filed: REVIEW_COPY.intake.filed,
  finalized: REVIEW_COPY.intake.filed,
};

/** The record form's starting values and the key it mounts under; `cites` is the form review a copied start came from, which saving the review then cites. */
export type Recording = { start: RecordFormStart; key: number; cites?: { id: number; submittedAt: string | null } };

/** The next value for the open form when a source opens it from `start`: the key always differs from the open form's, so a form already open remounts with the new start. */
export function nextRecording(open: Recording | null, start: RecordFormStart, cites?: Recording["cites"]): Recording {
  return { start, key: (open?.key ?? 0) + 1, cites };
}

/** The music directors' page for one logged record: its reviews, and the filing bench. */
export default function IntakeItemScreen({ id }: { id: number }) {
  const visible = useCanSeeReviews();
  // Which filing form is open, and which have been opened: a form once opened stays mounted (hidden) so switching keeps what was typed.
  const [arm, setArm] = useState<"new" | "existing" | null>(null);
  const [opened, setOpened] = useState({ new: false, existing: false });
  const fileItId = useId();
  // Set once the record is gone: its reads stop (they would 404) and the page shows only this line.
  const [deletedLine, setDeletedLine] = useState<string | null>(null);
  const item = useGetIntakeItemQuery(id, { skip: !visible || deletedLine !== null, selectFromResult: fromCache });
  const reviews = useGetItemReviewsQuery(id, { skip: !visible || deletedLine !== null, selectFromResult: fromCache });
  const [fileItem, filing] = useFileIntakeItemMutation();
  const [deleteItem, deletion] = useDeleteIntakeItemMutation();
  const [updateItem, citation] = useUpdateIntakeItemMutation();
  // The item as the latest render saw it: a save that began on an earlier render must still read what the record cites now.
  const latestItem = useRef(item.data);
  latestItem.current = item.data;
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picked, setPicked] = useState<AlbumEntry | null>(null);
  // The open form's starting values and its key, or null when closed. Every opening goes through openRecording, which gives the form a key unlike the open one's, so the form remounts with the new start.
  const [recording, setRecording] = useState<Recording | null>(null);
  // The cite search open under the prompt row, if any; only one of it and the form is open at a time.
  const [citing, setCiting] = useState<"release" | "form" | null>(null);
  const citedId = item.data?.cited_album_id ?? null;
  const unfiled = !!item.data && !isFiledState(item.data.effective_state);
  const isCited = citedId !== null || item.data?.cited_submission_id != null;
  // The cite buttons and their search exist only on a record that is unfiled and cites nothing. When that stops being true (the record is filed, or a citation lands, even from elsewhere), the search closes and its choice is forgotten, so it cannot reopen on its own when the page next rereads. The reset happens during render, so a press parked behind the leave dialog cannot set it after the fact.
  const canCite = unfiled && !isCited;
  if (!canCite && citing !== null) {
    setCiting(null);
  }
  const citeOpen = canCite ? citing : null;
  // Whether the open form holds unsaved text, and the close or replace waiting on the leave dialog's answer.
  const [recordingDirty, setRecordingDirty] = useState(false);
  const [asked, setAsked] = useState<(() => void) | null>(null);
  const leaveGuard = useLeaveGuard(recordingDirty);
  // A parked close or replace asks about unsaved text; when the form goes clean (saved and closed) the question is moot.
  useEffect(() => {
    if (!recordingDirty) setAsked(null);
  }, [recordingDirty]);
  const stayOnRecording = () => {
    setAsked(null);
    leaveGuard.stay();
  };
  const leaveRecording = () => {
    asked?.();
    setAsked(null);
    leaveGuard.leave();
  };
  const unlessDirty = (act: () => void) => (recordingDirty ? setAsked(() => act) : act());
  const openRecording = (start: RecordFormStart, cites?: Recording["cites"]) =>
    unlessDirty(() => {
      setCiting(null);
      setRecording((open) => nextRecording(open, start, cites));
    });
  const openSection: OpenSection = recording ? "record" : citeOpen;
  // Pressing a button closes its own section, or replaces the open one; a dirty form asks first.
  const toggleSection = (which: NonNullable<OpenSection>) => {
    if (which === "record") {
      if (openSection === "record") {
        unlessDirty(() => setRecording(null));
      } else {
        openRecording(EMPTY_START);
      }
      return;
    }
    unlessDirty(() => {
      setRecording(null);
      setCiting(citeOpen === which ? null : which);
    });
  };
  // One count per review write in flight or rereading, so neither a review button nor the form's Save acts on the stale cover.
  // `movers` counts the writes that move the cover (Use this review, a ticked Record a review). Each write takes a handle from `hold` and releases it exactly once.
  const [holds, setHolds] = useState({ all: 0, movers: 0 });

  // Current answers only: when the citation changes, the old release's name and list must not show while the new one's reads are out.
  const cited = useGetReviewsForReleaseQuery(citedId ?? 0, { skip: !visible || citedId === null, selectFromResult: fromCache });
  // The cited release's own name: the item carries only its id.
  const citedRelease = useGetInformationQuery({ album_id: citedId ?? 0 }, { skip: !visible || citedId === null, selectFromResult: fromCache });
  // The cited release's own reviews, less the one on the cover, which shows under "The review on the cover".
  const citedTyped = (cited.data ?? []).filter((r) => r.album_id === citedId && r.status === "submitted" && r.medium === "typed");
  // Only the empty state shows the form archive's reviews, so they are read only once the typed list is known to be empty.
  const citedArchive = useGetAlbumReviewsForReleaseQuery(citedId ?? 0, { skip: !visible || citedId === null || cited.data === undefined || citedTyped.length > 0, selectFromResult: fromCache });
  const dispatch = useAppDispatch();

  const coverId = item.data?.accepted_review_id ?? null;
  const ownCover = reviews.data?.find((r) => r.id === coverId);
  // The review on the cover can be one of a cited or filed release, which the item's own list lacks.
  // Decided once: the query below reads it and the reload refreshes it, so the two cannot drift.
  const coverById = coverId != null && reviews.data && !ownCover ? coverId : undefined;
  const fetchedCover = useGetReviewQuery(coverById ?? 0, { skip: !visible || coverById === undefined });

  const cover = ownCover ?? (fetchedCover.data?.id === coverId ? fetchedCover.data : undefined);
  const isCover = (r: Review) => r.id === coverId;
  // A cover review may be one printed for another copy, so it is on this copy's cover only once this copy's own slip was printed.
  // The cover group's printed-version note, its print link and its tape all read this rule, so a later change moves them together.
  const isOnCover = (r: Review) => isCover(r) && item.data?.printed_at != null;

  const reload = useItemPageReload(id, coverById);
  const mounted = useMounted();
  const hold = (movesCover: boolean) => {
    const mover = movesCover ? 1 : 0;
    let released = false;
    setHolds((h) => ({ all: h.all + 1, movers: h.movers + mover }));
    return () => {
      if (released) return;
      released = true;
      setHolds((h) => ({ all: h.all - 1, movers: h.movers - mover }));
    };
  };
  // Rereads, then releases the write's handle; a write that took none (Delete review) takes and releases its own.
  const reviewWritten = async (release: () => void = hold(false)) => {
    await reload();
    release();
  };
  const awaitingReread = holds.all > 0;
  const movingCover = holds.movers > 0;

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

  // The cited release's section is drawn only once its reviews have answered and its name has answered or failed.
  const citedShown = citedId !== null && !!cited.data && (!!citedRelease.data || citedRelease.isError);
  // Clearing a release's citation takes a review chosen from it off the cover, which is any cover review the item's own list lacks.
  const coverFromCited = citedId !== null && coverId != null && (!ownCover || ownCover.album_id === citedId);
  const holder = itemHolder(item.data);
  // A pool record's chip is its location line, so a record with a review waiting never reads On the review shelf; a pool digital album with a review waiting has no line and no chip.
  const state = item.data.effective_state;
  const chipLabel =
    state === "pool"
      ? placeLine(item.data)
      : state === "checked_out"
        ? byKind(item.data, { disc: STATE_LABELS.checked_out, digital: REVIEW_COPY.screen.taken })
        : STATE_LABELS[state];
  // Only a requested or checked-out record asks before a citation; a reviewed record still out with its DJ asks nothing.
  const citeQuestion =
    holder.kind === "requested" ? COPY.citeAsked(holder.name) : holder.kind === "checked_out" && item.data.effective_state === "checked_out" ? COPY.citeTaken(holder.name) : null;
  const coverConfirmation =
    recordKind(item.data) === "digital"
      ? COPY.deleteCoverShelf
      : holder.kind === "checked_out"
        ? COPY.deleteCoverHeld(holder.name)
        : holder.kind === "removed"
          ? COPY.deleteCoverRemoved
          : COPY.deleteCoverShelf;
  const deleteConfirmation = (review: Review) => {
    const author = namedAuthor(review);
    return isCover(review) ? coverConfirmation : author ? COPY.deleteReviewConfirm(author) : REVIEW_COPY.deleteConfirm;
  };
  const deleteControl = (review: Review) =>
    // Every review of this record can be deleted, drafts included; a cited release's review is deleted from its own record's page.
    review.intake_item_id === id && (
      <DeleteReviewButton
        review={review}
        confirmation={deleteConfirmation(review)}
        blocked={isCover(review) && isFiledState(item.data!.effective_state)}
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
        {submittedHere && <UseThisReviewButton itemId={id} review={review} replacing={coverId != null || movingCover} disabled={awaitingReread} reload={reload} onHold={hold} onWritten={reviewWritten} onNotice={setNotice} />}
        {deleteControl(review)}
      </>
    );
  };

  // Its review is read by id from here on, so it goes into that cache before the reread: a failed reread cannot take the cover off the page.
  const chooseCited = (review: Review) => (release: () => void) => {
    dispatch(reviewApi.util.upsertQueryData("getReview", review.id, review));
    return reviewWritten(release);
  };
  const citedExtra = (review: Review) => (
    <UseThisReviewButton itemId={id} review={review} replacing={coverId != null || movingCover} disabled={awaitingReread} reload={reload} onHold={hold} onWritten={chooseCited(review)} onNotice={setNotice} />
  );
  const citedIntro =
    citedTyped.length > 0 ? (
      <Typography>{COPY.citedChoose}</Typography>
    ) : (
      <>
        <Typography>{COPY.citedNone}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="plain" onClick={() => openRecording(EMPTY_START)}>{COPY.typeInReview}</Button>
          <Button variant="plain" onClick={() => openRecording(PAPER_START)}>{COPY.copyByPen}</Button>
        </Stack>
        {citedArchive.data?.map((take) => (
          <Stack key={take.id} spacing={0.5}>
            <Typography component="blockquote" level="body-sm" sx={{ m: 0 }}>{take.review}</Typography>
            <Button variant="outlined" size="sm" onClick={() => openRecording(formReviewStart(take))} sx={{ alignSelf: "flex-start" }}>{COPY.copyOntoRecord}</Button>
          </Stack>
        ))}
      </>
    );

  const stillOut = cover && recordKind(item.data) === "disc" && holder.kind === "checked_out" && holder.name && holder.id !== cover.author_user_id ? COPY.stillOutWith(holder.name) : null;
  // Under the cover slip: the button that prints it (or the line that says a handwritten review needs none), then the still-out line.
  const coverLead = (review: Review, printedVersion: PrintedVersion) => (
    <>
      {review.medium === "handwritten" ? (
        <Typography>{REVIEW_COPY.intakeSlip.handwritten}</Typography>
      ) : (
        <Button component={Link} href={`/dashboard/admin/intake/${id}/slip`} sx={{ alignSelf: "flex-start" }}>
          {printedVersion === "edited" ? REVIEW_COPY.printedNote.printNew : COPY.printSlip}
        </Button>
      )}
      {stillOut && <Typography>{stillOut}</Typography>}
    </>
  );

  // Setting or clearing a citation can take the cover review off, so it holds the page like a review write; the reload also shows a refusal's cause.
  // Answers the line it set, for a caller whose own line would otherwise replace it, and whether a reload ran.
  const changeCitation = async (body: IntakeItemPatch, invalid?: string, failed: string = REVIEW_COPY.screen.writeFailed) => {
    if (citation.isLoading) {
      return { line: failed, reloaded: false };
    }
    setNotice(null);
    const release = hold(false);
    try {
      try {
        await updateItem({ id, body }).unwrap();
      } catch (err) {
        const refusal = isIntakeAlreadyFiled(err) ? COPY.alreadyFiled : invalid && isIntakeInvalidCitation(err) ? invalid : null;
        const line = refusal ?? failed;
        // Only a refusal the server worded reloads the record.
        const reloaded = refusal !== null;
        if (reloaded ? (await reload()).mounted : mounted.current) {
          setNotice(line);
        }
        return { line, reloaded };
      }
      await reload();
      return { line: undefined, reloaded: true };
    } finally {
      release();
    }
  };

  // A copied form review's save: the review is recorded first, so a refused or failed citation loses nothing. The page's hold is released once the citation's write and reload settle.
  const citeCopied = (cites: NonNullable<Recording["cites"]>) => async (release: () => void) => {
    // A citation made since the copy was opened stays: setting this one would switch it and take its cover review off.
    const current = latestItem.current;
    const cited = current?.cited_album_id != null || (current?.cited_submission_id != null && current.cited_submission_id !== cites.id);
    const { line, reloaded } = cited
      ? { line: COPY.formNotNoted, reloaded: false }
      : await changeCitation({ cited_submission_id: cites.id }, cites.submittedAt === null ? COPY.formNoDate : COPY.formAfterCutover, COPY.formNotNoted);
    // A save that sent no write, or whose write failed for another reason, reloaded nothing itself, so the create's own reread may still be settling.
    if (!reloaded) {
      await reload();
    }
    release();
    return line;
  };

  // The intake refusals are worded here; the server's text is never shown.
  const submitNew: FilingSubmit = async (request) => {
    setNotice(null);
    // A filing moves no cover. Its success path makes no reload of its own and relies on the mutation's refetch, so the handle outlives the unwrap and is released only after the awaited reload joins that refetch.
    const release = hold(false);
    try {
      try {
        await fileItem({ id, body: { kind: "new_release", ...request } }).unwrap();
      } catch (err) {
        const refusal = isIntakeStateChanged(err) ? COPY.alreadyFiled : isIntakeNotReviewed(err) ? COPY.notReviewed : null;
        if (refusal === null) throw unwrapEndpointError("intakeWriteError", err) ?? err;
        if ((await reload()).mounted) setNotice(refusal);
        // Nothing was filed, so the bench keeps what was typed.
        return false;
      }
      await reload();
    } finally {
      release();
    }
  };

  const fileOntoPicked = async () => {
    if (picked?.id == null || filing.isLoading) return;
    setNotice(null);
    const release = hold(false);
    try {
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
        return;
      }
      await reload();
    } finally {
      release();
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

  const removeCitation = (
    <RemoveCitation
      asksFirst={coverFromCited}
      disabled={awaitingReread}
      onRemove={() => {
        setCiting(null);
        return changeCitation(citedId !== null ? { cited_album_id: null } : { cited_submission_id: null });
      }}
    />
  );

  return (
    <Box sx={{ containerType: "inline-size" }}>
      <Stack spacing={2}>
        <RecordHeader record={record} headingLevel={3} chip={chipLabel && <Chip>{chipLabel}</Chip>} />
        <IntakeProgress item={item.data} />
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)", [TWO_COLUMNS]: { gridTemplateColumns: "minmax(0, 1fr) minmax(16rem, 20rem)", alignItems: "start" } }}>
          <Stack data-column="main" spacing={2}>
            {cover ? (
              <Group title={REVIEW_COPY.albumPanel.coverOne} reviews={[cover]} recordOf={recordOf} newSlipHref={`/dashboard/admin/intake/${id}/slip`} onCover={isOnCover} lead={coverLead} extra={deleteControl} />
            ) : (
              coverId == null && <Typography>{COPY.noCover}</Typography>
            )}
            {others.length > 0 && <Group title={REVIEW_COPY.albumPanel.others} reviews={others} recordOf={recordOf} onCover={() => false} mode="excerpt" showSlip extra={othersExtra} />}
            {citedShown && (
              <Group title={citedRelease.data ? COPY.citedHeading(displayedArtist(citedRelease.data.alternate_artist, citedRelease.data.artist.name, isVariousArtists(citedRelease.data.artist.lettercode)), citedRelease.data.title) : COPY.citedFallbackHeading} intro={citedIntro} reviews={citedTyped.filter((r) => r.id !== coverId).sort(newestFirst)} recordOf={() => undefined} onCover={() => false} mode="excerpt" showSlip titleExtra={unfiled && removeCitation} extra={citedExtra} />
            )}
            {!!item.data.draft_authors?.length && (
              <Typography level="body-sm">{COPY.stillWriting} {item.data.draft_authors.join(", ")}.</Typography>
            )}
            {notice && <Typography role="status">{notice}</Typography>}
            <RecordPrompt
              open={openSection}
              onToggle={toggleSection}
              cite={canCite}
              disabled={awaitingReread}
              removal={unfiled && isCited && !citedShown ? removeCitation : undefined}
            />
            {recording && (
              <RecordReviewForm
                key={recording.key}
                start={recording.start}
                itemId={id}
                hasCover={coverId != null || movingCover}
                disabled={awaitingReread}
                onHold={hold}
                onWritten={recording.cites ? citeCopied(recording.cites) : reviewWritten}
                onNotice={setNotice}
                onDirtyChange={setRecordingDirty}
                onClose={() => setRecording(null)}
              />
            )}
            {citeOpen && (
              <CiteSection
                which={citeOpen}
                artist={item.data.artist_name}
                question={citeQuestion}
                onCite={(albumId) => changeCitation({ cited_album_id: albumId }, COPY.releaseRefused)}
                onCopy={(take) => openRecording(formReviewStart(take), { id: take.id, submittedAt: take.submitted_at })}
              />
            )}
            {isFiledState(item.data.effective_state) ? (
              <Typography>{COPY.filed}</Typography>
            ) : coverId == null ? (
              <Typography>{COPY.chooseFirst}</Typography>
            ) : (
              <HeadedSection title={COPY.fileIt} titleId={fileItId} spacing={2}>
                <RadioGroup
                  aria-labelledby={fileItId}
                  orientation="horizontal"
                  value={arm}
                  onChange={(e) => {
                    const next = e.target.value as "new" | "existing";
                    setArm(next);
                    setOpened((o) => ({ ...o, [next]: true }));
                  }}
                >
                  <Radio value="new" label={COPY.fileNew} />
                  <Radio value="existing" label={COPY.fileExisting} />
                </RadioGroup>
                {opened.new && (
                  <Stack spacing={2} hidden={arm !== "new"} sx={arm !== "new" ? { display: "none" } : undefined}>
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
                  </Stack>
                )}
                {opened.existing && (
                  <Stack spacing={2} hidden={arm !== "existing"} sx={arm !== "existing" ? { display: "none" } : undefined}>
                    <ReleasePicker onPick={setPicked} selectedId={picked?.id ?? null} onSearch={() => setPicked(null)} />
                    {picked && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button onClick={fileOntoPicked} loading={filing.isLoading}>{COPY.fileOnto}</Button>
                        <Typography>{recordLine(releaseRecord(picked))}</Typography>
                      </Stack>
                    )}
                  </Stack>
                )}
              </HeadedSection>
            )}
          </Stack>
          <Box data-column="side">
            <FccNotesPanel intakeItemId={id} />
          </Box>
          {unfiled && (
            <Stack spacing={2} sx={{ gridColumn: "1 / -1" }}>
              <Divider />
              <Typography level="body-sm">{COPY.deleteRecordHint}</Typography>
              <Button color="neutral" variant="plain" onClick={() => setConfirmingDelete(true)} sx={{ alignSelf: "flex-start" }}>
                {COPY.delete}
              </Button>
            </Stack>
          )}
        </Box>
        <LeaveDialog open={leaveGuard.pending || asked !== null} onLeave={leaveRecording} onStay={stayOnRecording}>
          {REVIEW_COPY.leave.recordBody}
        </LeaveDialog>
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
      </Stack>
    </Box>
  );
}
