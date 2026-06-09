"use client";

import { ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export default function ClassicLoginSlotSwitcher({
  normal,
  reset,
}: {
  normal: ReactNode;
  reset: ReactNode;
}) {
  const searchParams = useSearchParams();
  const hasResetParams =
    !!searchParams?.get("token") || !!searchParams?.get("error");

  return <>{hasResetParams ? reset : normal}</>;
}
