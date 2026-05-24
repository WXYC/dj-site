import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  useCanEditCatalog: vi.fn(() => false),
}));

vi.mock("@/src/hooks/binHooks", () => ({
  useBin: vi.fn(() => ({ bin: [], loading: false, isSuccess: true, isError: false })),
  useAddToBin: vi.fn(() => ({ addToBin: vi.fn(), loading: false })),
  useDeleteFromBin: vi.fn(() => ({ deleteFromBin: vi.fn(), loading: false })),
}));

import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { useBin } from "@/src/hooks/binHooks";

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

function renderCatalogRow(album = createTestAlbum({ id: 7000 })) {
  return renderWithProviders(
    <table>
      <tbody>
        <CatalogResult album={album} />
      </tbody>
    </table>,
  );
}

describe("CatalogResult context menu", () => {
  beforeEach(() => {
    vi.mocked(useCanEditCatalog).mockReturnValue(false);
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      loading: false,
      isSuccess: true,
      isError: false,
    });
  });

  it("opens a custom menu on right-click with core actions", () => {
    renderCatalogRow();
    const row = document.querySelector("tbody tr");
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row!);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("More information")).toBeInTheDocument();
    expect(screen.getByText("Add to mail bin")).toBeInTheDocument();
  });

  it("shows Remove from mail bin when the album is already in the bin", () => {
    const album = createTestAlbum({ id: 7001, title: "In Bin Album" });
    vi.mocked(useBin).mockReturnValue({
      bin: [album],
      loading: false,
      isSuccess: true,
      isError: false,
    });
    renderCatalogRow(album);
    fireEvent.contextMenu(document.querySelector("tbody tr")!);
    expect(screen.getByText("Remove from mail bin")).toBeInTheDocument();
    expect(screen.queryByText("Add to mail bin")).toBeNull();
  });

  it("shows Edit catalog entry only when the user can edit the catalog", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    renderCatalogRow();
    fireEvent.contextMenu(document.querySelector("tbody tr")!);
    expect(screen.getByText("Edit catalog entry")).toBeInTheDocument();

    vi.mocked(useCanEditCatalog).mockReturnValue(false);
    renderCatalogRow(createTestAlbum({ id: 7002 }));
    fireEvent.contextMenu(document.querySelectorAll("tbody tr")[1]!);
    const menus = screen.getAllByRole("menu");
    const lastMenu = menus[menus.length - 1];
    expect(lastMenu).not.toHaveTextContent("Edit catalog entry");
  });

  it("opens album detail from the context menu", () => {
    const album = createTestAlbum({ id: 4242 });
    const { store } = renderCatalogRow(album);
    fireEvent.contextMenu(document.querySelector("tbody tr")!);
    fireEvent.click(screen.getByText("More information"));
    expect(store.getState().application.rightbar.panel).toEqual({
      type: "album-detail",
      albumId: 4242,
    });
  });
});
