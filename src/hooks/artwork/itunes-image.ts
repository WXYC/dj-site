export default async function getArtworkFromItunes({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
  let url =
    "https://itunes.apple.com/search?" +
    "&term=" +
    title +
    " " +
    artist +
    "&entity=album";
  const iTunesResponse = await fetch(url).then((response) => {
    try {
      if (response.ok && response.body) {
        return response.body
          .getReader()
          .read()
          .then(({ value, done }) => {
            const decoder = new TextDecoder("utf-8");
            const responseText = decoder.decode(value);
            const jsonResponse = JSON.parse(responseText);

            let lowResDefault = jsonResponse?.results?.[0]?.artworkUrl100;
            return lowResDefault?.replace("100x100", "600x600");
          });
      } else return null;
    } catch (e) {
      console.error("Error fetching data from Itunes:", e);
      return null;
    }
  });
  return iTunesResponse;
}
