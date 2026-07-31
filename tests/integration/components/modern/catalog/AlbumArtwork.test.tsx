import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";
import { AlbumArtwork } from "@/src/components/experiences/modern/catalog/AlbumArtwork";

describe("AlbumArtwork artwork_url priority", () => {
  it("renders an <img> when artwork_url is set and the release is not flagged", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Jessica Pratt" }),
      title: "On Your Own Love Again",
      artwork_url: "https://i.discogs.com/on-your-own-love-again.jpg",
    });

    renderWithProviders(<AlbumArtwork album={album} size={48} />);

    const img = screen.getByAltText(`${album.artist.name} - ${album.title}`);
    expect(img.getAttribute("src")).toBe(
      "https://i.discogs.com/on-your-own-love-again.jpg"
    );
  });
});

describe("AlbumArtwork genre-gradient placeholder", () => {
  it("falls back to the lettercode placeholder when artwork_url is undefined", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Stereolab", lettercode: "RO" }),
      artwork_url: undefined,
    });

    renderWithProviders(<AlbumArtwork album={album} size={48} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("RO")).toBeInTheDocument();
  });

  it("falls back to the lettercode placeholder when artwork_url is null", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Cat Power", lettercode: "RO" }),
      artwork_url: null,
    });

    renderWithProviders(<AlbumArtwork album={album} size={48} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("RO")).toBeInTheDocument();
  });
});

describe("AlbumArtwork discogsUnavailable gate", () => {
  it("renders the Not on Discogs badge instead of artwork_url when flagged", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Juana Molina" }),
      title: "DOGA",
      artwork_url: "https://i.discogs.com/doga.jpg",
      discogsUnavailable: true,
    });

    renderWithProviders(<AlbumArtwork album={album} size={48} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Not on Discogs")).toBeInTheDocument();
  });

  it("renders the Not on Discogs badge instead of the gradient placeholder when flagged", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Chuquimamani-Condori", lettercode: "EL" }),
      artwork_url: undefined,
      discogsUnavailable: true,
    });

    renderWithProviders(<AlbumArtwork album={album} size={48} />);

    expect(screen.queryByText("EL")).toBeNull();
    expect(screen.getByText("Not on Discogs")).toBeInTheDocument();
  });

  it("treats discogsUnavailable undefined as not flagged (optional-field default)", () => {
    const album = createTestAlbum({ discogsUnavailable: undefined, artwork_url: undefined });

    renderWithProviders(<AlbumArtwork album={album} size={48} />);

    expect(screen.queryByText("Not on Discogs")).toBeNull();
  });

  it("treats discogsUnavailable false as not flagged", () => {
    const album = createTestAlbum({
      discogsUnavailable: false,
      artwork_url: "https://i.discogs.com/duke-ellington-coltrane.jpg",
    });

    renderWithProviders(<AlbumArtwork album={album} size={48} />);

    expect(screen.queryByText("Not on Discogs")).toBeNull();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("surfaces discogsUnavailableNote via tooltip on hover", async () => {
    const album = createTestAlbum({
      discogsUnavailable: true,
      discogsUnavailableNote: "embargoed until 2026-09-01",
    });

    const { user } = renderWithProviders(<AlbumArtwork album={album} size={48} />);

    await user.hover(screen.getByLabelText("Not on Discogs"));

    expect(await screen.findByText("embargoed until 2026-09-01")).toBeInTheDocument();
  });

  it("falls back to a generic tooltip label when no note is present", async () => {
    const album = createTestAlbum({
      discogsUnavailable: true,
      discogsUnavailableNote: null,
    });

    const { user } = renderWithProviders(<AlbumArtwork album={album} size={48} />);

    await user.hover(screen.getByLabelText("Not on Discogs"));

    // The visible badge label and the tooltip content both read "Not on Discogs".
    expect((await screen.findAllByText("Not on Discogs")).length).toBeGreaterThan(1);
  });
});
