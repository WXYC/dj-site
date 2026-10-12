"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Marks the history entry the guard pushed, so it is only taken back while it is still the current one. */
const GUARD = "leaveGuard";
/** Pressing back lands one entry before the form; the guard re-pushed itself, so leaving goes two. */
const BACK_PAST_GUARD = -2;

/**
 * Warns before a dirty form is thrown away. The App Router has no navigation-blocking
 * API, so this intercepts same-origin link clicks and browser back itself, and asks
 * the browser to confirm closing or reloading the tab. `pending` is true while the
 * caller should show its dialog; answer it with `stay` or `leave`.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | typeof BACK_PAST_GUARD | null>(null);
  // Set once the person chose to leave, so the navigation that follows is not intercepted.
  const leaving = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const intercept = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || leaving.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };
    const pushGuard = () => window.history.pushState({ ...window.history.state, [GUARD]: true }, "");
    const onPopState = () => {
      if (leaving.current) return;
      pushGuard();
      setTarget(BACK_PAST_GUARD);
    };
    pushGuard();
    window.addEventListener("beforeunload", warn);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", intercept, true);
      // Gone clean in place: drop the entry so back works normally. After a navigation the entry is no longer current.
      if (window.history.state?.[GUARD]) window.history.back();
    };
  }, [dirty]);

  const stay = useCallback(() => setTarget(null), []);
  const leave = useCallback(() => {
    leaving.current = true;
    if (typeof target === "string") router.push(target);
    else if (target !== null) window.history.go(target);
    setTarget(null);
  }, [router, target]);

  return { pending: target !== null, stay, leave };
}
