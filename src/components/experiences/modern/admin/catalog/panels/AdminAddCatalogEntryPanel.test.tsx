import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/src/hooks/useCatalogAlbumNavigation", () => ({
  useCatalogAlbumNavigation: () => ({
    closeAlbum: vi.fn(),
    openAlbum: vi.fn(),
    openAlbumEdit: vi.fn(),
    openAlbumAdd: vi.fn(),
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

  it("renders a single outlined form card with wizard, code row, and CardActions", () => {
    renderWithProviders(<CatalogAlbumAddForm />);

    expect(screen.getByTestId("catalog-add-modal")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-entry-form-card")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-add-code-strip")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-add-wizard-steps")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-add-artist-card")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-add-wizard-next")).toBeDisabled();
    expect(screen.getByTestId("catalog-add-wizard-next").closest(".MuiCardActions-root")).toBeTruthy();
  });

  it("keeps Next disabled until an artist is selected or created", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CatalogAlbumAddForm />);

    expect(screen.getByTestId("catalog-form-step-layer-artist")).toBeVisible();
    expect(screen.getByTestId("catalog-form-step-layer-album")).not.toBeVisible();

    const genreSelect = screen.getByRole("combobox", { name: /genre/i });
    await user.click(genreSelect);
    await user.click(screen.getByRole("option", { name: "Rock" }));

    expect(screen.getByTestId("catalog-add-wizard-next")).toBeDisabled();
  });
});
