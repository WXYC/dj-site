import { adminSlice } from "@/lib/features/admin/frontend";
import { applicationSlice } from "@/lib/features/application/frontend";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { resetOrganizationIdCache } from "@/lib/features/authentication/organization-utils";
import { binApi } from "@/lib/features/bin/api";
import { catalogApi } from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useState } from "react";

export function useWindowSize() {
  // Undefined initial width/height so the server and first client render
  // match (https://joshwcomeau.com/react/the-perils-of-rehydration/).
  const [windowSize, setWindowSize] = useState<{
    width: number | undefined;
    height: number | undefined;
  }>({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return windowSize;
}

export const useShiftKey = () => {
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftKeyPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftKeyPressed(false);
      }
    };

    // Releasing Shift while unfocused (alt-tab) never fires keyup, which
    // would leave this stuck true and silently invert bin actions (#635).
    const handleReset = () => setShiftKeyPressed(false);
    const handleVisibilityChange = () => {
      if (document.hidden) setShiftKeyPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleReset);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleReset);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return shiftKeyPressed;
};

export function resetApplication(dispatch: ReturnType<typeof useAppDispatch>) {
  dispatch(flowsheetApi.util.resetApiState());
  dispatch(flowsheetSlice.actions.reset());
  dispatch(catalogApi.util.resetApiState());
  dispatch(catalogSlice.actions.reset());
  dispatch(binApi.util.resetApiState());
  dispatch(authenticationSlice.actions.reset());
  // Wipe UI + admin state so a previous user's open panel, sidebar, roster
  // search string, and page index don't survive into the next session on the
  // same browser (#639).
  dispatch(applicationSlice.actions.reset());
  dispatch(adminSlice.actions.reset());
  // Clear the module-level admin org-id cache so a departing user's resolved
  // org UUID can't leak into the next session either (#616).
  resetOrganizationIdCache();
}
