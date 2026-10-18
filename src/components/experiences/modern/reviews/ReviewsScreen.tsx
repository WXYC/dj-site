"use client";

import { Stack, Typography } from "@mui/joy";
import { Authorization } from "@/lib/features/admin/types";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
import { useGetMyReviewsQuery, useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import IntakeLogForm from "./IntakeLogForm";
import MyReviewsScreen from "./MyReviewsScreen";
import ReviewShelfScreen from "./ReviewShelfScreen";
import { REVIEW_COPY } from "./copy";
import { EVERY_STATE, MY_REVIEWS, useReviewWrite } from "./useReviewWrite";

export default function ReviewsScreen() {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  const visible = useCanSeeReviews();
  const isMD = (user?.authority ?? Authorization.DJ) >= Authorization.MD;

  const everyState = useGetIntakeItemsQuery(EVERY_STATE, { skip: !visible });
  const mine = useGetMyReviewsQuery(MY_REVIEWS, { skip: !visible });
  const { data: formats } = useGetFormatsQuery(undefined, { skip: !visible });
  const reviewers = useGetReviewersQuery(undefined, { skip: !visible || !isMD });
  // One pending map for every lane, so a row that changes lanes mid-write stays locked until both lists have reloaded.
  const { write, lock } = useReviewWrite();

  if (!visible) {
    return null;
  }
  if ([everyState, mine].some(hasNothingToShow)) {
    return <Typography role="alert">{REVIEW_COPY.screen.loadFailed}</Typography>;
  }

  // Until both reads land, an empty-state sentence would read as a fact.
  if (!everyState.data || !mine.data) {
    return null;
  }

  return (
    <Stack spacing={3}>
      <MyReviewsScreen
        items={everyState.data}
        myReviews={mine.data}
        formats={formats}
        me={user?.id}
        write={write}
        lock={lock}
        between={
          <>
            {isMD && <IntakeLogForm />}
            <ReviewShelfScreen items={everyState.data} formats={formats} isMD={isMD} reviewers={reviewers} write={write} lock={lock} />
          </>
        }
      />
    </Stack>
  );
}
