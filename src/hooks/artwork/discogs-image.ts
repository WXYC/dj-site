import { toast } from "sonner";

export default async function getArtworkFromDiscogs({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
  try {
    const url =
      "https://api.discogs.com/database/search?type=release&per_page=1&page=1&" +
      "artist=" +
      encodeURIComponent(artist) +
      "&title=" +
      encodeURIComponent(title) +
      "&key=" +
      process.env.DISCOGS_CONSUMER_KEY +
      "&secret=" +
      process.env.DISCOGS_CONSUMER_SECRET;
    
    const discogsResponse = await fetch(url);
    
    if (!discogsResponse.ok) {
      console.log(`Failed to fetch album art from Discogs (${discogsResponse.status})`);
      return null;
    }
    
    const discogsJSON = await discogsResponse.json();
    return discogsJSON?.results?.[0]?.cover_image || null;
  } catch (e) {
    console.log("Error fetching album art from Discogs");
    return null;
  }
}
