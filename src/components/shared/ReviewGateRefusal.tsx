"use client";

import Link from "next/link";
import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";

export const REVIEW_GATE_COPY = {
  /** Approved. Shown in place of a create action once the cutover date has arrived. */
  refusal: "New releases go onto the review shelf first, and are filed from there once a review is chosen.",
  /** Approved. The music directors' link to the review shelf, beside the refusal. */
  link: "Open the review shelf",
} as const;

/**
 * Stands where a screen's create action stood once
 * `reviewGateCutoverReached()` is true. The link is for music directors only;
 * the page it opens is theirs.
 */
export default function ReviewGateRefusal() {
  const { data: auth } = useAuthentication();
  const authority = "user" in auth ? auth.user?.authority : undefined;
  const isMD = (authority ?? Authorization.NO) >= Authorization.MD;

  return (
    <div>
      <p>{REVIEW_GATE_COPY.refusal}</p>
      {isMD && <Link href="/dashboard/admin/intake">{REVIEW_GATE_COPY.link}</Link>}
    </div>
  );
}
