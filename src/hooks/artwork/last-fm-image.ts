import { toast } from "sonner";
import { fetchJsonOrNull } from "./fetchJsonOrNull";

export default async function getArtworkFromLastFM({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
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

  const json = await fetchJsonOrNull(url, "Last.fm");
  const images = json?.album?.image;
  if (!images || !Array.isArray(images) || images.length === 0) {
    return null;
  }
  return images[images.length - 1]?.["#text"] || null;
}

export async function getSongInfoFromLastFM({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
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

  return await fetchJsonOrNull(url, "Last.fm", (msg) => toast.error(msg));
}
