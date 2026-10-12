"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Warns before a dirty form is thrown away. The App Router has no navigation-blocking API, so while
 * `dirty` this intercepts same-origin link clicks (a capture-phase listener on `document`, ahead of
 * next/link's own handler) and asks the browser to confirm closing, reloading or leaving the site
 * (`beforeunload`; the prompt's text is the browser's). `pending` is true while the caller should show
 * its dialog; answer it with `stay` or `leave`, and Leave navigates with `router.push`.
 *
 * The hook never calls `history`, so the browser's Back button is not guarded: a Back press from a dirty
 * form leaves without asking. Nor is any navigation that is not an anchor click or an unload: a sign-out,
 * a programmatic `router.push` elsewhere, a modified click or a link to another site.
 *
 * Leave by link is a soft navigation: every link the page can show stays under the one root layout and
 * inside the app router. Next falls back to a full page load only when its fetch for the destination
 * fails or the deployment changed since the tab loaded; the browser's own prompt then follows the Leave.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const intercept = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);

  const stay = useCallback(() => setTarget(null), []);
  const leave = useCallback(() => {
    if (target !== null) router.push(target);
    setTarget(null);
  }, [router, target]);

  return { pending: target !== null, stay, leave };
}
