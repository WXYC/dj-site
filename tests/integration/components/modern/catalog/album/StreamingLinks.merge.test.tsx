import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import StreamingLinks from "@/src/components/experiences/modern/catalog/album/StreamingLinks";
import type { AlbumMetadata } from "@/lib/features/metadata/types";

// LML metadata for DOGA (Juana Molina); only the streaming-URL fields drive the
// Listen merge.
function createTestMetadata(
  overrides: Partial<AlbumMetadata> = {},
): AlbumMetadata {
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

describe("StreamingLinks definitive-link merge", () => {
  it("overrides LML's chip href with the definitive URL for the same service", () => {
    renderWithProviders(
      <StreamingLinks
        metadata={createTestMetadata({
          discogsUrl: "https://www.discogs.com/release/000-lml",
        })}
        urls={["https://www.discogs.com/release/24216789"]}
      />,
    );

    const discogs = screen.getByText("Discogs").closest("a");
    expect(discogs).toHaveAttribute(
      "href",
      "https://www.discogs.com/release/24216789",
    );
    expect(discogs).toHaveAttribute("target", "_blank");
  });

  it("adds a chip for a service LML did not return", () => {
    renderWithProviders(
      <StreamingLinks
        metadata={createTestMetadata()}
        urls={["juanamolina.bandcamp.com/album/doga"]}
      />,
    );

    const bandcamp = screen.getByText("Bandcamp").closest("a");
    expect(bandcamp).toHaveAttribute(
      "href",
      "https://juanamolina.bandcamp.com/album/doga",
    );
  });

  it("sanitises a bare-domain definitive URL into an https href", () => {
    renderWithProviders(
      <StreamingLinks
        metadata={null}
        urls={["open.spotify.com/album/doga"]}
      />,
    );

    expect(screen.getByText("Spotify").closest("a")).toHaveAttribute(
      "href",
      "https://open.spotify.com/album/doga",
    );
  });

  it("renders an unparseable definitive value as a non-anchor label", () => {
    renderWithProviders(
      <StreamingLinks metadata={null} urls={["not a url at all"]} />,
    );

    const entry = screen.getByText("not a url at all");
    expect(entry).toBeInTheDocument();
    expect(entry.closest("a")).toBeNull();
  });

  it("renders nothing when there is neither metadata nor definitive links", () => {
    const { container } = renderWithProviders(
      <StreamingLinks metadata={null} urls={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
