"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { ReactNode, useEffect } from "react";

export default function LoginSlotSwitcher({
  normal,
  newuser,
  reset,
  isIncomplete,
}: {
  normal: ReactNode;
  newuser: ReactNode;
  reset: ReactNode;
  isIncomplete: boolean;
}) {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authStage = useAppSelector(applicationSlice.selectors.getAuthStage);

  useEffect(() => {
    const hasResetParams =
      !!searchParams?.get("token") || !!searchParams?.get("error");

    if (hasResetParams) {
      dispatch(applicationSlice.actions.setAuthStage("reset"));
    }
  }, [dispatch, searchParams]);

  if (isIncomplete) return <>{newuser}</>;

  if (authStage === "forgot" || authStage === "reset") {
    return <>{reset}</>;
  }

  return <>{normal}</>;
}
