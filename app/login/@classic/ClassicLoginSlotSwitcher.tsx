"use client";

import { ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export default function ClassicLoginSlotSwitcher({
  normal,
  reset,
  signup,
}: {
  normal: ReactNode;
  reset: ReactNode;
  signup: ReactNode;
}) {
  const searchParams = useSearchParams();
  const hasResetParams =
    !!searchParams?.get("token") || !!searchParams?.get("error");
  // A reset link must win over a stray ?signup=1 — they can't legitimately
  // coexist, but a live password-reset link must never be masked.
  const hasSignupParam = searchParams?.get("signup") === "1";

  if (hasResetParams) return <>{reset}</>;
  if (hasSignupParam) return <>{signup}</>;
  return <>{normal}</>;
}
