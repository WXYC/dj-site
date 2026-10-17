"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getPageTitle } from "@/lib/utils/page-title";

// Titles for routes outside the dashboard. Dashboard routes are deliberately
// absent: PageHeader owns document.title wherever it renders (the modern
// experience, including the flowsheet's layout), and the classic dashboard
// pages export metadata. Under app/dashboard/@modern, reviews/[id] (the review
// editor) is the only route that draws no PageHeader and takes its title from
// `metadata` alone; the App Router applies metadata on client-side navigation
// too. /login and /onboarding also export metadata with the same titles, so
// the entries below repeat what metadata sets. Adding a dashboard route here
// that also renders PageHeader reintroduces the race this map was trimmed to
// remove (#640 follow-up).
const PATH_TO_TITLE: Record<string, string> = {
  "/login": "Login",
  "/onboarding": "Onboarding",
};

/**
 * Client-side component that updates the page title on route changes for the
 * mapped routes above, which sit outside the dashboard. Unmapped routes are
 * skipped entirely so this never fights the route's own title writer.
 */
export default function PageTitleUpdater() {
  const pathname = usePathname();

  useEffect(() => {
    // Exact match first; otherwise a segment-boundary prefix match
    // (e.g. /onboarding/step matches /onboarding).
    const title =
      PATH_TO_TITLE[pathname] ??
      Object.entries(PATH_TO_TITLE).find(([path]) =>
        pathname.startsWith(`${path}/`),
      )?.[1];

    if (title) {
      document.title = getPageTitle(title);
    }
  }, [pathname]);

  return null;
}
