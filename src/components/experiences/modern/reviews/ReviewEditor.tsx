"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Link as JoyLink, Stack, Typography } from "@mui/joy";
import type { Review, ReviewPatch } from "@wxyc/shared";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Authorization } from "@/lib/features/admin/types";
import {
  isReviewInUse,
  isReviewNotDraft,
  useDeleteReviewMutation,
  useGetReviewQuery,
  useSubmitReviewMutation,
  useUpdateReviewMutation,
} from "@/lib/features/reviews/reviewApi";
import { serverMessage, unwrapEndpointErrorOrRaw } from "@/lib/rtk-endpoint-error";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import ConfirmDialog from "../ConfirmDialog";
import ConsentBlock, { type Consent } from "./ConsentBlock";
import { REVIEW_COPY } from "./copy";
import FccNotesPanel from "./FccNotesPanel";
import PrintedVersionNote from "./PrintedVersionNote";
import SlipFields, { toFieldPatch, toFieldValues } from "./SlipFields";
import SlipPreview from "./SlipPreview";
import { formatSlipDate } from "./slipDate";
import { useReviewRecord } from "./useReviewRecord";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";

type Confirming = "submit" | "delete" | null;

function Form({ review }: { review: Review }) {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  const isAuthor = user?.id != null && user.id === review.author_user_id;
  const isMusicDirector = !isAuthor && (user?.authority ?? Authorization.NO) >= Authorization.MD;
  const [values, setValues] = useState(() => toFieldValues(review));
  const [consent, setConsent] = useState<Consent>(() => ({
    publish_website: review.publish_website,
    publish_apps: review.publish_apps,
    publish_instagram: review.publish_instagram,
    credit: review.credit,
  }));
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [refusedInUse, setRefusedInUse] = useState(false);
  const [update, { isLoading }] = useUpdateReviewMutation();
  const [submit, { isLoading: submitting }] = useSubmitReviewMutation();
  const [remove, { isLoading: deleting }] = useDeleteReviewMutation();
  const router = useRouter();
  const record = useReviewRecord(review);
  const draft = review.status === "draft";
  // Only a typed review needs text to submit; a handwritten one may go in with none.
  const blank = review.medium === "typed" && values.review.trim() === "";
  const inUse = review.in_use || refusedInUse;

  // A non-author's patch carries no consent: the service accepts it only from the author.
  const patch = (): ReviewPatch => ({
    ...toFieldPatch(values),
    ...(isAuthor ? consent : {}),
  });
  const failure = (err: unknown, fallback: string) =>
    toast.error(serverMessage(unwrapEndpointErrorOrRaw("reviewWriteError", err)?.data) ?? fallback);

  const save = async () => {
    try {
      await update({ id: review.id, patch: patch() }).unwrap();
      toast.success(draft ? REVIEW_COPY.saved : REVIEW_COPY.savedChange);
    } catch (err) {
      failure(err, REVIEW_COPY.couldNotSave);
    }
  };

  const submitReview = async () => {
    setConfirming(null);
    try {
      await update({ id: review.id, patch: patch() }).unwrap();
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
      router.replace("/dashboard/reviews");
    } catch (err) {
      if (isReviewInUse(err)) setRefusedInUse(true);
      else toast.error(REVIEW_COPY.couldNotDelete);
    }
  };

  return (
    <Stack direction="row" spacing={3} alignItems="flex-start" flexWrap="wrap">
      <Stack spacing={2} sx={{ flex: 1, minWidth: 280 }}>
        {!draft && (
          <JoyLink component={Link} href={`/dashboard/reviews/${review.id}/history`} level="body-sm">
            {REVIEW_COPY.history.link}
          </JoyLink>
        )}
        <PrintedVersionNote review={review} />
        {draft && <Typography level="body-sm">{REVIEW_COPY.draftPrivacy}</Typography>}
        {isAuthor && !draft && <Typography level="body-sm">{REVIEW_COPY.submittedBanner}</Typography>}
        {isMusicDirector && (
          <Typography level="body-sm">
            {REVIEW_COPY.editingOthers(review.author ?? "", !draft && review.author_user_id != null)}
          </Typography>
        )}
        <SlipFields values={values} onChange={setValues} />
        {isAuthor ? (
          <ConsentBlock value={consent} onChange={setConsent} djName={user?.djName} realName={user?.realName} />
        ) : (
          <Typography level="body-sm">{REVIEW_COPY.authorOnlyConsent}</Typography>
        )}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button variant={draft ? "outlined" : "solid"} loading={isLoading} onClick={save}>
            {draft ? REVIEW_COPY.saveDraft : REVIEW_COPY.save}
          </Button>
          {draft && (
            <Button loading={submitting} disabled={blank} onClick={() => setConfirming("submit")}>{REVIEW_COPY.submit}</Button>
          )}
          {isAuthor && (
            <Button color="danger" variant="outlined" loading={deleting} disabled={inUse} onClick={() => setConfirming("delete")}>
              {REVIEW_COPY.delete}
            </Button>
          )}
        </Stack>
        {draft && blank && <Typography level="body-sm">{REVIEW_COPY.submitNeedsReview}</Typography>}
        {isAuthor && inUse && <Typography level="body-sm" role="status">{REVIEW_COPY.inUse}</Typography>}
      </Stack>
      {review.intake_item_id != null && <FccNotesPanel intakeItemId={review.intake_item_id} />}
      <SlipPreview
        artist={record?.artist ?? ""}
        album={record?.album ?? ""}
        label={record?.label ?? ""}
        reviewer={review.author ?? ""}
        date={formatSlipDate(review.submitted_at ?? review.add_date)}
        fields={values}
      />
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === "delete" ? REVIEW_COPY.delete : REVIEW_COPY.submit}
        actions={
          <>
            <Button onClick={confirming === "delete" ? deleteReview : submitReview}>
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
    </Stack>
  );
}

export default function ReviewEditor({ id }: { id: number }) {
  const visible = useCanSeeReviews();
  const { data, isError } = useGetReviewQuery(id, { skip: !visible });

  if (!visible) return null;
  if (hasNothingToShow({ isError, data })) return <Typography role="alert">{REVIEW_COPY.couldNotLoad}</Typography>;
  return data ? <Form review={data} /> : null;
}
