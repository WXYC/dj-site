import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, createTestAlbum, createTestArtist } from "@/lib/test-utils";
import AdminEditCatalogEntryPanel from "./AdminEditCatalogEntryPanel";

const mockGenres = [{ id: 1, genre_name: "Rock" }];
const mockFormats = [
  { id: 1, format_name: "cd" },
  { id: 2, format_name: "Vinyl" },
];

const mockAlbum = createTestAlbum({
  id: 99,
  title: "Test Album",
  label: "Test Label",
  entry: 3,
  genre_id: 1,
  format_id: 2,
  artist_id: 10,
  artist: createTestArtist({
    id: 10,
    name: "Test Artist",
    genre: "Rock",
    lettercode: "TA",
    numbercode: 5,
  }),
  format: "Vinyl",
  disc_quantity: 1,
});

let albumQueryState: {
  data: typeof mockAlbum | undefined;
  isLoading: boolean;
  isError: boolean;
} = {
  data: mockAlbum,
  isLoading: false,
  isError: false,
};

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
    useGetInformationQuery: vi.fn(() => albumQueryState),
    useUpdateAlbumMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
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

describe("AdminEditCatalogEntryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    albumQueryState = {
      data: mockAlbum,
      isLoading: false,
      isError: false,
    };
  });

  it("renders section cards for library code, artist, album, and rotation", () => {
    renderWithProviders(<AdminEditCatalogEntryPanel albumId={99} />);

    expect(screen.getByText("Edit catalog entry")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-edit-library-code-card")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-edit-artist-card")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-edit-album-card")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-edit-rotation-card")).toBeInTheDocument();

    expect(
      screen.getByTestId("catalog-edit-library-code-card").querySelector(
        ".MuiTypography-title-sm",
      ),
    ).toHaveTextContent("Library code");
  });

  it("wraps loading state in an outlined card", () => {
    albumQueryState = { data: undefined, isLoading: true, isError: false };
    renderWithProviders(<AdminEditCatalogEntryPanel albumId={99} />);

    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("wraps error state in an outlined card", () => {
    albumQueryState = { data: undefined, isLoading: false, isError: true };
    renderWithProviders(<AdminEditCatalogEntryPanel albumId={99} />);

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(
      screen.getByText("Could not load this catalog entry."),
    ).toBeInTheDocument();
  });
});
