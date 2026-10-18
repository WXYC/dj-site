import { describe, expect, it } from "vitest";
import { listenLinks } from "@/lib/features/reviews/listenLinks";

const SPOTIFY = { label: "Spotify", href: "https://open.spotify.com/album/1" };
const APPLE = { label: "Apple Music", href: "https://music.apple.com/us/album/2" };
const BANDCAMP = { label: "Bandcamp", href: "https://juanamolina.bandcamp.com/album/doga" };
const DISCOGS = { label: "Discogs", href: "https://www.discogs.com/release/42" };

const urls = {
  spotify_url: SPOTIFY.href,
  apple_music_url: APPLE.href,
  bandcamp_url: BANDCAMP.href,
  discogs_release_id: 42,
};
const all = [SPOTIFY, APPLE, BANDCAMP, DISCOGS];

describe("listenLinks", () => {
  it("returns nothing when no link is known", () => {
    expect(listenLinks({})).toEqual([]);
    expect(listenLinks({ spotify_url: null, apple_music_url: null, bandcamp_url: null, discogs_release_id: null })).toEqual([]);
  });

  // Every subset of the four links, in the fixed order Spotify, Apple Music, Bandcamp, Discogs.
  it.each(Array.from({ length: 16 }, (_, mask) => mask))("returns the known links in order for subset %i", (mask) => {
    const keys = Object.keys(urls) as (keyof typeof urls)[];
    const item = Object.fromEntries(keys.filter((_, i) => mask & (1 << i)).map((k) => [k, urls[k]]));
    expect(listenLinks(item)).toEqual(all.filter((_, i) => mask & (1 << i)));
  });

  it.each([
    ["http://", "http://open.spotify.com/album/1"],
    ["javascript:", "javascript:alert(1)"],
    ["a non-URL", "not a url"],
  ])("drops a %s link", (_name, bad) => {
    expect(listenLinks({ ...urls, spotify_url: bad })).toEqual([APPLE, BANDCAMP, DISCOGS]);
  });

  it.each([0, -3, 1.5])("drops a Discogs id of %s", (id) => {
    expect(listenLinks({ ...urls, discogs_release_id: id })).toEqual([SPOTIFY, APPLE, BANDCAMP]);
  });
});
