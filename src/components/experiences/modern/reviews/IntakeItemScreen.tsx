"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip, Stack, Typography } from "@mui/joy";
import type { IntakeItem, Review } from "@wxyc/shared";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import {
  intakeApi,
  isIntakeNotReviewed,
  isIntakeStateChanged,
  useFileIntakeItemMutation,
  useGetIntakeItemQuery,
} from "@/lib/features/reviews/intakeApi";
import { reviewApi, useGetItemReviewsQuery, useGetReviewQuery } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useMounted } from "@/src/hooks/useRowWrite";
import RotationFilingBench, { type FilingSubmit } from "../admin/rotation/RotationFilingBench";
import { REVIEW_COPY } from "./copy";
import FccNotesPanel from "./FccNotesPanel";
import { intakeRecord, recordLine } from "./recordLine";
import { Group } from "./ReviewsPanel";

const COPY = REVIEW_COPY.intakeItem;

const STATE_LABELS: Record<IntakeItem["effective_state"], string> = {
  pool: REVIEW_COPY.intake.onShelf,
  requested: REVIEW_COPY.intake.requested,
  checked_out: REVIEW_COPY.intake.checkedOut,
  reviewed: REVIEW_COPY.intake.reviewed,
  filed: REVIEW_COPY.intake.filed,
  finalized: REVIEW_COPY.intake.filed,
};

/**
 * Every write on this page reloads through this before its line appears: the
 * item, its reviews, and the cover review when the page reads it by id
 * (`coverId`). It follows the `useRowWrite` reload rule: `initiate` with the
 * hooks' own args, never a hook's `refetch()`, which throws once the page has
 * unmounted. Resolves to whether the page is still mounted, so the caller sets
 * no state after it has gone. A failed read does not reject.
 */
function useItemPageReload(id: number, coverId?: number) {
  const dispatch = useAppDispatch();
  const mounted = useMounted();
  const refresh = { subscribe: false, forceRefetch: true } as const;
  return async () => {
    await Promise.allSettled([
      dispatch(intakeApi.endpoints.getIntakeItem.initiate(id, refresh)),
      dispatch(reviewApi.endpoints.getItemReviews.initiate(id, refresh)),
      ...(coverId === undefined ? [] : [dispatch(reviewApi.endpoints.getReview.initiate(coverId, refresh))]),
    ]);
    return mounted.current;
  };
}

/** The music directors' page for one logged record: its reviews, and the filing bench. */
export default function IntakeItemScreen({ id }: { id: number }) {
  const visible = useCanSeeReviews();
  const item = useGetIntakeItemQuery(id, { skip: !visible });
  const reviews = useGetItemReviewsQuery(id, { skip: !visible });
  const [fileItem] = useFileIntakeItemMutation();
  const [notice, setNotice] = useState<string | null>(null);

  const coverId = item.data?.accepted_review_id ?? null;
  const ownCover = reviews.data?.find((r) => r.id === coverId);
  // The review on the cover can be one of a cited or filed release, which the item's own list lacks.
  // Decided once: the query below reads it and the reload refreshes it, so the two cannot drift.
  const coverById = coverId != null && reviews.data && !ownCover ? coverId : undefined;
  const fetchedCover = useGetReviewQuery(coverById ?? 0, { skip: !visible || coverById === undefined });

  const reload = useItemPageReload(id, coverById);

  if (!visible) return null;
  if ([item, reviews, fetchedCover].some(hasNothingToShow)) {
    return <Typography role="alert">{COPY.loadFailed}</Typography>;
  }
  if (!item.data || !reviews.data) return null;

  const record = intakeRecord(item.data);
  const recordOf = (review: Review) => (review.intake_item_id === id ? record : undefined);
  const cover = ownCover ?? (fetchedCover.data?.id === coverId ? fetchedCover.data : undefined);
  const others = reviews.data
    .filter((r) => r.id !== coverId)
    .sort((a, b) => b.add_date.localeCompare(a.add_date) || b.id - a.id);

  // The intake refusals are worded here; the server's text is never shown.
  const submitNew: FilingSubmit = async (request) => {
    setNotice(null);
    try {
      await fileItem({ id, body: { kind: "new_release", ...request } }).unwrap();
    } catch (err) {
      const refusal = isIntakeStateChanged(err) ? COPY.alreadyFiled : isIntakeNotReviewed(err) ? COPY.notReviewed : null;
      if (refusal === null) throw unwrapEndpointError("intakeWriteError", err) ?? err;
      if (await reload()) setNotice(refusal);
      // Nothing was filed, so the bench keeps what was typed.
      return false;
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography level="title-lg">{recordLine(record)}</Typography>
        <Chip>{STATE_LABELS[item.data.effective_state]}</Chip>
      </Stack>
      {cover ? (
        <Group title={REVIEW_COPY.albumPanel.coverOne} reviews={[cover]} recordOf={recordOf} />
      ) : (
        coverId == null && <Typography>{COPY.noCover}</Typography>
      )}
      {others.length > 0 && <Group title={REVIEW_COPY.albumPanel.others} reviews={others} recordOf={recordOf} />}
      {!!item.data.draft_authors?.length && (
        <Typography level="body-sm">{COPY.stillWriting} {item.data.draft_authors.join(", ")}.</Typography>
      )}
      <FccNotesPanel intakeItemId={id} />
      {notice && <Typography role="status">{notice}</Typography>}
      {coverId != null && <Link href={`/dashboard/admin/intake/${id}/slip`}>{COPY.printSlip}</Link>}
      {item.data.effective_state === "filed" || item.data.effective_state === "finalized" ? (
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
        </>
      )}
    </Stack>
  );
}
