import { toast } from "sonner";

export default async function getArtworkFromLastFM({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
  try {
    const url =
      "https://ws.audioscrobbler.com/2.0/?" +
      "api_key=" +
      process.env.LAST_FM_KEY +
      "&method=album.getInfo" +
      "&album=" +
      encodeURIComponent(title) +
      "&artist=" +
      encodeURIComponent(artist) +
      "&format=json";
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Failed to fetch album art from Last.fm (${response.status})`);
      return null;
    }
    
    const jsonResponse = await response.json();
    
    const images = jsonResponse?.album?.image;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return null;
    }
    
    // Return the largest image (last in array)
    return images[images.length - 1]?.["#text"] || null;
  } catch {
    console.error("Error fetching album art from Last.fm");
    return null;
  }
}

export async function getSongInfoFromLastFM({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
  try {
    const url =
      "https://ws.audioscrobbler.com/2.0/?" +
      "api_key=" +
      process.env.LAST_FM_KEY +
      "&method=track.getInfo" +
      "&track=" +
      encodeURIComponent(title) +
      "&artist=" +
      encodeURIComponent(artist) +
      "&format=json";
    
    const response = await fetch(url);
    
    if (!response.ok) {
      toast.error(`Failed to fetch song info from Last.fm (${response.status})`);
      return null;
    }
    
    const jsonResponse = await response.json();
    return jsonResponse;
  } catch {
    toast.error("Error fetching song info from Last.fm");
    return null;
  }
}
