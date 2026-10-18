"use client";

import { Typography } from "@mui/joy";
import { Authorization } from "@/lib/features/admin/types";
import { LIVE_LIST } from "@/lib/features/reviews/api";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
import { useGetMyReviewsQuery, useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import MyReviewsScreen from "./MyReviewsScreen";
import ReviewShelfScreen from "./ReviewShelfScreen";
import { REVIEW_COPY } from "./copy";
import { EVERY_STATE, MY_REVIEWS, useReviewWrite } from "./useReviewWrite";

/** The reads and write wiring behind one of the Reviews page's list tabs. Both tabs read the same intake list. A write reloads the intake list and the DJ's own reviews, because the tab strip's count is drawn from both. */
export default function ReviewsScreen({ tab }: { tab: "shelf" | "mine" }) {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  const visible = useCanSeeReviews();
  const isMD = (user?.authority ?? Authorization.DJ) >= Authorization.MD;
  const onShelf = tab === "shelf";

  const everyState = useGetIntakeItemsQuery(EVERY_STATE, { skip: !visible, ...LIVE_LIST });
  const mine = useGetMyReviewsQuery(MY_REVIEWS, { skip: !visible || onShelf, ...LIVE_LIST });
  const reviewers = useGetReviewersQuery(undefined, { skip: !visible || !isMD || !onShelf });
  const { write, lock } = useReviewWrite(everyState.data);

  if (!visible) {
    return null;
  }
  if ([everyState, ...(onShelf ? [] : [mine])].some(hasNothingToShow)) {
    return <Typography role="alert">{REVIEW_COPY.screen.loadFailed}</Typography>;
  }

  // Until the reads land, an empty-state sentence would read as a fact.
  if (!everyState.data) {
    return null;
  }
  if (onShelf) {
    return <ReviewShelfScreen items={everyState.data} isMD={isMD} reviewers={reviewers} write={write} lock={lock} />;
  }
  if (!mine.data) {
    return null;
  }

  return <MyReviewsScreen items={everyState.data} myReviews={mine.data} me={user?.id} write={write} lock={lock} />;
}
