import type { IntakeItem } from "@wxyc/shared";

export type ListenLink = { label: string; href: string };

const isHttps = (url: string | null | undefined): url is string => {
  try {
    return url != null && new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * The places a logged record can be heard before reviewing it, in a fixed order: Spotify, Apple Music, Bandcamp, then Discogs, which is a listing rather than a listen.
 * Only `https:` links are kept; Discogs is built from the release id.
 */
export function listenLinks(item: Partial<Pick<IntakeItem, "spotify_url" | "apple_music_url" | "bandcamp_url" | "discogs_release_id">>): ListenLink[] {
  const id = item.discogs_release_id;
  const links: [string, string | null | undefined][] = [
    ["Spotify", item.spotify_url],
    ["Apple Music", item.apple_music_url],
    ["Bandcamp", item.bandcamp_url],
    ["Discogs", id != null && Number.isInteger(id) && id > 0 ? `https://www.discogs.com/release/${id}` : null],
  ];
  return links.flatMap(([label, href]) => (isHttps(href) ? [{ label, href }] : []));
}
