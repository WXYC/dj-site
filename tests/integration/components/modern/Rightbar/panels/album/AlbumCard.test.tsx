import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";
import AlbumCard from "@/src/components/experiences/modern/Rightbar/panels/album/AlbumCard";
import type { AlbumMetadata } from "@/lib/features/metadata/types";

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/DiscogsMarkupRenderer", () => ({
  default: () => <span>mocked bio</span>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/LibraryStatus", () => ({
  default: () => <span>mocked status</span>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/DiscogsUnavailableControl", () => ({
  default: () => <span>mocked discogs-unavailable control</span>,
}));

// Marker text (rather than the real `() => null` no-op) so gate tests can
// assert the child was never invoked, not just that it rendered nothing.
vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/StreamingLinks", () => ({
  default: () => <span>mocked streaming links</span>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/Tracklist", () => ({
  default: () => <span>mocked tracklist</span>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/CompilationCreditsControl", () => ({
  default: () => <span>mocked compilation credits control</span>,
}));

const defaultProps = {
  artworkUrl: "https://example.com/cover.jpg",
  metadata: null,
  metadataLoading: false,
  artistBio: null,
  bioTokens: null,
  artistWikipediaUrl: null,
};

function createTestMetadata(overrides: Partial<AlbumMetadata> = {}): AlbumMetadata {
  return {
    discogsReleaseId: 12345,
    discogsArtistId: 678,
    discogsUrl: "https://www.discogs.com/release/12345",
    artworkUrl: "https://i.discogs.com/edits.jpg",
    releaseYear: 2021,
    spotifyUrl: "",
    appleMusicUrl: "",
    youtubeMusicUrl: "",
    bandcampUrl: "",
    soundcloudUrl: "",
    tracklist: [{ position: "1", title: "Call Your Name", duration: "3:00" }],
    genres: ["Electronic"],
    styles: ["Experimental"],
    label: "self-released",
    fullReleaseDate: "2021-01-01",
    ...overrides,
  };
}

describe("AlbumCard Various Artists display", () => {
  // `album_artist` is written by the nightly catalog import and by nothing
  // else, and is empty for every row on the compilation shelf — so a title
  // that branched on it rendered for no release it was written for, while
  // displacing the shelf name that tells one compilation bucket from another.
  it("titles the card with the shelf's own artist name even when album_artist is set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({
        name: "Various Artists - Rock - S",
        lettercode: "V/A",
        numbercode: 0,
      }),
      album_artist: "Stereolab",
      title: "Aluminum Tunes",
    });

    renderWithProviders(<AlbumCard album={album} {...defaultProps} />);

    expect(screen.getByText(/Various Artists - Rock - S/)).toBeInTheDocument();
  });

  it("should display album_artist as subtext when set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Autechre", lettercode: "EL", numbercode: 5 }),
      album_artist: "Autechre",
      title: "All Tomorrow's Parties",
    });

    renderWithProviders(<AlbumCard album={album} {...defaultProps} />);

    expect(screen.getByText("Autechre")).toBeInTheDocument();
  });

  it("should display artist name normally when album_artist is not set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87 }),
      title: "Aluminum Tunes",
    });

    renderWithProviders(<AlbumCard album={album} {...defaultProps} />);

    expect(screen.getByText(/Stereolab/)).toBeInTheDocument();
    expect(screen.queryByText("Various Artists")).not.toBeInTheDocument();
  });

  it("should use album_artist for 'About' section heading when set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Autechre", lettercode: "EL", numbercode: 5 }),
      album_artist: "Autechre",
      title: "All Tomorrow's Parties",
    });

    renderWithProviders(
      <AlbumCard
        album={album}
        {...defaultProps}
        artistBio="Autechre are an English electronic music duo."
      />
    );

    expect(screen.getByText(/About Autechre/)).toBeInTheDocument();
  });
});

describe("AlbumCard discogsUnavailable gate", () => {
  const flaggedAlbum = createTestAlbum({
    artist: createTestArtist({ name: "Chuquimamani-Condori", lettercode: "EL", numbercode: 15 }),
    title: "Edits",
    label: "self-released",
    discogsUnavailable: true,
    discogsUnavailableNote: "audience doesn't use Discogs",
  });
  const metadata = createTestMetadata();

  it("renders the Not on Discogs badge instead of the artwork image", () => {
    renderWithProviders(<AlbumCard album={flaggedAlbum} {...defaultProps} metadata={metadata} />);

    expect(screen.queryByAltText(`${flaggedAlbum.title} cover`)).not.toBeInTheDocument();
    expect(screen.getByText("Not on Discogs")).toBeInTheDocument();
  });

  it("surfaces the discogsUnavailableNote as visible secondary text", () => {
    renderWithProviders(<AlbumCard album={flaggedAlbum} {...defaultProps} />);

    expect(screen.getByText("audience doesn't use Discogs")).toBeInTheDocument();
  });

  it("suppresses the label/year/genre/style metadata block", () => {
    renderWithProviders(<AlbumCard album={flaggedAlbum} {...defaultProps} metadata={metadata} />);

    expect(screen.queryByText(metadata.label)).not.toBeInTheDocument();
    expect(screen.queryByText(String(metadata.releaseYear))).not.toBeInTheDocument();
    expect(screen.queryByText("Electronic")).not.toBeInTheDocument();
    expect(screen.queryByText("Experimental")).not.toBeInTheDocument();
  });

  it("suppresses streaming links", () => {
    renderWithProviders(<AlbumCard album={flaggedAlbum} {...defaultProps} metadata={metadata} />);

    expect(screen.queryByText("mocked streaming links")).not.toBeInTheDocument();
  });

  it("suppresses the artist bio", () => {
    renderWithProviders(
      <AlbumCard
        album={flaggedAlbum}
        {...defaultProps}
        metadata={metadata}
        artistBio="Chuquimamani-Condori is a producer and multi-instrumentalist."
      />
    );

    expect(screen.queryByText(/About Chuquimamani-Condori/)).not.toBeInTheDocument();
  });

  it("suppresses the tracklist", () => {
    renderWithProviders(<AlbumCard album={flaggedAlbum} {...defaultProps} metadata={metadata} />);

    expect(screen.queryByText("mocked tracklist")).not.toBeInTheDocument();
  });

  it("suppresses the Discogs overflow-menu link", () => {
    renderWithProviders(<AlbumCard album={flaggedAlbum} {...defaultProps} metadata={metadata} />);

    expect(screen.queryByRole("link", { name: "Discogs" })).not.toBeInTheDocument();
  });

  it("still renders library-owned info: title, LibraryStatus, and the MD control", () => {
    renderWithProviders(<AlbumCard album={flaggedAlbum} {...defaultProps} />);

    expect(screen.getByText(/Edits/)).toBeInTheDocument();
    expect(screen.getByText("mocked status")).toBeInTheDocument();
    expect(screen.getByText("mocked discogs-unavailable control")).toBeInTheDocument();
  });
});

describe("AlbumCard discogsUnavailable regression (false/undefined)", () => {
  const metadata = createTestMetadata();

  it("renders artwork, metadata block, streaming links, bio, and tracklist normally when not flagged", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 112 }),
      title: "On Your Own Love Again",
      discogsUnavailable: false,
    });

    renderWithProviders(
      <AlbumCard
        album={album}
        {...defaultProps}
        metadata={metadata}
        artistBio="Jessica Pratt is a singer-songwriter."
      />
    );

    expect(screen.getByAltText(`${album.title} cover`)).toBeInTheDocument();
    expect(screen.getByText(metadata.label)).toBeInTheDocument();
    expect(screen.getByText(String(metadata.releaseYear))).toBeInTheDocument();
    expect(screen.getByText("Electronic")).toBeInTheDocument();
    expect(screen.getByText("Experimental")).toBeInTheDocument();
    expect(screen.getByText("mocked streaming links")).toBeInTheDocument();
    expect(screen.getByText(/About Jessica Pratt/)).toBeInTheDocument();
    expect(screen.getByText("mocked tracklist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discogs" })).toBeInTheDocument();
    expect(screen.queryByText("Not on Discogs")).not.toBeInTheDocument();
  });

  it("treats discogsUnavailable undefined (optional-field default) as not flagged", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Jessica Pratt" }),
      title: "On Your Own Love Again",
      discogsUnavailable: undefined,
    });

    renderWithProviders(<AlbumCard album={album} {...defaultProps} metadata={metadata} />);

    expect(screen.getByAltText(`${album.title} cover`)).toBeInTheDocument();
    expect(screen.queryByText("Not on Discogs")).not.toBeInTheDocument();
  });
});
