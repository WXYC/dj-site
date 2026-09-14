import { describe, it, expect } from "vitest";
import {
  mergeListenLinks,
  parseListenUrl,
} from "@/lib/features/catalog/listenLinks";
import type { AlbumMetadata } from "@/lib/features/metadata/types";

// Minimal LML metadata for DOGA (Juana Molina) — only the streaming-URL fields
// matter to the merge; the rest carry inert placeholders.
function metadata(overrides: Partial<AlbumMetadata> = {}): AlbumMetadata {
  return {
    discogsReleaseId: 24216789,
    discogsArtistId: null,
    discogsUrl: "",
    artworkUrl: "",
    releaseYear: 2022,
    spotifyUrl: "",
    appleMusicUrl: "",
    youtubeMusicUrl: "",
    bandcampUrl: "",
    soundcloudUrl: "",
    tracklist: [],
    genres: ["Rock"],
    styles: [],
    label: "Sonamos",
    fullReleaseDate: "2022-01-01",
    ...overrides,
  };
}

describe("parseListenUrl", () => {
  it("prepends https:// to a scheme-less bare domain and parses it", () => {
    expect(parseListenUrl("juanamolina.bandcamp.com/album/doga")).toEqual({
      ok: true,
      href: "https://juanamolina.bandcamp.com/album/doga",
      host: "juanamolina.bandcamp.com",
    });
  });

  it("strips a leading www. from the host", () => {
    const parsed = parseListenUrl("https://www.discogs.com/release/24216789");
    expect(parsed).toMatchObject({ ok: true, host: "discogs.com" });
  });

  it("rejects a URL whose scheme is not http(s)", () => {
    expect(parseListenUrl("ftp://files.example.com")).toEqual({ ok: false });
  });

  it("rejects a value that will not parse as a URL", () => {
    expect(parseListenUrl("not a url at all")).toEqual({ ok: false });
  });
});

describe("mergeListenLinks", () => {
  it("overrides LML's link for a service with the definitive URL", () => {
    const links = mergeListenLinks(
      metadata({ discogsUrl: "https://www.discogs.com/release/000-lml" }),
      ["https://www.discogs.com/release/24216789"],
    );

    const discogs = links.find((l) => l.label === "Discogs");
    expect(discogs?.href).toBe("https://www.discogs.com/release/24216789");
    // Only one Discogs chip — the override replaces, it does not duplicate.
    expect(links.filter((l) => l.label === "Discogs")).toHaveLength(1);
  });

  it("adds a chip for a service LML did not return", () => {
    const links = mergeListenLinks(metadata(), [
      "juanamolina.bandcamp.com/album/doga",
    ]);

    const bandcamp = links.find((l) => l.label === "Bandcamp");
    expect(bandcamp?.href).toBe("https://juanamolina.bandcamp.com/album/doga");
  });

  it("keeps LML's link when no definitive URL covers that service", () => {
    const links = mergeListenLinks(
      metadata({ spotifyUrl: "https://open.spotify.com/album/lml-spotify" }),
      ["juanamolina.bandcamp.com/album/doga"],
    );

    expect(links.find((l) => l.label === "Spotify")?.href).toBe(
      "https://open.spotify.com/album/lml-spotify",
    );
    expect(links.find((l) => l.label === "Bandcamp")?.href).toBe(
      "https://juanamolina.bandcamp.com/album/doga",
    );
  });

  it("sanitises a bare-domain definitive URL into an https href", () => {
    const links = mergeListenLinks(null, ["open.spotify.com/album/doga"]);
    expect(links.find((l) => l.label === "Spotify")?.href).toBe(
      "https://open.spotify.com/album/doga",
    );
  });

  it("keeps an unrecognised host as a Listen entry labelled by host", () => {
    const links = mergeListenLinks(null, ["sonamos.com/doga"]);
    expect(links).toEqual([
      { key: "extra-0", label: "sonamos.com", href: "https://sonamos.com/doga" },
    ]);
  });

  it("renders an unparseable value as a non-anchor entry (no href)", () => {
    const links = mergeListenLinks(null, ["not a url at all"]);
    expect(links).toEqual([{ key: "extra-0", label: "not a url at all" }]);
    expect(links[0].href).toBeUndefined();
  });

  it("renders a non-http(s) scheme as a non-anchor entry (no href)", () => {
    const links = mergeListenLinks(null, ["ftp://files.example.com"]);
    expect(links).toEqual([{ key: "extra-0", label: "ftp://files.example.com" }]);
  });

  it("orders service chips consistently and appends non-service entries last", () => {
    const links = mergeListenLinks(
      metadata({ spotifyUrl: "https://open.spotify.com/album/lml" }),
      [
        "sonamos.com/doga",
        "https://www.discogs.com/release/24216789",
        "juanamolina.bandcamp.com/album/doga",
      ],
    );

    expect(links.map((l) => l.label)).toEqual([
      "Spotify",
      "Bandcamp",
      "Discogs",
      "sonamos.com",
    ]);
  });

  it("returns an empty list when there is neither metadata nor definitive links", () => {
    expect(mergeListenLinks(null, undefined)).toEqual([]);
    expect(mergeListenLinks(metadata(), [])).toEqual([]);
  });

  it("ignores blank and whitespace-only definitive entries", () => {
    expect(mergeListenLinks(null, ["", "   "])).toEqual([]);
  });
});
