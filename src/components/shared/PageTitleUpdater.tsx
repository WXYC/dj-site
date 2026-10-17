"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getPageTitle } from "@/lib/utils/page-title";

// Titles for routes with no other client-side title writer. Dashboard routes
// are deliberately absent: PageHeader owns document.title wherever it renders
// (modern experience), and every other dashboard page exports metadata, which
// the App Router applies on client-side navigation too (the flowsheet and the
// review editor draw no PageHeader and rely on it). Exactly one writer per
// route — adding a route here that also renders PageHeader
// reintroduces the race this map was trimmed to remove (#640 follow-up).
const PATH_TO_TITLE: Record<string, string> = {
  "/login": "Login",
  "/onboarding": "Onboarding",
};

/**
 * Client-side component that updates the page title on route changes for the
 * mapped routes above, which are outside the dashboard and export no
 * metadata. Unmapped routes are skipped entirely so this never fights the route's own title writer.
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
