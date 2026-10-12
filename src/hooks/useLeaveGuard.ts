"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Marks the history entry the guard pushed. */
const GUARD = "leaveGuard";
/** Pressing Back re-pushes the guard, so leaving by Back goes two entries: past the guard and past the editor's own entry. */
const BACK_PAST_GUARD = -2;
/** How long a Leave holds the guard off before concluding the page stayed. */
const SETTLE_MS = 300;

/**
 * Warns before a dirty form is thrown away. The App Router has no navigation-blocking
 * API, so this intercepts same-origin link clicks and browser back itself, and asks
 * the browser to confirm closing or reloading the tab. `pending` is true while the
 * caller should show its dialog; answer it with `stay` or `leave`.
 *
 * The history model: while dirty, the history is `[..., editor, guard]`, and the guard entry carries
 * a marker in `history.state`. A Back press shows as a popstate that lands on an entry WITHOUT the
 * marker while the guard was current; a return to the editor (for example, closing a modal that
 * pushed its own entry) shows as a popstate that lands ON the marked guard entry, and is ignored.
 * Leave by link replaces the guard entry with the destination, so Back from there reaches the
 * editor's own entry as it would after any link. Leave by Back goes two entries, not one: the
 * traversal left the guard, but the guard was re-pushed on top of the editor's own entry, so
 * `go(-2)` is the single step that reaches the entry before the editor.
 *
 * Known limitation: navigations that are not anchor clicks, Back or unload (for example sign-out
 * from the left bar) are not guarded.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | typeof BACK_PAST_GUARD | null>(null);
  // Set only while a navigation that takes the editor away is under way; reset if the editor is still here after.
  const leaving = useRef(false);
  const settling = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The guard entry was pushed and is still ours to take back, and the URL it was pushed at (a refresh can rewrite its state).
  const pushed = useRef<string | null>(null);
  // Whether the guard entry was the current one at the last popstate.
  const onGuard = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving.current) event.preventDefault();
    };
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
    const pushGuard = () => {
      window.history.pushState({ ...window.history.state, [GUARD]: true }, "");
      pushed.current = window.location.href;
      onGuard.current = true;
    };
    const onPopState = () => {
      const landedOnGuard = Boolean(window.history.state?.[GUARD]);
      const wasOnGuard = onGuard.current;
      onGuard.current = landedOnGuard;
      if (leaving.current || landedOnGuard || !wasOnGuard) return;
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
      // Gone clean in place: drop the entry so back works normally. After a navigation the URL differs and the entry is not ours.
      if (pushed.current === window.location.href) window.history.back();
      pushed.current = null;
      onGuard.current = false;
    };
  }, [dirty]);

  useEffect(() => () => clearTimeout(settling.current), []);

  const stay = useCallback(() => setTarget(null), []);
  const leave = useCallback(() => {
    leaving.current = true;
    pushed.current = null;
    if (typeof target === "string") router.replace(target);
    else if (target !== null) window.history.go(target);
    setTarget(null);
    // If the editor is still here, the navigation did not take it away: guard again.
    clearTimeout(settling.current);
    settling.current = setTimeout(() => {
      leaving.current = false;
      pushed.current = window.history.state?.[GUARD] ? window.location.href : null;
    }, SETTLE_MS);
  }, [router, target]);

  /** Drops the guard entry and resolves once the browser has stepped off it, for a caller about to `router.replace` over the editor. */
  const release = useCallback(async () => {
    leaving.current = true;
    if (pushed.current !== window.location.href) return;
    pushed.current = null;
    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history.back();
    });
  }, []);

  return { pending: target !== null, stay, leave, release };
}
