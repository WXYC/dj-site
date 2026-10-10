import type { JSX } from "react";
import { getUserFromSession, requireAuth } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import ReviewsTabs from "@/src/components/experiences/modern/reviews/ReviewsTabs";
import ScrollRegion from "@/src/components/experiences/modern/ScrollRegion";

// The strip is checked here, against the flag and the role, because a layout
// flushes to the stream before any page gate resolves: an ungated strip would
// disclose the second tab's name and URL to every requester ahead of the
// page's own refusal. The layout never refuses anyone itself. A DJ is
// admitted to the first tab, and a layout does NOT re-run on soft navigation
// between its child routes, so each page keeps its own gate.
export default async function ReviewsListsLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await requireAuth();
  const { authority } = await getUserFromSession(session);
  const showStrip = canSeeReviews(authority) && authority >= Authorization.MD;

  return (
    <>
      {showStrip && <ReviewsTabs />}
      <ScrollRegion>{children}</ScrollRegion>
    </>
  );
}
