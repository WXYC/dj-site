"use client";

import type { JSX } from "react";
import PageTabs, { type PageTab } from "@/src/components/experiences/modern/PageTabs";
import { LIVE_LIST } from "@/lib/features/reviews/api";
import { recordStage } from "@/lib/features/reviews/holder";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { EVERY_STATE } from "./useReviewWrite";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.tabs;

/** `showNewMusic` is decided on the server, so a DJ's strip never carries the New music tab's name or URL. */
export default function ReviewsTabs({ showNewMusic }: { showNewMusic: boolean }): JSX.Element {
  const visible = useCanSeeReviews();
  // The read and the rule the Review waiting lane draws from, so the count is that lane's length and shares its one request.
  const { data: everyState } = useGetIntakeItemsQuery(EVERY_STATE, { skip: !visible || !showNewMusic, ...LIVE_LIST });
  const waiting = everyState ? everyState.filter((i) => recordStage(i) === "waiting").length : 0;

  const tabs: PageTab[] = [
    { path: "/dashboard/reviews", label: COPY.reviewShelf },
    { path: "/dashboard/reviews/mine", label: COPY.myReviews },
    ...(showNewMusic
      ? [{ path: "/dashboard/reviews/music-directors", label: COPY.directors, count: waiting, countLabel: COPY.waiting(waiting) }]
      : []),
  ];

  return <PageTabs tabs={tabs} />;
}
