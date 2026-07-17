import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/utils/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getSiteOrigin();

  return [
    {
      url: origin,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      // Live view reflects the current on-air flowsheet in real time.
      url: `${origin}/live`,
      changeFrequency: "always",
      priority: 0.8,
    },
    {
      url: `${origin}/playlists`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
