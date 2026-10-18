import { toast } from "sonner";
import {
  isIntakeStateChanged,
  intakeApi,
} from "@/lib/features/reviews/intakeApi";
import { isReviewSubjectNotHeld, reviewApi } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import { REVIEW_COPY } from "./copy";
import { answerRefusedRequest } from "./useAskADj";
import { formatStationShortDate } from "@/src/utilities/stationTime";

export const day = (iso: string | null) => (iso ? formatStationShortDate(iso) : "");

type Action = "checkout" | "accept" | "pass" | "release" | "write" | "request" | "cancel";

/** What a lost race (409 `state_changed`) means for each button, shown once the lists have reloaded. */
const raceNotice = (action: Action): string => {
  switch (action) {
    case "checkout":
      return REVIEW_COPY.screen.raceCheckout;
    case "accept":
    case "pass":
      return REVIEW_COPY.screen.raceRequest;
    case "release":
      return REVIEW_COPY.screen.raceRelease;
    case "write":
      return REVIEW_COPY.subjectNotHeld;
    case "request":
      return REVIEW_COPY.intake.raceRequest;
    case "cancel":
      return REVIEW_COPY.intake.raceCancel;
  }
};

// One argument per list, shared by its hook and the post-write reload so the
// reload reaches the same cache entry. The unfiltered read carries every state;
// the New music tab's lanes and its count in the tabs are `recordStage` over it.
export const EVERY_STATE = undefined;
export const MY_REVIEWS = undefined;

/**
 * The write wiring behind one Reviews tab. Call it once per tab, in the screen that owns the tab's lists, and pass `write` and `lock` down: a row stays locked until every list the tab renders has reloaded, which holds across that tab's lanes because one pending map covers them all. The tabs are separate routes, so each has its own pending map and a lock does not carry from one tab to the other.
 *
 * Every write reloads the intake list. `reloadMine` (default true) also reloads the DJ's own reviews; a tab that does not draw that list passes false, so a write there neither reads it nor waits on it. The tab strip's My reviews count reads that list too, and stays right without it: the review shelf tab's writes (checkout, request, cancel request) never change the DJ's own reviews, and a write that does invalidates the `Review` tag, which refetches the count's read.
 * A page about one record passes its id as `only`: a write there rereads that record instead of the intake list, which the page does not draw.
 */
export function useReviewWrite({ reloadMine = true, only }: { reloadMine?: boolean; only?: number } = {}) {
  const dispatch = useAppDispatch();
  // A double-click's second POST would find the record already moved and
  // answer 409 state_changed, telling the DJ someone else took the record they
  // just took; one write per row at a time. Each reload joins the one the
  // write's invalidation already started.
  return useRowWrite<Action>({
    reload: () => [
      only === undefined
        ? dispatch(intakeApi.endpoints.getIntakeItems.initiate(EVERY_STATE, { subscribe: false, forceRefetch: true }))
        : dispatch(intakeApi.endpoints.getIntakeItem.initiate(only, { subscribe: false, forceRefetch: true })),
      ...(reloadMine ? [dispatch(reviewApi.endpoints.getMyReviews.initiate(MY_REVIEWS, { subscribe: false, forceRefetch: true }))] : []),
    ],
    isLostRace: (err) => isIntakeStateChanged(err) || isReviewSubjectNotHeld(err),
    onFailure: (err, _id, action) => {
      if (answerRefusedRequest(err, action, dispatch)) {
        return;
      }
      toast.error(action === "write" ? REVIEW_COPY.couldNotStart : REVIEW_COPY.screen.writeFailed);
    },
    onLostRace: (_id, action) => toast(raceNotice(action)),
  });
}

/** What `useReviewWrite` returns, for a screen that takes the shared write wiring as a prop. */
export type ReviewWrite = ReturnType<typeof useReviewWrite>;
