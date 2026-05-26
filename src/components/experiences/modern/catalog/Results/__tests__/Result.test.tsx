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

const mockApplyRotation = vi.fn(async () => true);

function defaultRotationMarkingMock() {
  return {
    canMark: true,
    selectedBin: null,
    setSelectedBin: vi.fn(),
    activeBin: null,
    activeRotationId: undefined,
    loading: false,
    applyRotation: mockApplyRotation,
    hydrated: true,
  };
}

vi.mock("@/src/hooks/useCatalogRotationMarking", () => ({
  isRealLibraryAlbumId: (id: number) => id > 0,
  useCatalogRotationMarking: vi.fn(defaultRotationMarkingMock),
}));

import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { useBin } from "@/src/hooks/binHooks";
import { useCatalogRotationMarking } from "@/src/hooks/useCatalogRotationMarking";

import CatalogResult from "../Result";

afterEach(() => {
  vi.mocked(useCatalogRotationMarking).mockImplementation(
    defaultRotationMarkingMock,
  );
});

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

  it("shows rotation bin badge on artwork when album is in rotation", () => {
    const album = createTestAlbum({
      rotation_bin: "M",
      artwork_url: "https://i.discogs.com/confield.jpg",
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>,
    );

    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("shows rotation bin badge on album icon when there is no artwork", () => {
    const album = createTestAlbum({
      rotation_bin: "H",
      artwork_url: undefined,
    });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>,
    );

    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("does not show rotation badge when album is not in rotation", () => {
    const album = createTestAlbum({ rotation_bin: undefined });

    renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={album} />
        </tbody>
      </table>,
    );

    expect(screen.queryByText("H")).toBeNull();
    expect(screen.queryByText("M")).toBeNull();
    expect(screen.queryByText("L")).toBeNull();
    expect(screen.queryByText("S")).toBeNull();
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
    mockApplyRotation.mockClear();
    vi.mocked(useCatalogRotationMarking).mockImplementation(
      defaultRotationMarkingMock,
    );
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
  });

  it("replaces the open menu when right-clicking another row", () => {
    const { store } = renderWithProviders(
      <table>
        <tbody>
          <CatalogResult album={createTestAlbum({ id: 7001 })} />
          <CatalogResult album={createTestAlbum({ id: 7002 })} />
        </tbody>
      </table>,
    );
    const rows = document.querySelectorAll("tbody tr");
    fireEvent.contextMenu(rows[0]!);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(store.getState().catalog.resultContextMenu?.albumId).toBe(7001);

    fireEvent.contextMenu(rows[1]!);
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(store.getState().catalog.resultContextMenu?.albumId).toBe(7002);
  });

  it("opens album detail in edit mode from the edit catalog entry control", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    const album = createTestAlbum({ id: 5150 });
    const { store } = renderCatalogRow(album);
    fireEvent.click(
      screen.getByRole("button", { name: "Edit catalog entry in sidebar" }),
    );
    expect(store.getState().application.rightbar.panel).toEqual({
      type: "album-detail",
      albumId: 5150,
      mode: "edit",
    });
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

  it("shows rotation options for catalog editors", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    renderCatalogRow();
    fireEvent.contextMenu(document.querySelector("tbody tr")!);
    expect(screen.getByText("Heavy (H)")).toBeInTheDocument();
    expect(screen.getByText("Medium (M)")).toBeInTheDocument();
  });

  it("does not show rotation options without catalog edit permission", () => {
    renderCatalogRow();
    fireEvent.contextMenu(document.querySelector("tbody tr")!);
    expect(screen.queryByText("Heavy (H)")).toBeNull();
  });

  it("marks rotation from the context menu", async () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    renderCatalogRow(createTestAlbum({ id: 8000 }));
    fireEvent.contextMenu(document.querySelector("tbody tr")!);
    fireEvent.click(screen.getByText("Medium (M)"));
    expect(mockApplyRotation).toHaveBeenCalledWith("M");
  });
});
