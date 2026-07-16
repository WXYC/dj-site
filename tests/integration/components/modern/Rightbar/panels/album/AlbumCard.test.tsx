import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";
import AlbumCard from "@/src/components/experiences/modern/Rightbar/panels/album/AlbumCard";

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/DiscogsMarkupRenderer", () => ({
  default: () => <span>mocked bio</span>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/LibraryStatus", () => ({
  default: () => <span>mocked status</span>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/StreamingLinks", () => ({
  default: () => null,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/album/Tracklist", () => ({
  default: () => null,
}));

const defaultProps = {
  artworkUrl: "https://example.com/cover.jpg",
  metadata: null,
  metadataLoading: false,
  artistBio: null,
  bioTokens: null,
  artistWikipediaUrl: null,
};

describe("AlbumCard Various Artists display", () => {
  it("should display 'Various Artists' in the title when album_artist is set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Autechre", lettercode: "EL", numbercode: 5 }),
      album_artist: "Autechre",
      title: "All Tomorrow's Parties",
    });

    renderWithProviders(<AlbumCard album={album} {...defaultProps} />);

    expect(screen.getByText(/Various Artists/)).toBeInTheDocument();
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
