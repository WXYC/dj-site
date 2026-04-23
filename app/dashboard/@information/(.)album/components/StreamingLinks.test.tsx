import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StreamingLinks from "./StreamingLinks";
import type { AlbumMetadata } from "@/lib/features/metadata/types";

function createTestMetadata(
  overrides: Partial<AlbumMetadata> = {},
): AlbumMetadata {
  return {
    discogsReleaseId: 12345,
    discogsArtistId: null,
    discogsUrl: "",
    artworkUrl: "https://example.com/art.jpg",
    releaseYear: 2023,
    spotifyUrl: "",
    appleMusicUrl: "",
    youtubeMusicUrl: "",
    bandcampUrl: "",
    soundcloudUrl: "",
    tracklist: [],
    genres: ["Electronic"],
    styles: ["Ambient"],
    label: "Warp",
    fullReleaseDate: "2023-05-01",
    ...overrides,
  };
}

describe("StreamingLinks", () => {
  it("returns null when metadata is null", () => {
    const { container } = render(<StreamingLinks metadata={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when all URLs are empty strings", () => {
    const metadata = createTestMetadata();
    const { container } = render(<StreamingLinks metadata={metadata} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders only chips for services with URLs", () => {
    const metadata = createTestMetadata({
      spotifyUrl: "https://open.spotify.com/album/abc",
      bandcampUrl: "https://artist.bandcamp.com/album/xyz",
    });

    render(<StreamingLinks metadata={metadata} />);

    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Bandcamp")).toBeInTheDocument();
    expect(screen.queryByText("Apple Music")).not.toBeInTheDocument();
    expect(screen.queryByText("YouTube")).not.toBeInTheDocument();
    expect(screen.queryByText("SoundCloud")).not.toBeInTheDocument();
    expect(screen.queryByText("Discogs")).not.toBeInTheDocument();
  });

  it("chips link to correct URLs with target=_blank", () => {
    const metadata = createTestMetadata({
      spotifyUrl: "https://open.spotify.com/album/abc",
      discogsUrl: "https://www.discogs.com/release/12345",
    });

    render(<StreamingLinks metadata={metadata} />);

    const spotifyLink = screen.getByText("Spotify").closest("a");
    expect(spotifyLink).toHaveAttribute(
      "href",
      "https://open.spotify.com/album/abc",
    );
    expect(spotifyLink).toHaveAttribute("target", "_blank");

    const discogsLink = screen.getByText("Discogs").closest("a");
    expect(discogsLink).toHaveAttribute(
      "href",
      "https://www.discogs.com/release/12345",
    );
    expect(discogsLink).toHaveAttribute("target", "_blank");
  });

  it("renders all services when all URLs are provided", () => {
    const metadata = createTestMetadata({
      spotifyUrl: "https://spotify.com",
      appleMusicUrl: "https://music.apple.com",
      youtubeMusicUrl: "https://music.youtube.com",
      bandcampUrl: "https://bandcamp.com",
      soundcloudUrl: "https://soundcloud.com",
      discogsUrl: "https://discogs.com",
    });

    render(<StreamingLinks metadata={metadata} />);

    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Apple Music")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByText("Bandcamp")).toBeInTheDocument();
    expect(screen.getByText("SoundCloud")).toBeInTheDocument();
    expect(screen.getByText("Discogs")).toBeInTheDocument();
  });
});
