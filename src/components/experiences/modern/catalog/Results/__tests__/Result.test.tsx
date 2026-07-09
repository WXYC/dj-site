import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";
import { renderWithProviders } from "@/lib/test-utils/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/catalog",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ live: false }),
  useQueue: () => ({ addToQueue: vi.fn() }),
}));

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogQuerySearch: () => ({
    selected: [],
    setSelection: vi.fn(),
    sortBy: "album",
  }),
}));

import CatalogResult from "../Result";

describe("CatalogResult plays column (Bug 12)", () => {
  it("should display the actual play count, not hardcoded 0", () => {
    const album = createTestAlbum({ plays: 42 });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const cells = document.querySelectorAll("td");
    const playsCell = Array.from(cells).find(
      (cell) => cell.textContent?.trim() === "42"
    );
    expect(playsCell).toBeDefined();
  });

  it("should display dash when plays is 0", () => {
    const album = createTestAlbum({ plays: 0 });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const cells = document.querySelectorAll("td");
    const playsCell = Array.from(cells).find(
      (cell) => cell.textContent?.trim() === "—"
    );
    expect(playsCell).toBeDefined();
  });

  it("should display dash when plays is undefined", () => {
    const album = createTestAlbum({ plays: undefined });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const cells = document.querySelectorAll("td");
    const playsCell = Array.from(cells).find(
      (cell) => cell.textContent?.trim() === "—"
    );
    expect(playsCell).toBeDefined();
  });
});

describe("CatalogResult WXYC Exclusive badge", () => {
  it("should display WXYC EXCLUSIVE chip when on_streaming is false", () => {
    const album = createTestAlbum({ on_streaming: false });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.getByText("WXYC EXCLUSIVE")).toBeDefined();
  });

  it("should not display WXYC EXCLUSIVE chip when on_streaming is true", () => {
    const album = createTestAlbum({ on_streaming: true });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.queryByText("WXYC EXCLUSIVE")).toBeNull();
  });

  it("should not display WXYC EXCLUSIVE chip when on_streaming is undefined", () => {
    const album = createTestAlbum({ on_streaming: undefined });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.queryByText("WXYC EXCLUSIVE")).toBeNull();
  });
});

describe("CatalogResult Various Artists display", () => {
  it("should display 'Various Artists' when album_artist is set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Autechre", lettercode: "EL", numbercode: 5 }),
      album_artist: "Autechre",
      title: "All Tomorrow's Parties",
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Various Artists")).toBeDefined();
  });

  it("should display the album_artist as subtext when set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Autechre", lettercode: "EL", numbercode: 5 }),
      album_artist: "Autechre",
      title: "All Tomorrow's Parties",
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Autechre")).toBeDefined();
  });

  it("should display artist name normally when album_artist is not set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87 }),
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Stereolab")).toBeDefined();
    expect(screen.queryByText("Various Artists")).toBeNull();
  });
});

describe("CatalogResult call number column", () => {
  const album = createTestAlbum({
    artist: createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87 }),
    entry: 4,
  });

  it("should render the call number in its own cell with no chips", () => {
    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const callCell = Array.from(document.querySelectorAll("td")).find((cell) =>
      cell.textContent?.includes("RO 87/4")
    );
    expect(callCell).toBeDefined();
    expect(callCell!.textContent?.trim()).toBe("RO 87/4");
    expect(callCell!.querySelectorAll(".MuiChip-root")).toHaveLength(0);
  });

  it("should never wrap the call number", () => {
    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const callNumber = screen.getByText("RO 87/4");
    expect(getComputedStyle(callNumber).whiteSpace).toBe("nowrap");
  });

  it("should render genre and format chips inside the title cell", () => {
    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const titleCell = Array.from(document.querySelectorAll("td")).find((cell) =>
      cell.textContent?.includes(album.title)
    );
    expect(titleCell).toBeDefined();
    expect(titleCell!.textContent).toContain(album.artist.genre);
    expect(titleCell!.textContent).toContain(album.format);
  });
});

describe("CatalogResult text clamping", () => {
  it("should expose full artist and title text via the title attribute", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Chuquimamani-Condori", lettercode: "EL", numbercode: 12 }),
      title: "DJ E",
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Chuquimamani-Condori").getAttribute("title")).toBe(
      "Chuquimamani-Condori"
    );
    expect(screen.getByText("DJ E").getAttribute("title")).toBe("DJ E");
  });
});

describe("CatalogResult album artwork", () => {
  it("should render album artwork when artwork_url is provided", () => {
    const album = createTestAlbum({
      artwork_url: "https://i.discogs.com/confield.jpg",
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    const img = screen.getByAltText(`${album.artist.name} - ${album.title}`);
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBe("https://i.discogs.com/confield.jpg");
  });

  it("should fall back to ArtistAvatar when artwork_url is null", () => {
    const album = createTestAlbum({ artwork_url: null });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("should fall back to ArtistAvatar when artwork_url is undefined", () => {
    const album = createTestAlbum({ artwork_url: undefined });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>
    );

    expect(screen.queryByRole("img")).toBeNull();
  });
});
