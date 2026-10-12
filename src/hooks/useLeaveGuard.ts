"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Marks the history entry the guard pushed. */
const GUARD = "leaveGuard";
/** Marks the editor's own entry, with the id of the hook instance that guards it. */
const ENTRY = "leaveGuardEditor";
/** Pressing Back re-pushes the guard, so leaving by Back goes two entries: past the guard and past the editor's own entry. */
const BACK_PAST_GUARD = -2;

/**
 * Warns before a dirty form is thrown away. The App Router has no navigation-blocking
 * API, so this intercepts same-origin link clicks and browser back itself, and asks
 * the browser to confirm closing or reloading the tab. `pending` is true while the
 * caller should show its dialog; answer it with `stay` or `leave`.
 *
 * The history model: while dirty, the history is `[..., editor, guard]`. The editor's own entry carries
 * a per-instance key in `history.state` and the guard entry carries a marker. A Back press shows as a
 * popstate that lands on the editor's marked entry while the guard was current. A return to the guard
 * (for example, closing a modal that pushed its own entry) lands on the marked guard and is ignored. Any
 * other landing, such as a jump several entries back or a forward past the editor, cannot be stopped:
 * the hook lets it through, pushes nothing and asks nothing.
 * Leave by link replaces the guard entry with the destination, so Back from there reaches the
 * editor's own entry as it would after any link. Leave by Back goes two entries, not one: the
 * traversal left the guard, but the guard was re-pushed on top of the editor's own entry, so
 * `go(-2)` is the single step that reaches the entry before the editor.
 *
 * The hook never touches history when the editor unmounts: a navigation is then already under way and
 * owns history, and a `history.back()` there makes Next drop it. It takes the guard entry back only when
 * the form goes clean while the editor stays, and `release` does so for a caller about to redirect.
 *
 * Known limitation: navigations that are not anchor clicks, Back or unload (for example sign-out, or a
 * programmatic `router.push` elsewhere) are not guarded, and from a dirty editor they can leave the guard
 * entry under the destination, which costs one extra Back press.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const id = useId();
  const [target, setTarget] = useState<string | typeof BACK_PAST_GUARD | null>(null);
  // A Leave by Back is under way: the next popstate or beforeunload is ours. Cleared when the dialog next opens.
  const expecting = useRef(false);
  // The guard entry was pushed and is still ours to take back, and the URL it was pushed at (a refresh can rewrite its state).
  const pushed = useRef<string | null>(null);
  // Whether the guard entry was the current one at the last popstate.
  const onGuard = useRef(false);
  // Declared first so its cleanup runs first on unmount.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (expecting.current) expecting.current = false;
      else event.preventDefault();
    };
    const intercept = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      expecting.current = false;
      setTarget(url.pathname + url.search + url.hash);
    };
    const pushGuard = () => {
      const state = window.history.state;
      window.history.replaceState({ ...state, [ENTRY]: id }, "");
      window.history.pushState({ ...state, [ENTRY]: undefined, [GUARD]: true }, "");
      pushed.current = window.location.href;
      onGuard.current = true;
    };
    const onPopState = () => {
      const state = window.history.state;
      const wasOnGuard = onGuard.current;
      expecting.current = false;
      onGuard.current = Boolean(state?.[GUARD]);
      if (onGuard.current || !wasOnGuard) return;
      if (state?.[ENTRY] !== id) {
        pushed.current = null;
        return;
      }
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
      // Gone clean in place: drop the entry so back works normally. Not on unmount, and not after a navigation (the URL differs).
      if (mounted.current && pushed.current === window.location.href) window.history.back();
      pushed.current = null;
      onGuard.current = false;
    };
  }, [dirty, id]);

  const stay = useCallback(() => setTarget(null), []);
  const leave = useCallback(() => {
    if (typeof target === "string") router.replace(target);
    else if (target !== null) {
      expecting.current = true;
      window.history.go(target);
    }
    setTarget(null);
  }, [router, target]);

  /** Drops the guard entry and resolves once the browser has stepped off it, for a caller about to `router.replace` over the editor. */
  const release = useCallback(async () => {
    if (pushed.current !== window.location.href) return;
    pushed.current = null;
    onGuard.current = false;
    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history.back();
    });
  }, []);

  return { pending: target !== null, stay, leave, release };
}
