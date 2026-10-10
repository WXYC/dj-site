"use client";

import Link from "next/link";
import { Link as JoyLink, Stack, Typography } from "@mui/joy";
import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";

export const REVIEW_GATE_COPY = {
  /** Approved. Shown in place of a create action once the cutover date has arrived. */
  refusal: "New releases go onto the review shelf first, and are filed from there once a review is chosen.",
  /** Approved. The music directors' link to the review shelf, beside the refusal. */
  link: "Open the review shelf",
} as const;

const REVIEW_SHELF_HREF = "/dashboard/reviews";

/**
 * Stands where a screen's create action stood once
 * `reviewGateCutoverReached()` is true, and where the filing bench answers a
 * `review_required` refusal. The link is shown to music directors only, though the
 * page it opens, `/dashboard/reviews`, is the Reviews page every DJ sees. The modern screens pass `modern` to render with Joy UI; the
 * classic screens keep plain markup.
 */
export default function ReviewGateRefusal({ modern = false }: { modern?: boolean } = {}) {
  const { data: auth } = useAuthentication();
  const authority = "user" in auth ? auth.user?.authority : undefined;
  const isMD = (authority ?? Authorization.NO) >= Authorization.MD;

  if (modern) {
    return (
      <Stack spacing={0.5}>
        <Typography level="body-md">{REVIEW_GATE_COPY.refusal}</Typography>
        {isMD && (
          <JoyLink component={Link} href={REVIEW_SHELF_HREF} level="body-md">
            {REVIEW_GATE_COPY.link}
          </JoyLink>
        )}
      </Stack>
    );
  }

  return (
    <div>
      <p>{REVIEW_GATE_COPY.refusal}</p>
      {isMD && <Link href={REVIEW_SHELF_HREF}>{REVIEW_GATE_COPY.link}</Link>}
    </div>
  );
}
