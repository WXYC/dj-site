import { getLmlBaseUrl } from "./lml-client";

export default async function getArtworkFromLml({
  title,
  artist,
}: {
  title: string;
  artist: string;
}): Promise<string | null> {
  try {
    const response = await fetch(
      `${getLmlBaseUrl()}/api/v1/discogs/search?limit=1`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist, album: title }),
      },
    );

    if (!response.ok) {
      console.log(
        `Failed to fetch album art from LML (${response.status})`,
      );
      return null;
    }

    const json = await response.json();
    return json?.results?.[0]?.artwork_url || null;
  } catch (e) {
    console.log("Error fetching album art from LML");
    return null;
  }
}
