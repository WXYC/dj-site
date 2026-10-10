"use client";

import type { JSX } from "react";
import PageTabs from "@/src/components/experiences/modern/PageTabs";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { AWAITING_LANE } from "./IntakeLanes";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.tabs;

export default function ReviewsTabs(): JSX.Element {
  const visible = useCanSeeReviews();
  // The same argument as the Review waiting lane, so both share one cache entry and one request.
  const { data: awaiting } = useGetIntakeItemsQuery(AWAITING_LANE, { skip: !visible });
  const waiting = awaiting?.length ?? 0;

  const tabs = [
    { path: "/dashboard/reviews", label: COPY.reviewing },
    { path: "/dashboard/reviews/music-directors", label: waiting > 0 ? COPY.count(COPY.directors, waiting) : COPY.directors },
  ];

  return <PageTabs tabs={tabs} />;
}
