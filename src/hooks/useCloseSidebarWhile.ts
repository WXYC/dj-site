"use client";

import { useEffect } from "react";
import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { closeSidebarCSS } from "@/src/utilities/modern/catalog/utilities";

/** Below Joy's md breakpoint the left bar is a drawer stacked above every modal (z-index 10000 against Joy's 1300), and a link tap does not close it, so a question opened by a link would open out of sight: the drawer closes as the question opens. */
export function useCloseSidebarWhile(asking: boolean) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!asking) return;
    dispatch(applicationSlice.actions.closeSidebar());
    closeSidebarCSS();
  }, [asking, dispatch]);
}
