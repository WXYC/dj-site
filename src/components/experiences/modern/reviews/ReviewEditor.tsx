"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { editorBack, type EditorOrigin } from "@/lib/features/reviews/paths";
import { Box, Button, Link as JoyLink, Stack, Typography } from "@mui/joy";
import type { Review, ReviewPatch } from "@wxyc/shared";
import { skipToken } from "@reduxjs/toolkit/query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Authorization } from "@/lib/features/admin/types";
import type { User } from "@/lib/features/authentication/types";
import { useGetIntakeItemQuery } from "@/lib/features/reviews/intakeApi";
import { byKind } from "@/lib/features/reviews/kind";
import {
  isReviewInUse,
  isReviewNotDraft,
  useDeleteReviewMutation,
  useGetReviewQuery,
  useSubmitReviewMutation,
  useUpdateReviewMutation,
} from "@/lib/features/reviews/reviewApi";
import { useGetFccNotesQuery } from "@/lib/features/reviews/fccNoteApi";
import { CONSENT_KEYS, FIELD_NAMES } from "@/lib/features/reviews/draftKeys";
import { clearReviewDraft, readReviewDraft, writeReviewDraft } from "@/lib/features/reviews/reviewDrafts";
import { serverMessage, unwrapEndpointErrorOrRaw } from "@/lib/rtk-endpoint-error";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import ConfirmDialog from "../ConfirmDialog";
import { VISUALLY_HIDDEN } from "../visuallyHidden";
import HeadedSection from "./HeadedSection";
import LeaveDialog from "./LeaveDialog";
import ConsentBlock, { type Consent } from "./ConsentBlock";
import { REVIEW_COPY } from "./copy";
import FccNotesPanel from "./FccNotesPanel";
import PrintedVersionNote from "./PrintedVersionNote";
import RecordHeader from "./RecordHeader";
import SlipFields, { patchChanged, toFieldPatch, toFieldValues } from "./SlipFields";
import SlipPreview from "./SlipPreview";
import { formatSlipDate } from "./slipDate";
import { useReviewRecord } from "./useReviewRecord";
import { STICKY_ROOM_PROPERTY, useStickyRoom } from "./useStickyRoom";
import { useLeaveGuard } from "@/src/hooks/useLeaveGuard";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { APPBAR_CLEARANCE_PX } from "@/src/components/shared/Theme/Appbar";

/** Two columns from an editor 800px wide (a 1440px window beside both sidebars is about 826): the form takes the rest but never under 20rem, and the slip column is sized from its content (the slip is a fixed 4.25in, so its min-content), which puts the 8px of padding for the slip's shadow and a classic scrollbar's reserved gutter outside the slip. At a 16px root font size the slip then stays 4.25in and the form keeps 352px at 800px (335px beside a 17px scrollbar); where 20rem is larger (a larger root font size) the column's track shrinks, down to nothing, and the slip narrows with it (its max-width is 100%) instead of the grid scrolling sideways. A long unbroken token in an FCC note wraps inside the form column (overflow-wrap is inherited, so it is set on the FCC panel's wrapper alone and the slip keeps wrapping as it does in one column and on paper). */
const TWO_COLUMNS = "@container (min-width: 800px)";

/** The page's h2 while no record heading stands in for it, so the outline never skips a level. */
function HiddenTitle() {
  return (
    <Typography level="h2" sx={VISUALLY_HIDDEN}>
      {REVIEW_COPY.pageTitle}
    </Typography>
  );
}

type Confirming = "submit" | "delete" | null;

/** A kept draft read as this editor would send it: a key the editor does not send (blank FCC where the field is not offered, consent from a non-author) is ignored, and a key the draft lacks stays as saved. */
const keptFor = (saved: ReviewPatch, kept: ReviewPatch): ReviewPatch =>
  Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, k in kept ? kept[k as keyof ReviewPatch] : v])) as ReviewPatch;

/** The record's confirmed FCC notes as the print carries them: the intake item's and the release's, a note on both counted once, oldest first. A failed read contributes none. The notes are the review's own subject's (its `intake_item_id` and `album_id`), not those of a copy that cites this review: a typed review a copy accepts through its citation prints with that copy's notes, which this preview does not show. */
function useConfirmedFccNotes(review: Review): string[] {
  const forItem = useGetFccNotesQuery(review.intake_item_id != null ? { intake_item_id: review.intake_item_id } : skipToken);
  const forRelease = useGetFccNotesQuery(review.album_id != null ? { album_id: review.album_id } : skipToken);
  const byId = new Map([...(forItem.data ?? []), ...(forRelease.data ?? [])].map((n) => [n.id, n]));
  return [...byId.values()]
    .filter((n) => n.status === "confirmed")
    .sort((a, b) => a.reported_at.localeCompare(b.reported_at) || a.id - b.id)
    .map((n) => `${n.track}: ${n.note}`);
}

function Form({ review, user, arrivedFromRequest, origin }: { review: Review; user: User | undefined; arrivedFromRequest: boolean; origin: EditorOrigin }) {
  const userId = user?.id ?? "";
  const isAuthor = user?.id != null && user.id === review.author_user_id;
  const isMusicDirector = !isAuthor && (user?.authority ?? Authorization.NO) >= Authorization.MD;
  const [values, setValues] = useState(() => toFieldValues(review));
  const [consent, setConsent] = useState<Consent>(() => Object.fromEntries(CONSENT_KEYS.map((k) => [k, review[k]])) as Consent);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [refusedInUse, setRefusedInUse] = useState(false);
  const [update, { isLoading }] = useUpdateReviewMutation();
  const [submit, { isLoading: submitting }] = useSubmitReviewMutation();
  const [remove, { isLoading: deleting }] = useDeleteReviewMutation();
  const router = useRouter();
  const record = useReviewRecord(review);
  const back = editorBack(origin);
  // The same read useReviewRecord holds, so no second request.
  const intakeItem = useGetIntakeItemQuery(review.intake_item_id ?? skipToken).data;
  const fccNotes = useConfirmedFccNotes(review);
  const { root, bar } = useStickyRoom<HTMLDivElement, HTMLDivElement>();
  const reasonId = useId();
  // The free-text FCC field is for a paper review (every medium but typed, as `blank` below) and for text already stored or kept unsaved in this tab, so a kept entry's FCC text can be offered back; a typed review reports FCC through the panel. Settled at load, so clearing the text does not take the field away.
  const [fccField] = useState(
    () => review.medium !== "typed" || [review.fcc, readReviewDraft(userId, review.id)?.fcc].some((text) => (text ?? "").trim() !== ""),
  );
  // A field the editor does not offer stays out of the patch, so the service keeps what it holds.
  const fields = FIELD_NAMES.filter((name) => name !== "fcc" || fccField);
  const notesSubject = review.intake_item_id != null ? { intakeItemId: review.intake_item_id } : review.album_id != null ? { albumId: review.album_id } : null;
  const draft = review.status === "draft";
  // Only a typed review needs text to submit; a handwritten one may go in with none.
  const blank = review.medium === "typed" && values.review.trim() === "";
  const inUse = review.in_use || refusedInUse;
  // The marker stays in the URL, so the line also asks whether it is still true: the author's draft, of a record they still hold.
  const arrivalLine =
    arrivedFromRequest && isAuthor && draft && intakeItem && intakeItem.checked_out_by === user?.id ? byKind(intakeItem, REVIEW_COPY.arrived) : null;

  // A non-author's patch carries no consent: the service accepts it only from the author.
  const patch = (): ReviewPatch => ({
    ...toFieldPatch(values, fields),
    ...(isAuthor ? consent : {}),
  });
  // What the service holds: the review as loaded, then whatever the last save sent.
  const [saved, setSaved] = useState(patch);
  const [deleted, setDeleted] = useState(false);
  const dirty = !deleted && patchChanged(saved, patch());
  const leaveGuard = useLeaveGuard(dirty);
  // Text left unsaved when this review's editor was last open in this tab, offered back until the DJ answers or edits.
  const [offer, setOffer] = useState(() => {
    const kept = readReviewDraft(userId, review.id);
    const offered = kept && keptFor(saved, kept);
    return offered && patchChanged(saved, offered) ? offered : null;
  });
  // Back is not guarded (the router owns history), so the unsaved text is kept in the tab instead; while the offer stands the form is clean and the kept text must survive.
  useEffect(() => {
    if (offer) return;
    if (dirty) writeReviewDraft(userId, review.id, patch());
    else clearReviewDraft(userId, review.id);
  }, [offer, dirty, userId, review.id, JSON.stringify(patch())]); // eslint-disable-line react-hooks/exhaustive-deps -- patch() is rebuilt each render; its JSON is the value that matters
  const restore = () => {
    if (!offer) {
      return;
    }
    setValues((current) => ({ ...current, ...Object.fromEntries(fields.map((k) => [k, offer[k] ?? ""])) }));
    if (isAuthor) {
      setConsent((c) => ({ ...c, ...Object.fromEntries(CONSENT_KEYS.filter((k) => k in offer).map((k) => [k, offer[k]])) }));
    }
    setOffer(null);
  };
  const failure = (err: unknown, fallback: string) =>
    toast.error(serverMessage(unwrapEndpointErrorOrRaw("reviewWriteError", err)?.data) ?? fallback);

  const save = async () => {
    try {
      const sent = patch();
      await update({ id: review.id, patch: sent }).unwrap();
      setSaved(sent);
      toast.success(draft ? REVIEW_COPY.saved : REVIEW_COPY.savedChange);
    } catch (err) {
      failure(err, REVIEW_COPY.couldNotSave);
    }
  };

  const submitReview = async () => {
    setConfirming(null);
    try {
      const sent = patch();
      await update({ id: review.id, patch: sent }).unwrap();
      setSaved(sent);
      setOffer(null);
      await submit(review.id).unwrap();
    } catch (err) {
      if (isReviewNotDraft(err)) toast.error(REVIEW_COPY.alreadySubmitted);
      else failure(err, REVIEW_COPY.couldNotSubmit);
    }
  };

  const deleteReview = async () => {
    setConfirming(null);
    try {
      await remove(review.id).unwrap();
      // The review is gone, so nothing is left to save: the form goes clean before the redirect, which may be a full load, whatever was typed while the request was out.
      setDeleted(true);
      clearReviewDraft(userId, review.id);
      // My reviews is where the DJ's drafts live, and where the editor was opened from.
      router.replace("/dashboard/reviews/mine");
    } catch (err) {
      if (isReviewInUse(err)) setRefusedInUse(true);
      else toast.error(REVIEW_COPY.couldNotDelete);
    }
  };

  const status = isAuthor
    ? draft
      ? REVIEW_COPY.draftPrivacy
      : REVIEW_COPY.submittedBanner
    : isMusicDirector
      ? REVIEW_COPY.editingOthers(review.author ?? "", !draft && review.author_user_id != null)
      : null;

  return (
    <Box ref={root} sx={{ containerType: "inline-size" }}>
      {offer && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          <Typography level="body-sm" role="status">{REVIEW_COPY.restore.notice}</Typography>
          <Button size="sm" onClick={restore}>{REVIEW_COPY.restore.restore}</Button>
          <Button size="sm" variant="plain" onClick={() => { clearReviewDraft(userId, review.id); setOffer(null); }}>{REVIEW_COPY.restore.discard}</Button>
        </Stack>
      )}
      <JoyLink component={Link} href={back.href} level="body-sm">
        {back.label}
      </JoyLink>
      {record ? <RecordHeader record={record} /> : <HiddenTitle />}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 1 }}>
        {!draft && (
          <JoyLink component={Link} href={`/dashboard/reviews/${review.id}/history`} level="body-sm">
            {REVIEW_COPY.history.link}
          </JoyLink>
        )}
        <PrintedVersionNote review={review} onCover={review.in_use} />
      </Stack>
      {arrivalLine && <Typography level="body-sm" sx={{ mt: 1 }}>{arrivalLine}</Typography>}
      {status && <Typography level="body-sm" sx={{ mt: 1 }}>{status}</Typography>}
      <Box
        sx={{
          display: "grid",
          gap: 3,
          mt: 2,
          gridTemplateColumns: "minmax(0, 1fr)",
          [TWO_COLUMNS]: { gridTemplateColumns: "minmax(20rem, 1fr) minmax(0, min-content)", alignItems: "start" },
        }}
      >
        <Stack spacing={2}>
          <SlipFields values={values} fields={fields} onChange={(next) => { setOffer(null); setValues(next); }} />
          {notesSubject && (
            <Box sx={{ [TWO_COLUMNS]: { overflowWrap: "anywhere" } }}>
              <FccNotesPanel {...notesSubject} title={REVIEW_COPY.fields.fcc.label} help={REVIEW_COPY.fields.fcc.help} />
            </Box>
          )}
          {isAuthor ? (
            <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2 }}>
              <ConsentBlock value={consent} onChange={(next) => { setOffer(null); setConsent(next); }} djName={user?.djName} realName={user?.realName} />
            </Box>
          ) : (
            <Typography level="body-sm">{REVIEW_COPY.authorOnlyConsent}</Typography>
          )}
        </Stack>
        {/* Bounded by measuring the scroll region minus the bar (useStickyRoom), so no guess at the chrome around the region can drift. */}
        <Stack spacing={2} sx={{
            [TWO_COLUMNS]: { position: "sticky", top: 0, alignSelf: "start", maxHeight: `var(${STICKY_ROOM_PROPERTY}, none)`, overflowY: "auto", scrollbarGutter: "stable", px: 1, py: 1 },
          }}>
          <HeadedSection title={REVIEW_COPY.slip.heading} spacing={1}>
            <SlipPreview
              artist={record?.artist ?? ""}
              album={record?.album ?? ""}
              label={record?.label ?? ""}
              reviewer={review.author ?? ""}
              date={formatSlipDate(review.submitted_at ?? review.add_date)}
              fields={values}
              fccNotes={fccNotes}
            />
          </HeadedSection>
        </Stack>
      </Box>
      <Stack
        ref={bar}
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ position: "sticky", bottom: 0, mt: 2, py: 1, pb: { xs: `${APPBAR_CLEARANCE_PX}px`, md: 1 }, bgcolor: "background.body", borderTop: "1px solid", borderColor: "divider" }}
      >
        {isAuthor && (
          <Button color="neutral" variant="plain" loading={deleting} disabled={inUse} onClick={() => setConfirming("delete")}>
            {REVIEW_COPY.delete}
          </Button>
        )}
        {isAuthor && inUse && <Typography level="body-sm" role="status">{REVIEW_COPY.inUse}</Typography>}
        <Box sx={{ flex: 1 }} />
        <Typography level="body-sm" role="status">{dirty || offer ? REVIEW_COPY.unsavedChanges : REVIEW_COPY.allChangesSaved}</Typography>
        <Button variant={draft ? "outlined" : "solid"} loading={isLoading} disabled={!dirty} onClick={save}>
          {draft ? REVIEW_COPY.saveDraft : REVIEW_COPY.save}
        </Button>
        {draft && blank && <Typography id={reasonId} level="body-sm">{REVIEW_COPY.submitNeedsReview}</Typography>}
        {draft && (
          <Button loading={submitting} disabled={blank} aria-describedby={blank ? reasonId : undefined} onClick={() => setConfirming("submit")}>{REVIEW_COPY.submit}</Button>
        )}
      </Stack>
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === "delete" ? REVIEW_COPY.delete : REVIEW_COPY.submit}
        actions={
          <>
            <Button color={confirming === "delete" ? "danger" : "primary"} onClick={confirming === "delete" ? deleteReview : submitReview}>
              {confirming === "delete" ? REVIEW_COPY.delete : REVIEW_COPY.submit}
            </Button>
            <Button variant="plain" onClick={() => setConfirming(null)}>{REVIEW_COPY.cancel}</Button>
          </>
        }
      >
        {confirming === "delete"
          ? REVIEW_COPY.deleteConfirm
          : review.intake_item_id != null
            ? REVIEW_COPY.submitConfirmLogged
            : REVIEW_COPY.submitConfirmRelease}
      </ConfirmDialog>
      <LeaveDialog open={leaveGuard.pending} onLeave={leaveGuard.leave} onStay={leaveGuard.stay}>
        {REVIEW_COPY.leave.body}
      </LeaveDialog>
    </Box>
  );
}

/** `origin` is where the editor was opened from, which the back link returns to. `arrivedFromRequest` adds the line that says what the DJ holds after Write a review on a request, while the review is still the signed-in author's draft of a record they hold. */
export default function ReviewEditor({ id, arrivedFromRequest = false, origin = null }: { id: number; arrivedFromRequest?: boolean; origin?: EditorOrigin }) {
  const visible = useCanSeeReviews();
  const { data, isError } = useGetReviewQuery(id, { skip: !visible });
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;

  if (!visible) {
    return null;
  }
  if (hasNothingToShow({ isError, data })) {
    return (
      <>
        <HiddenTitle />
        <Typography role="alert">{REVIEW_COPY.couldNotLoad}</Typography>
      </>
    );
  }
  // Keyed by the signed-in user so a session that changes under an open editor starts a fresh form (and a fresh read of what that user kept) rather than carrying the first user's text over.
  return data ? <Form key={user?.id} review={data} user={user} arrivedFromRequest={arrivedFromRequest} origin={origin} /> : <HiddenTitle />;
}
