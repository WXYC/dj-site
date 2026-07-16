import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

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

import CatalogResult from "@/src/components/experiences/modern/catalog/Results/Result";

describe("CatalogResult plays metadata (Bug 12)", () => {
  it("should display the actual play count, not hardcoded 0", () => {
    const album = createTestAlbum({ plays: 42 });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    expect(screen.getByText("42")).toBeDefined();
  });

  it("should display dash when plays is 0", () => {
    const album = createTestAlbum({ plays: 0 });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    expect(screen.getByText("—")).toBeDefined();
  });

  it("should display dash when plays is undefined", () => {
    const album = createTestAlbum({ plays: undefined });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    expect(screen.getByText("—")).toBeDefined();
  });
});

describe("CatalogResult WXYC Exclusive badge", () => {
  it("should display WXYC EXCLUSIVE chip when on_streaming is false", () => {
    const album = createTestAlbum({ on_streaming: false });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
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
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
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
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
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
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    // Rendered in both the stacked (< xl) and separate-column (xl) layouts.
    expect(screen.getAllByText("Various Artists").length).toBeGreaterThan(0);
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
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    expect(screen.getAllByText("Autechre").length).toBeGreaterThan(0);
  });

  it("should display artist name normally when album_artist is not set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87 }),
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    expect(screen.getAllByText("Stereolab").length).toBeGreaterThan(0);
    expect(screen.queryByText("Various Artists")).toBeNull();
  });
});

describe("CatalogResult call number column", () => {
  const album = createTestAlbum({
    artist: createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87 }),
    entry: 4,
  });

  it("should render the call number in its own aligned cell with no chips", () => {
    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    const callCell = screen.getByText("RO 87/4").closest("td");
    expect(callCell).not.toBeNull();
    expect(callCell!.textContent?.trim()).toBe("RO 87/4");
    expect(callCell!.querySelectorAll(".MuiChip-root")).toHaveLength(0);
  });

  it("should never wrap the call number", () => {
    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    const callNumber = screen.getByText("RO 87/4");
    expect(getComputedStyle(callNumber).whiteSpace).toBe("nowrap");
  });

  it("should render genre and format chips in their own aligned cell", () => {
    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    const chipsCell = screen.getByText(album.artist.genre).closest("td");
    expect(chipsCell).not.toBeNull();
    expect(chipsCell!.textContent).toContain(album.format);
    // Chips column, not mixed into the release identity
    expect(chipsCell!.textContent).not.toContain(album.title);
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
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    expect(screen.getAllByText("Chuquimamani-Condori")[0].getAttribute("title")).toBe(
      "Chuquimamani-Condori"
    );
    expect(screen.getByText("DJ E").getAttribute("title")).toBe("DJ E");
  });
});

describe("CatalogResult record label column", () => {
  it("should render the record label in its own cell, separate from the album", () => {
    const album = createTestAlbum({
      title: "On Your Own Love Again",
      label: "Drag City",
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    const labelCell = screen.getByText("Drag City").closest("td");
    expect(labelCell).not.toBeNull();
    // Label is its own column, not bundled with the album title
    expect(labelCell!.textContent).not.toContain(album.title);
  });

  it("should show a dash in the label cell when the label is empty", () => {
    // Give plays a nonzero value so its cell doesn't also render "—"; then the
    // only dash is the label fallback, so this test can actually fail if that
    // fallback regresses.
    const album = createTestAlbum({ label: "", plays: 12 });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    const labelCell = screen.getByText("—").closest("td");
    expect(labelCell).not.toBeNull();
    // The dash is in the label cell, not the plays cell (which shows "12").
    expect(labelCell!.textContent).not.toContain("12");
    expect(screen.getByText("12")).toBeDefined();
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
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
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
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
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
          <CatalogResult album={album} live={false} addToQueue={vi.fn()} />
        </tbody>
      </table>
    );

    expect(screen.queryByRole("img")).toBeNull();
  });
});
