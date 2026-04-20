import { fetchJsonOrNull } from "./fetchJsonOrNull";

export default async function getArtworkFromItunes({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
  const searchTerm = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${searchTerm}&entity=album`;

  const json = await fetchJsonOrNull(url, "iTunes");
  const lowResDefault = json?.results?.[0]?.artworkUrl100;
  return lowResDefault ? lowResDefault.replace("100x100", "600x600") : null;
}
