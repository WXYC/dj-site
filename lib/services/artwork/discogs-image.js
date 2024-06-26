export default async function getArtworkFromDiscogs({ title, artist }) {
  let url =
    "https://api.discogs.com/database/search?type=release&per_page=1&page=1&" +
    "artist=" +
    artist +
    "&title=" +
    title +
    "&key=" +
    process.env.NEXT_PUBLIC_DISCOGS_CONSUMER_KEY +
    "&secret=" +
    process.env.NEXT_PUBLIC_DISCOGS_CONSUMER_SECRET;
  const discogsResponse = await fetch(url);
  const discogsJSON = await discogsResponse.json();
  return discogsJSON?.results?.[0]?.cover_image;
}
