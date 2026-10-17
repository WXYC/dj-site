"use client";

import type { JSX } from "react";
import PageTabs from "@/src/components/experiences/modern/PageTabs";
import { LIVE_LIST } from "@/lib/features/reviews/api";
import { awaitingRecords } from "@/lib/features/reviews/holder";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { AWAITING_LANE } from "./IntakeLanes";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.tabs;

export default function ReviewsTabs(): JSX.Element {
  const visible = useCanSeeReviews();
  // The same argument as the Review waiting lane, so both share one cache entry and one request.
  const { data: awaiting } = useGetIntakeItemsQuery(AWAITING_LANE, { skip: !visible, ...LIVE_LIST });
  const waiting = awaiting ? awaitingRecords(awaiting).length : 0;

  const tabs = [
    { path: "/dashboard/reviews", label: COPY.reviewing },
    { path: "/dashboard/reviews/music-directors", label: COPY.directors, count: waiting, countLabel: COPY.waiting(waiting) },
  ];

  return <PageTabs tabs={tabs} />;
}
