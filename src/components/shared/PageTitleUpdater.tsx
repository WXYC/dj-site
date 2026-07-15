"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getPageTitle } from "@/lib/utils/page-title";

// Titles for routes with no other client-side title writer. Dashboard routes
// are deliberately absent: PageHeader owns document.title wherever it renders
// (modern experience), and classic dashboard pages export metadata. Exactly
// one writer per route — adding a route here that also renders PageHeader
// reintroduces the race this map was trimmed to remove (#640 follow-up).
const PATH_TO_TITLE: Record<string, string> = {
  "/": "DJ Site",
  "/live": "Listen Live",
  "/login": "Login",
  "/onboarding": "Onboarding",
};

/**
 * Client-side component that updates the page title on route changes for the
 * mapped routes above. Next.js metadata exports only work on initial page
 * load, not during client-side navigation. Unmapped routes are skipped
 * entirely so this never fights the route's own title writer.
 */
export default function PageTitleUpdater() {
  const pathname = usePathname();

  useEffect(() => {
    // Exact match first; otherwise a segment-boundary prefix match
    // (e.g. /onboarding/step matches /onboarding). "/" is excluded from
    // prefix matching — every path starts with "/", so it would be a
    // catch-all that overwrites titles on unmapped routes.
    const title =
      PATH_TO_TITLE[pathname] ??
      Object.entries(PATH_TO_TITLE).find(
        ([path]) => path !== "/" && pathname.startsWith(`${path}/`),
      )?.[1];

    if (title) {
      document.title = getPageTitle(title);
    }
  }, [pathname]);

  return null;
}
