"use client";

import type { JSX } from "react";
import { Box } from "@mui/joy";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { AWAITING_LANE } from "./IntakeLanes";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.tabs;

export default function ReviewsTabs(): JSX.Element {
  const pathname = usePathname();
  const visible = useCanSeeReviews();
  // The same argument as the Review waiting lane, so both share one cache entry and one request.
  const { data: awaiting } = useGetIntakeItemsQuery(AWAITING_LANE, { skip: !visible });
  const waiting = awaiting?.length ?? 0;

  const tabs = [
    { path: "/dashboard/reviews", label: COPY.reviewing },
    { path: "/dashboard/reviews/music-directors", label: waiting > 0 ? COPY.count(COPY.directors, waiting) : COPY.directors },
  ];

  return (
    <Box sx={{ display: "flex", gap: 1, borderBottom: "1px solid", borderColor: "divider", mb: 2 }}>
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <Box
            key={tab.path}
            component={Link}
            href={tab.path}
            aria-current={active ? "page" : undefined}
            sx={{
              px: 1.5,
              py: 1,
              textDecoration: "none",
              color: active ? "primary.plainColor" : "text.secondary",
              fontWeight: active ? "lg" : "md",
              borderBottom: "2px solid",
              borderColor: active ? "primary.solidBg" : "transparent",
            }}
          >
            {tab.label}
          </Box>
        );
      })}
    </Box>
  );
}
