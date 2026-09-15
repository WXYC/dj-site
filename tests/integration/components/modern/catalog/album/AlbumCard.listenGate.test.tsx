import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";
import AlbumCard from "@/src/components/experiences/modern/catalog/album/AlbumCard";
import type { AlbumMetadata } from "@/lib/features/metadata/types";

// StreamingLinks is rendered for real here (unlike AlbumCard.test.tsx, which
// stubs it): the gate under test lives in AlbumCard's choice of whether the
// release's definitive `urls` reach the merge, so the assertions have to read
// the real Listen chips those urls produce.
vi.mock(
  "@/src/components/experiences/modern/catalog/album/DiscogsMarkupRenderer",
  () => ({ default: () => <span>mocked bio</span> }),
);
vi.mock(
  "@/src/components/experiences/modern/catalog/album/LibraryStatus",
  () => ({ default: () => <span>mocked status</span> }),
);
vi.mock(
  "@/src/components/experiences/modern/catalog/album/DiscogsUnavailableControl",
  () => ({ default: () => <span>mocked discogs-unavailable control</span> }),
);
vi.mock(
  "@/src/components/experiences/modern/catalog/album/Tracklist",
  () => ({ default: () => <span>mocked tracklist</span> }),
);
vi.mock(
  "@/src/components/experiences/modern/catalog/album/CompilationCreditsControl",
  () => ({ default: () => <span>mocked compilation credits control</span> }),
);

const ENV_KEY = "NEXT_PUBLIC_ROTATION_ADMIN_ENABLED";

afterEach(() => {
  delete process.env[ENV_KEY];
});

const defaultProps = {
  artworkUrl: "https://example.com/cover.jpg",
  metadata: null,
  metadataLoading: false,
  artistBio: null,
  bioTokens: null,
  artistWikipediaUrl: null,
};

// Only the streaming-URL fields drive the Listen merge. `discogsUrl` is left
// empty so the card renders no overflow-footer "Discogs" link — keeping the
// only "Discogs"/"Spotify" anchors in the DOM the Listen chips themselves.
function createTestMetadata(overrides: Partial<AlbumMetadata> = {}): AlbumMetadata {
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
    genres: [],
    styles: [],
    label: "Sonamos",
    fullReleaseDate: "2022-01-01",
    ...overrides,
  };
}

const LML_SPOTIFY = "https://open.spotify.com/album/lml-spotify";
const DEFINITIVE_SPOTIFY = "https://open.spotify.com/album/definitive-spotify";
const DEFINITIVE_BANDCAMP = "https://juanamolina.bandcamp.com/album/doga";

function albumWithUrls(urls: string[], overrides = {}) {
  return createTestAlbum({
    artist: createTestArtist({ name: "Juana Molina", lettercode: "MO", numbercode: 8 }),
    title: "DOGA",
    urls,
    ...overrides,
  });
}

describe("AlbumCard rotation-admin gate on definitive Listen links", () => {
  describe("flag ON: the definitive urls override LML", () => {
    it("replaces the LML service href and adds a new-service chip", () => {
      process.env[ENV_KEY] = "true";
      const album = albumWithUrls([DEFINITIVE_SPOTIFY, DEFINITIVE_BANDCAMP]);

      renderWithProviders(
        <AlbumCard
          album={album}
          {...defaultProps}
          metadata={createTestMetadata({ spotifyUrl: LML_SPOTIFY })}
        />,
      );

      // The definitive Spotify link wins over LML's for the same service.
      expect(screen.getByText("Spotify").closest("a")).toHaveAttribute(
        "href",
        DEFINITIVE_SPOTIFY,
      );
      // A service LML never returned is added from the definitive urls.
      expect(screen.getByText("Bandcamp").closest("a")).toHaveAttribute(
        "href",
        DEFINITIVE_BANDCAMP,
      );
    });

    it("renders definitive links even when the Discogs match is flagged unavailable", () => {
      process.env[ENV_KEY] = "true";
      const album = albumWithUrls([DEFINITIVE_BANDCAMP], {
        discogsUnavailable: true,
        discogsUnavailableNote: "audience doesn't use Discogs",
      });

      renderWithProviders(
        <AlbumCard
          album={album}
          {...defaultProps}
          metadata={createTestMetadata({ spotifyUrl: LML_SPOTIFY })}
        />,
      );

      expect(screen.getByText("Bandcamp").closest("a")).toHaveAttribute(
        "href",
        DEFINITIVE_BANDCAMP,
      );
      // The flagged auto-match's proxy-sourced LML chip stays suppressed.
      expect(screen.queryByText("Spotify")).toBeNull();
    });
  });

  describe("flag OFF (default): definitive urls are ignored, chips are pre-gate LML-only", () => {
    it("keeps LML's service href and adds no definitive chip", () => {
      const album = albumWithUrls([DEFINITIVE_SPOTIFY, DEFINITIVE_BANDCAMP]);

      renderWithProviders(
        <AlbumCard
          album={album}
          {...defaultProps}
          metadata={createTestMetadata({ spotifyUrl: LML_SPOTIFY })}
        />,
      );

      const spotify = screen.getByText("Spotify").closest("a")!;
      // LML's href, not the definitive override.
      expect(spotify).toHaveAttribute("href", LML_SPOTIFY);
      // The definitive-only Bandcamp chip is not added.
      expect(screen.queryByText("Bandcamp")).toBeNull();
      // The Listen row is exactly the LML-only set (Spotify alone here) — no
      // definitive chips leak in and no chip is dropped.
      const chipRow = spotify.parentElement!;
      expect(within(chipRow).getAllByRole("link")).toHaveLength(1);
    });

    it("suppresses the Listen row entirely for a flagged album whose only links are definitive urls", () => {
      const album = albumWithUrls([DEFINITIVE_BANDCAMP], {
        discogsUnavailable: true,
        discogsUnavailableNote: "audience doesn't use Discogs",
      });

      renderWithProviders(
        <AlbumCard
          album={album}
          {...defaultProps}
          metadata={createTestMetadata({ spotifyUrl: LML_SPOTIFY })}
        />,
      );

      // Pre-gate behavior: a flagged album with no LML chips renders no Listen
      // row at all, so the definitive Bandcamp link never appears.
      expect(screen.queryByText("Bandcamp")).toBeNull();
      expect(screen.queryByText("Spotify")).toBeNull();
    });
  });
});
