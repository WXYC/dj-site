import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/utils/site-origin";

// Public, unauthenticated, indexable routes only. Everything else is
// auth-gated (dashboard/login/onboarding), an auth proxy, or an internal API.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/live", "/playlists"],
      disallow: ["/dashboard", "/login", "/onboarding", "/auth", "/api"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
