import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/lib/test-utils";
import LibraryStatus from "./LibraryStatus";

const catPowerAlbum = () =>
  createTestAlbum({
    title: "Moon Pix",
    artist: createTestArtist({
      name: "Cat Power",
      lettercode: "RO",
      numbercode: 23,
      genre: "Rock",
    }),
    label: "Matador Records",
  });

describe("LibraryStatus", () => {
  it("shows 'In Library' chip when date_lost is undefined", () => {
    const album = catPowerAlbum();

    renderWithProviders(<LibraryStatus album={album} />);

    expect(screen.getByText("In Library")).toBeInTheDocument();
    expect(screen.getByText("Mark Missing")).toBeInTheDocument();
  });

  it("shows 'Missing since...' chip when date_lost is set and date_found is not", () => {
    const album = catPowerAlbum();
    album.date_lost = "2025-03-15";

    renderWithProviders(<LibraryStatus album={album} />);

    expect(
      screen.getByText(
        `Missing since ${new Date("2025-03-15").toLocaleDateString()}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Mark Found")).toBeInTheDocument();
  });

  it("shows 'In Library' when date_found is after date_lost", () => {
    const album = catPowerAlbum();
    album.date_lost = "2025-03-15";
    album.date_found = "2025-04-01";

    renderWithProviders(<LibraryStatus album={album} />);

    expect(screen.getByText("In Library")).toBeInTheDocument();
    expect(screen.getByText("Mark Missing")).toBeInTheDocument();
  });

  it("shows missing when date_found is before date_lost", () => {
    const album = catPowerAlbum();
    album.date_lost = "2025-04-10";
    album.date_found = "2025-03-01";

    renderWithProviders(<LibraryStatus album={album} />);

    expect(
      screen.getByText(
        `Missing since ${new Date("2025-04-10").toLocaleDateString()}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Mark Found")).toBeInTheDocument();
  });
});
