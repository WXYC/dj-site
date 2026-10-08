"use client";

import { useState } from "react";
import { Button, Chip, Link, Stack, Typography } from "@mui/joy";
import type { IntakeItem, Review } from "@wxyc/shared";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import {
  isIntakeStateChanged,
  intakeApi,
  useAcceptIntakeItemMutation,
  useCheckoutIntakeItemMutation,
  useGetIntakeItemsQuery,
  usePassIntakeItemMutation,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import {
  isReviewSubjectNotHeld,
  reviewApi,
  useCreateReviewMutation,
  useGetMyReviewsQuery,
} from "@/lib/features/reviews/reviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useAppDispatch } from "@/lib/hooks";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import ConfirmDialog from "../ConfirmDialog";
import IntakeLane from "./IntakeLane";
import { REVIEW_COPY } from "./copy";
import { intakeRecord, recordLine } from "./recordLine";
import { useReviewRecord } from "./useReviewRecord";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

type Action = "checkout" | "accept" | "pass" | "release" | "write";

/** What a lost race (409 `state_changed`) means for each button, shown once the lists have reloaded. */
const RACE_NOTICE: Record<Action, string> = {
  checkout: REVIEW_COPY.screen.raceCheckout,
  accept: REVIEW_COPY.screen.raceRequest,
  pass: REVIEW_COPY.screen.raceRequest,
  release: REVIEW_COPY.screen.raceRelease,
  write: REVIEW_COPY.subjectNotHeld,
};

function DraftLabel({ review, formats }: { review: Review; formats: { id: number; format_name: string }[] | undefined }) {
  const record = useReviewRecord(review);
  if (!record) return review.intake_item_id == null ? REVIEW_COPY.myReviews.libraryRelease : null;
  return recordLine(record, formats);
}

// One argument per list, shared by its hook and the post-write reload so the
// reload reaches the same cache entry.
const OPEN_LISTS = undefined;
const REVIEWED_LIST = { state: "reviewed" } as const;
const MY_REVIEWS = undefined;

export default function ReviewsScreen() {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  const me = user?.id;
  const visible = useCanSeeReviews();

  const open = useGetIntakeItemsQuery(OPEN_LISTS, { skip: !visible });
  const reviewed = useGetIntakeItemsQuery(REVIEWED_LIST, { skip: !visible });
  const mine = useGetMyReviewsQuery(MY_REVIEWS, { skip: !visible });
  const { data: formats } = useGetFormatsQuery(undefined, { skip: !visible });

  const [checkout] = useCheckoutIntakeItemMutation();
  const [release] = useReleaseIntakeItemMutation();
  const [accept] = useAcceptIntakeItemMutation();
  const [pass] = usePassIntakeItemMutation();
  const [createReview] = useCreateReviewMutation();
  const router = useRouter();
  const [returning, setReturning] = useState<IntakeItem | null>(null);
  const dispatch = useAppDispatch();
  // A double-click's second POST would find the record already moved and
  // answer 409 state_changed, telling the DJ someone else took the record they
  // just took; one write per row at a time. Each reload joins the one the
  // write's invalidation already started.
  const { write, lock } = useRowWrite<Action>({
    reload: () => [
      dispatch(intakeApi.endpoints.getIntakeItems.initiate(OPEN_LISTS, { subscribe: false, forceRefetch: true })),
      dispatch(intakeApi.endpoints.getIntakeItems.initiate(REVIEWED_LIST, { subscribe: false, forceRefetch: true })),
      dispatch(reviewApi.endpoints.getMyReviews.initiate(MY_REVIEWS, { subscribe: false, forceRefetch: true })),
    ],
    isLostRace: (err) => isIntakeStateChanged(err) || isReviewSubjectNotHeld(err),
    onFailure: (_err, _id, action) =>
      toast.error(action === "write" ? REVIEW_COPY.couldNotStart : REVIEW_COPY.screen.writeFailed),
    onLostRace: (_id, action) => toast(RACE_NOTICE[action]),
  });

  if (!visible) return null;
  if (open.isError || reviewed.isError || mine.isError) {
    return <Typography role="alert">{REVIEW_COPY.screen.loadFailed}</Typography>;
  }

  // Until both lists land, an empty-state sentence would read as a fact.
  if (!open.data || !reviewed.data || !mine.data) return null;

  const items = open.data;
  const onShelf = items.filter((i) => i.effective_state === "pool");
  const requests = items.filter((i) => i.effective_state === "requested" && i.requested_dj_id === me);
  const checkouts = [
    ...items.filter((i) => i.effective_state === "checked_out" && i.checked_out_by === me),
    ...reviewed.data.filter((i) => i.effective_state === "reviewed" && i.checked_out_by === me),
  ];

  const describe = (i: IntakeItem) => recordLine(intakeRecord(i), formats);

  return (
    <Stack spacing={3}>
      <IntakeLane title={REVIEW_COPY.screen.shelfTitle} rows={onShelf} empty={REVIEW_COPY.screen.shelfEmpty} label={(i) => <Typography>{describe(i)}</Typography>} extra={(i) => (
        <>
          <Typography level="body-sm">{`${REVIEW_COPY.screen.logged} ${day(i.logged_at)}`}</Typography>
          <Button size="sm" {...lock(i.id, "checkout")} onClick={() => write(i.id, "checkout", () => checkout(i.id).unwrap())}>{REVIEW_COPY.screen.checkOut}</Button>
        </>
      )} />
      <IntakeLane title={REVIEW_COPY.screen.checkoutsTitle} rows={checkouts} empty={REVIEW_COPY.screen.checkoutsEmpty} label={(i) => <Typography>{describe(i)}</Typography>} extra={(i) => {
        const mineHere = mine.data.filter((r) => r.intake_item_id === i.id);
        const submitted = mineHere.find((r) => r.status === "submitted");
        const draft = mineHere.find((r) => r.status === "draft");
        return (
        <>
          <Typography level="body-sm">{`${REVIEW_COPY.screen.taken} ${day(i.checked_out_at)}`}</Typography>
          {i.overdue && <Chip color="danger">{REVIEW_COPY.screen.overdue}</Chip>}
          {i.effective_state === "reviewed" && (
            <Typography level="body-sm">{REVIEW_COPY.screen.reviewedReturn}</Typography>
          )}
          {submitted ? (
            <>
              <Typography level="body-sm">{REVIEW_COPY.screen.reviewSubmitted}</Typography>
              <Button size="sm" onClick={() => router.push(`/dashboard/reviews/${submitted.id}`)}>{REVIEW_COPY.screen.editReview}</Button>
            </>
          ) : (
            <Button
              size="sm"
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
          <Button size="sm" variant="outlined" {...lock(i.id, "release")} onClick={() => setReturning(i)}>{REVIEW_COPY.screen.returnToShelf}</Button>
        </>
        );
      }} />
      <IntakeLane title={REVIEW_COPY.screen.requestsTitle} rows={requests} empty={REVIEW_COPY.screen.requestsEmpty} label={(i) => <Typography>{describe(i)}</Typography>} extra={(i) => (
        <>
          <Typography level="body-sm">{`${REVIEW_COPY.screen.asked} ${day(i.requested_at)}`}</Typography>
          <Button size="sm" {...lock(i.id, "accept")} onClick={() => write(i.id, "accept", () => accept(i.id).unwrap())}>{REVIEW_COPY.screen.accept}</Button>
          <Button size="sm" variant="outlined" {...lock(i.id, "pass")} onClick={() => write(i.id, "pass", () => pass(i.id).unwrap())}>{REVIEW_COPY.screen.pass}</Button>
        </>
      )} />
      <IntakeLane title={REVIEW_COPY.myReviews.title} rows={mine.data} empty={REVIEW_COPY.myReviews.empty} label={(r) => <Typography><DraftLabel review={r} formats={formats} /></Typography>} extra={(r) => (
        <>
          <Typography level="body-sm">{r.status === "draft" ? REVIEW_COPY.myReviews.draft : REVIEW_COPY.myReviews.submitted}</Typography>
          <Link href={`/dashboard/reviews/${r.id}`}>{REVIEW_COPY.myReviews.open}</Link>
        </>
      )} />
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
        {REVIEW_COPY.screen.returnQuestion}
      </ConfirmDialog>
    </Stack>
  );
}
