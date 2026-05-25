import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
  createTestStore,
} from "@/lib/test-utils";
import { applicationSlice } from "@/lib/features/application/frontend";
import AlbumDetailPanel from "./AlbumDetailPanel";
import { useCanEditCatalog } from "@/src/hooks/catalogHooks";

const mockAlbum = createTestAlbum({
  id: 42,
  title: "Test Album",
  entry: 1,
  genre_id: 1,
  format_id: 1,
  artist_id: 5,
  artist: createTestArtist({
    id: 5,
    name: "Test Artist",
    genre: "Rock",
    lettercode: "TA",
    numbercode: 3,
  }),
  format: "cd",
});

let albumQueryState = {
  data: mockAlbum as typeof mockAlbum | undefined,
  isLoading: false,
  isError: false,
};

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetInformationQuery: vi.fn(() => albumQueryState),
    useGetGenresQuery: vi.fn(() => ({ data: [{ id: 1, genre_name: "Rock" }], isLoading: false })),
    useGetFormatsQuery: vi.fn(() => ({ data: [{ id: 1, format_name: "cd" }], isLoading: false })),
    useUpdateAlbumMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  };
});

vi.mock("@/lib/features/metadata/hooks", () => ({
  useAlbumArtwork: () => ({
    artworkUrl: "https://example.com/cover.jpg",
    isLoading: false,
    metadata: null,
  }),
  useArtistMetadata: () => ({
    artistMetadata: null,
    bioTokens: null,
  }),
}));

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCanEditCatalog: vi.fn(() => false),
}));

vi.mock("@/src/hooks/useCatalogRotationMarking", () => ({
  useCatalogRotationMarking: () => ({
    canMark: false,
    selectedBin: null,
    setSelectedBin: vi.fn(),
    activeBin: null,
    loading: false,
    applyRotation: vi.fn(async () => true),
    hydrated: true,
  }),
}));

vi.mock("./album/DiscogsMarkupRenderer", () => ({ default: () => null }));
vi.mock("./album/LibraryStatus", () => ({ default: () => null }));
vi.mock("./album/StreamingLinks", () => ({ default: () => null }));
vi.mock("./album/Tracklist", () => ({ default: () => null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

describe("AlbumDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    albumQueryState = { data: mockAlbum, isLoading: false, isError: false };
    vi.mocked(useCanEditCatalog).mockReturnValue(false);
  });

  it("renders album card with code overlay and no edit sections for non-editors", () => {
    renderWithProviders(<AlbumDetailPanel albumId={42} />);

    expect(screen.getByTestId("album-artwork-with-code")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-edit-artist-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("album-detail-edit-button")).not.toBeInTheDocument();
  });

  it("shows edit button and sections when editor enters edit mode via redux", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    const { store } = renderWithProviders(<AlbumDetailPanel albumId={42} />);

    store.dispatch(
      applicationSlice.actions.openPanel({
        type: "album-detail",
        albumId: 42,
        mode: "view",
      }),
    );

    fireEvent.click(screen.getByTestId("album-detail-edit-button"));
    expect(screen.getByTestId("catalog-edit-artist-card")).toBeInTheDocument();
    expect(store.getState().application.rightbar.panel).toMatchObject({
      type: "album-detail",
      albumId: 42,
      mode: "edit",
    });
  });

  it("opens in edit mode when redux panel mode is edit", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    const store = createTestStore();
    store.dispatch(
      applicationSlice.actions.openPanel({
        type: "album-detail",
        albumId: 42,
        mode: "edit",
      }),
    );
    renderWithProviders(<AlbumDetailPanel albumId={42} />, { store });

    expect(screen.getByTestId("catalog-edit-album-card")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-edit-library-code-card")).not.toBeInTheDocument();
  });

  it("shows edit again after cancel when openPanel sets mode edit", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    const store = createTestStore();
    store.dispatch(
      applicationSlice.actions.openPanel({
        type: "album-detail",
        albumId: 42,
        mode: "edit",
      }),
    );
    renderWithProviders(<AlbumDetailPanel albumId={42} />, { store });

    expect(screen.getByTestId("catalog-edit-artist-card")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("album-detail-cancel-edit-button"));
    expect(screen.queryByTestId("catalog-edit-artist-card")).not.toBeInTheDocument();
    expect(store.getState().application.rightbar.panel).toMatchObject({
      type: "album-detail",
      albumId: 42,
      mode: "view",
    });

    act(() => {
      store.dispatch(
        applicationSlice.actions.openPanel({
          type: "album-detail",
          albumId: 42,
          mode: "edit",
        }),
      );
    });
    expect(screen.getByTestId("catalog-edit-artist-card")).toBeInTheDocument();
  });

  it("does not mount edit UI when redux mode is edit but user cannot edit", () => {
    const { store } = renderWithProviders(<AlbumDetailPanel albumId={42} />);
    store.dispatch(
      applicationSlice.actions.openPanel({
        type: "album-detail",
        albumId: 42,
        mode: "edit",
      }),
    );

    expect(screen.queryByTestId("catalog-edit-artist-card")).not.toBeInTheDocument();
  });
});
