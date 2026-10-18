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
import { ACTIVE_ITEMS, MY_REVIEWS, useReviewWrite } from "./useReviewWrite";

/** The reads and write wiring behind one of the Reviews page's list tabs. Both tabs read the same intake list. A write reloads the intake list, and the My reviews list only on the tab that draws it. */
export default function ReviewsScreen({ tab }: { tab: "shelf" | "mine" }) {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  const visible = useCanSeeReviews();
  const isMD = (user?.authority ?? Authorization.DJ) >= Authorization.MD;
  const onShelf = tab === "shelf";

  const active = useGetIntakeItemsQuery(ACTIVE_ITEMS, { skip: !visible, ...LIVE_LIST });
  const mine = useGetMyReviewsQuery(MY_REVIEWS, { skip: !visible || onShelf, ...LIVE_LIST });
  const reviewers = useGetReviewersQuery(undefined, { skip: !visible || !isMD || !onShelf });
  const { write, lock } = useReviewWrite({ reloadMine: !onShelf });

  if (!visible) {
    return null;
  }
  if ([active, ...(onShelf ? [] : [mine])].some(hasNothingToShow)) {
    return <Typography role="alert">{REVIEW_COPY.screen.loadFailed}</Typography>;
  }

  // Until the reads land, an empty-state sentence would read as a fact.
  if (!active.data) {
    return null;
  }
  if (onShelf) {
    return <ReviewShelfScreen items={active.data} isMD={isMD} reviewers={reviewers} write={write} lock={lock} />;
  }
  if (!mine.data) {
    return null;
  }

  return <MyReviewsScreen items={active.data} myReviews={mine.data} me={user?.id} write={write} lock={lock} />;
}
