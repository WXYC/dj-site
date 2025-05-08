export default async function getArtworkFromLastFM({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
  let url =
    "https://ws.audioscrobbler.com/2.0/?type=release&per_page=1&page=1&" +
    "api_key=" +
    process.env.LAST_FM_KEY +
    "&method=album.getInfo" +
    "&album=" +
    title +
    "&artist=" +
    artist +
    "&format=json";
  const lastFMResponse = await fetch(url).then((response) => {
    if (response.ok && response.body) {
      return response.body
        .getReader()
        .read()
        .then(({ value, done }) => {
          const decoder = new TextDecoder("utf-8");
          const responseText = decoder.decode(value);
          const jsonResponse = JSON.parse(responseText);

          let size = jsonResponse?.album?.image?.length ?? -1;
          if (size < 0) return null;

          return jsonResponse?.album?.image?.[size - 1]?.["#text"];
        });
    } else return null;
  });
  return lastFMResponse;
}

export async function getSongInfoFromLastFM({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
  let url =
    "https://ws.audioscrobbler.com/2.0/?type=release&per_page=1&page=1&" +
    "api_key=" +
    process.env.LAST_FM_KEY +
    "&method=track.getInfo" +
    "&track=" +
    title +
    "&artist=" +
    artist +
    "&format=json";
  const lastFMResponse = await fetch(url).then((response) => {
    try {
      if (response.ok && response.body) {
        return response.body
          .getReader()
          .read()
          .then(({ value, done }) => {
            const decoder = new TextDecoder("utf-8");
            const responseText = decoder.decode(value);
            const jsonResponse = JSON.parse(responseText);
            return jsonResponse;
          });
      } else return null;
    } catch (e) {
      console.error("Error fetching data from LastFM:", e);
      return null;
    }
  });

  return lastFMResponse;
}
