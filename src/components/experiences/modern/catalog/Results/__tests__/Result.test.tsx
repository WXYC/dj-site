import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTestAlbum } from "@/lib/test-utils";
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
  useCatalogSearch: () => ({
    selected: [],
    setSelection: vi.fn(),
    orderBy: "title",
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
