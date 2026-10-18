import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Typography } from "@mui/joy";
import type { IntakeItem, Reviewer } from "@wxyc/shared";
import { useCancelIntakeRequestMutation, useRequestIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import { foldReviewers } from "@/lib/features/reviews/reviewerMatch";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { useMounted, type RowWriteOutcome } from "@/src/hooks/useRowWrite";
import IntakeRequestPicker from "./IntakeRequestPicker";
import { REVIEW_COPY } from "./copy";

type AskAction = "request" | "cancel";

/** The slice of a screen's row write the Ask a DJ… control uses, so a screen with a wider write (`useReviewWrite`) or its own `useRowWrite<AskAction>` can pass it in. */
export type AskWrite = {
  write: (id: number, action: AskAction, run: () => Promise<unknown>) => Promise<RowWriteOutcome>;
  lock: (id: number, action: "request") => { loading: boolean; disabled: boolean };
};

/**
 * The music director's Ask a DJ… control, once per screen: one fold per reviewers read, one set of Asked toasts, one mounted ref. Call it once in the screen and draw `picker(item)` on each record's row; a per-row component would refold the reviewers per row and dismiss a row's toast whenever that row unmounts after the write's reload. `alert` is the reviewers-load-failed line, for the screen to draw once.
 *
 * `namedByRow` (default true) names each record's button by the review shelf row's artist and album too, through the `shelfRecordId` and `shelfAlbumId` ids the screen puts on them; a page about one record passes false, so the button is named by its own words. `onSettled` runs with the write's outcome once the write's lists have reloaded, while the screen is still mounted, for a screen that moves focus off a button the reload took away.
 */
export function useAskADj({
  reviewers,
  write,
  lock,
  namedByRow = true,
  onSettled,
}: {
  reviewers: { isError: boolean; isLoading: boolean; data?: Reviewer[] };
  namedByRow?: boolean;
  onSettled?: (i: IntakeItem, outcome: RowWriteOutcome) => void;
} & AskWrite) {
  const [requestReview] = useRequestIntakeItemMutation();
  const [cancelRequest] = useCancelIntakeRequestMutation();
  // Folded once per reviewers read, not per row or per keystroke.
  const folded = useMemo(() => foldReviewers(reviewers.data ?? []), [reviewers.data]);
  const reviewersFailed = hasNothingToShow(reviewers);
  // A write outlives the screen when the music director navigates away mid-click; its Asked toast, whose Cancel request could then fail unheard, is skipped.
  const mounted = useMounted();
  // The Asked toasts this screen raised. The toaster sits in the root layout, so a toast outlives the screen; its Cancel request reports a failure or a lost race through this screen's write, which says nothing once the screen has gone. Each one is dismissed when the screen unmounts.
  const askedToasts = useRef(new Set<string | number>());
  useEffect(() => {
    const raised = askedToasts.current;
    return () => {
      for (const id of raised) {
        toast.dismiss(id);
      }
    };
  }, []);

  // Together these name each record's Ask a DJ… button for the record it acts on.
  const shelfRecordId = (i: IntakeItem) => `review-shelf-record-${i.id}`;
  const shelfAlbumId = (i: IntakeItem) => `review-shelf-album-${i.id}`;
  // The toast waits for the write to finish, so its Cancel request never meets the row's lock.
  const ask = async (i: IntakeItem, reviewer: Reviewer) => {
    const outcome = await write(i.id, "request", () => requestReview({ id: i.id, djId: reviewer.id }).unwrap());
    if (!mounted.current) {
      return;
    }
    if (outcome === "applied") {
      const id = toast(REVIEW_COPY.intake.askDone(reviewer.name), {
        action: { label: REVIEW_COPY.intake.cancelRequest, onClick: () => write(i.id, "cancel", () => cancelRequest(i.id).unwrap()) },
      });
      askedToasts.current.add(id);
    }
    onSettled?.(i, outcome);
  };

  const alert: ReactNode = reviewersFailed ? <Typography role="alert">{REVIEW_COPY.intake.reviewersLoadFailed}</Typography> : null;
  const picker = (i: IntakeItem) => (
    <IntakeRequestPicker
      reviewers={folded}
      loading={reviewers.isLoading}
      failed={reviewersFailed}
      passedIds={new Set((i.passes ?? []).flatMap((p) => p.dj_id ?? []))}
      labelledBy={namedByRow ? `${shelfRecordId(i)} ${shelfAlbumId(i)}` : undefined}
      artist={i.artist_name}
      album={i.album_title}
      busy={lock(i.id, "request")}
      onRequest={(reviewer) => ask(i, reviewer)}
    />
  );
  return { alert, picker, shelfRecordId, shelfAlbumId };
}
