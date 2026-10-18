import { toast } from "sonner";
import {
  isIntakeRequestRefused,
  isIntakeStateChanged,
  intakeApi,
} from "@/lib/features/reviews/intakeApi";
import { isReviewSubjectNotHeld, reviewApi } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { useRowWrite } from "@/src/hooks/useRowWrite";
import { REVIEW_COPY } from "./copy";
import { formatStationShortDate } from "@/src/utilities/stationTime";

export const day = (iso: string | null) => (iso ? formatStationShortDate(iso) : "");

type Action = "checkout" | "accept" | "pass" | "release" | "write" | "request";

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
  }
};

// One argument per list, shared by its hook and the post-write reload so the
// reload reaches the same cache entry. The unfiltered read carries every state.
export const EVERY_STATE = undefined;
export const MY_REVIEWS = undefined;

/** The write wiring both review screens share: every write reloads both lists, whichever screen it came from. Call it once, in the screen that owns both lists, and pass `write` and `lock` down: a row stays locked until every list it renders has reloaded, which holds across lanes only if one pending map covers them all. */
export function useReviewWrite() {
  const dispatch = useAppDispatch();
  // A double-click's second POST would find the record already moved and
  // answer 409 state_changed, telling the DJ someone else took the record they
  // just took; one write per row at a time. Each reload joins the one the
  // write's invalidation already started.
  return useRowWrite<Action>({
    reload: () => [
      dispatch(intakeApi.endpoints.getIntakeItems.initiate(EVERY_STATE, { subscribe: false, forceRefetch: true })),
      dispatch(reviewApi.endpoints.getMyReviews.initiate(MY_REVIEWS, { subscribe: false, forceRefetch: true })),
    ],
    isLostRace: (err) => isIntakeStateChanged(err) || isReviewSubjectNotHeld(err),
    onFailure: (err, _id, action) => {
      if (action === "request" && isIntakeRequestRefused(err)) {
        toast.error(REVIEW_COPY.intake.requestRefused);
        void dispatch(reviewApi.endpoints.getReviewers.initiate(undefined, { subscribe: false, forceRefetch: true }));
        return;
      }
      toast.error(action === "write" ? REVIEW_COPY.couldNotStart : REVIEW_COPY.screen.writeFailed);
    },
    onLostRace: (_id, action) => toast(raceNotice(action)),
  });
}

/** What `useReviewWrite` returns, for a screen that takes the shared write wiring as a prop. */
export type ReviewWrite = ReturnType<typeof useReviewWrite>;
