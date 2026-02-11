"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getPageTitle } from "@/lib/utils/page-title";

// Map of paths to their page titles
const PATH_TO_TITLE: Record<string, string> = {
  "/": "DJ Site",
  "/live": "Listen Live",
  "/login": "Login",
  "/onboarding": "Onboarding",
  "/dashboard/catalog": "Card Catalog",
  "/dashboard/flowsheet": "Flowsheet",
  "/dashboard/admin/roster": "DJ Roster",
};

/**
 * Client-side component that updates the page title on route changes.
 * This is necessary because Next.js metadata exports only work on initial page load,
 * not during client-side navigation.
 */
export default function PageTitleUpdater() {
  const pathname = usePathname();

  useEffect(() => {
    // Find the matching title for the current path
    // Check exact matches first, then check if path starts with any key
    let title: string | undefined;
    
    // Try exact match first
    if (PATH_TO_TITLE[pathname]) {
      title = PATH_TO_TITLE[pathname];
    } else {
      // Try prefix match (e.g., /dashboard/flowsheet/... matches /dashboard/flowsheet)
      const matchingPath = Object.keys(PATH_TO_TITLE).find((path) =>
        pathname.startsWith(path)
      );
      if (matchingPath) {
        title = PATH_TO_TITLE[matchingPath];
      }
    }

    // Update document title if we found a match
    if (title) {
      document.title = getPageTitle(title);
    }
  }, [pathname]);

  return null;
}
