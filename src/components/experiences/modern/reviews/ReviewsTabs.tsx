"use client";

import type { JSX } from "react";
import PageTabs, { type PageTab } from "@/src/components/experiences/modern/PageTabs";
import { LIVE_LIST } from "@/lib/features/reviews/api";
import { recordStage } from "@/lib/features/reviews/holder";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
import { sortMyReviews } from "@/lib/features/reviews/myReviews";
import { useGetMyReviewsQuery } from "@/lib/features/reviews/reviewApi";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";
import { ACTIVE_ITEMS, MY_REVIEWS } from "./useReviewWrite";

const COPY = REVIEW_COPY.tabs;

/** `showNewMusic` is decided on the server, so a DJ's strip never carries the New music tab's name or URL. */
export default function ReviewsTabs({ showNewMusic }: { showNewMusic: boolean }): JSX.Element {
  const visible = useCanSeeReviews();
  // One active read serves both counts: the Review waiting lane's rule over it, and the My reviews tab's Open reviews chip. It is read on every strip, so a DJ's count is re-read on focus and by the poll too.
  const { data: active } = useGetIntakeItemsQuery(ACTIVE_ITEMS, { skip: !visible, ...LIVE_LIST });
  const waiting = active ? active.filter((i) => recordStage(i) === "waiting").length : 0;
  // The same argument as the My reviews tab, so the badge and the tab's Open reviews chip count from one cache entry.
  const { data: auth } = useAuthentication();
  const me = "user" in auth ? auth.user?.id : undefined;
  const { data: reviews } = useGetMyReviewsQuery(MY_REVIEWS, { skip: !visible, ...LIVE_LIST });
  const open = active && reviews ? sortMyReviews(active, reviews, me).open.length : 0;

  const tabs: PageTab[] = [
    { path: "/dashboard/reviews", label: COPY.reviewShelf },
    { path: "/dashboard/reviews/mine", label: COPY.myReviews, count: open, countLabel: COPY.open(open) },
    ...(showNewMusic
      ? [{ path: "/dashboard/reviews/music-directors", label: COPY.directors, count: waiting, countLabel: COPY.waiting(waiting) }]
      : []),
  ];

  return <PageTabs tabs={tabs} />;
}
