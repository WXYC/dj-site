import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/lib/test-utils";
import CatalogAlbumViewModal from "./CatalogAlbumViewModal";
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
  format: "CD",
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

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "rock-TA-3-1" }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("CatalogAlbumViewModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    albumQueryState = { data: mockAlbum, isLoading: false, isError: false };
    vi.mocked(useCanEditCatalog).mockReturnValue(false);
  });

  it("renders album card in modal for non-editors", () => {
    renderWithProviders(<CatalogAlbumViewModal />);

    expect(screen.getByTestId("album-detail-modal")).toBeInTheDocument();
    expect(screen.getByTestId("album-artwork-with-code")).toBeInTheDocument();
    expect(screen.queryByTestId("album-detail-edit-button")).not.toBeInTheDocument();
  });

  it("shows edit button for catalog editors", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    renderWithProviders(<CatalogAlbumViewModal />);

    expect(screen.getByTestId("album-detail-edit-button")).toBeInTheDocument();
  });
});
