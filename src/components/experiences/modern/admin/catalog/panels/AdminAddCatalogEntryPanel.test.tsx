import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import CatalogAlbumAddForm from "@/src/components/experiences/modern/catalog/CatalogAlbumAddForm";

const mockGenres = [{ id: 1, genre_name: "Rock" }];
const mockFormats = [
  { id: 1, format_name: "cd" },
  { id: 2, format_name: "Vinyl" },
];

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetGenresQuery: vi.fn(() => ({
      data: mockGenres,
      isLoading: false,
    })),
    useGetFormatsQuery: vi.fn(() => ({
      data: mockFormats,
      isLoading: false,
    })),
    useGetInformationQuery: vi.fn(() => ({
      data: undefined,
      isLoading: false,
    })),
    useAddArtistMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
    useAddAlbumMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
    useLazyPeekArtistCodeQuery: vi.fn(() => [vi.fn(), { isLoading: false }]),
  };
});

vi.mock("@/src/hooks/useCatalogRotationMarking", () => ({
  useCatalogRotationMarking: () => ({
    canMark: true,
    selectedBin: null,
    setSelectedBin: vi.fn(),
    activeBin: null,
    activeRotationId: undefined,
    loading: false,
    applyRotation: vi.fn(async () => true),
    hydrated: true,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

describe("CatalogAlbumAddForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section cards for library code, artist, album, and rotation", () => {
    renderWithProviders(<CatalogAlbumAddForm />);

    expect(screen.getByTestId("catalog-add-library-code-card")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-add-artist-card")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-add-album-card")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-add-rotation-card")).toBeInTheDocument();
  });
});
