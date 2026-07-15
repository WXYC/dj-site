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
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function useWindowSize() {
  // Initialize state with undefined width/height so server and client renders match
  // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
  const [windowSize, setWindowSize] = useState<{
    width: number | undefined;
    height: number | undefined;
  }>({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // only execute all the code below in client side
    // Handler to call on window resize
    function handleResize() {
      // Set window width/height to state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount
  return windowSize;
}

export const usePublicRoutes = () => {
  const publicRoutes = ["/live", "/login"];
  const pathname = usePathname();

  // Calculate during render - no useState/useEffect needed
  const isPublic = useMemo(() => {
    return publicRoutes.includes(pathname) || pathname.length <= 1;
  }, [pathname]);

  return isPublic;
};

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

    // Releasing Shift while the window is unfocused (alt-tab) never fires a
    // keyup here, so the flag would stay stuck true and silently invert bin
    // actions for the rest of the session. Reset on blur / tab-hide. (#635)
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
