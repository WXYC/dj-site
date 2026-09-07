"use client";

import { isStationSignupEnabled } from "@/lib/features/authentication/flags";
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
  //
  // The flag gates the URL, not only the entry link on the login form: with it
  // off, `?signup=1` must be inert rather than serving the whole form to
  // whoever types it — otherwise a deploy that deliberately left signup off,
  // pointed at a backend whose own STATION_SIGNUP_ENABLED is on, provisions
  // real accounts. Read at render time; NEXT_PUBLIC_* values are inlined at
  // build time, so this can't be hoisted to module scope.
  const hasSignupParam =
    isStationSignupEnabled() && searchParams?.get("signup") === "1";

  if (hasResetParams) return <>{reset}</>;
  if (hasSignupParam) return <>{signup}</>;
  return <>{normal}</>;
}
