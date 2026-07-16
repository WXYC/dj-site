import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/catalog",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ live: false }),
  useQueue: () => ({ addToQueue: vi.fn() }),
}));

vi.mock(
  "@/src/components/experiences/modern/catalog/Results/ResultsContainer",
  () => ({
    default: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  }),
);

vi.mock("@/src/components/experiences/modern/catalog/Results/Result", () => ({
  default: ({ album }: { album: { id: number; title: string } }) => (
    <tr data-testid={`result-${album.id}`}>
      <td>{album.title}</td>
    </tr>
  ),
}));

vi.mock(
  "@/src/components/experiences/modern/catalog/Results/MobileResult",
  () => ({
    default: ({ album }: { album: { id: number; title: string } }) => (
      <div data-testid={`mobile-result-${album.id}`}>{album.title}</div>
    ),
  }),
);

const mockUseCatalogQueryResults = vi.hoisted(() => vi.fn());
const mockUseCatalogQuerySearch = vi.hoisted(() => vi.fn());
const mockUseMediaQuery = vi.hoisted(() => vi.fn());

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogQueryResults: () => mockUseCatalogQueryResults(),
  useCatalogQuerySearch: () => mockUseCatalogQuerySearch(),
}));

vi.mock("@/src/hooks/useMediaQuery", () => ({
  useMediaQuery: () => mockUseMediaQuery(),
}));

import Results from "@/src/components/experiences/modern/catalog/Results/Results";

const albums = [
  createTestAlbum({
    id: 1,
    title: "DOGA",
    artist: createTestArtist({ name: "Juana Molina" }),
  }),
  createTestAlbum({
    id: 2,
    title: "Cover Story",
    artist: createTestArtist({ name: "Stereolab" }),
  }),
];

function mockQueryResults(overrides: {
  results?: typeof albums;
  isLoadingInitial?: boolean;
  isFetchingMore?: boolean;
  hasNextPage?: boolean;
}) {
  mockUseCatalogQueryResults.mockReturnValue({
    results: overrides.results ?? [],
    total: (overrides.results ?? []).length,
    isLoadingInitial: overrides.isLoadingInitial ?? false,
    isFetchingMore: overrides.isFetchingMore ?? false,
    hasNextPage: overrides.hasNextPage ?? false,
    fetchNextPage: vi.fn(),
    isError: false,
  });
}

describe("Results loading overlay", () => {
  beforeEach(() => {
    mockUseCatalogQuerySearch.mockReturnValue({
      selected: [],
      setSelection: vi.fn(),
      sortBy: "album",
      sortOrder: "asc",
      hasActiveQuery: true,
    });
    mockUseMediaQuery.mockReturnValue(false);
  });

  it("keeps the same spinner DOM node mounted across a keystroke-driven refetch cycle", () => {
    mockQueryResults({ results: [], isLoadingInitial: true });
    const { rerender } = renderWithProviders(<Results color={undefined} />);
    const spinner = screen.getByRole("progressbar", { hidden: true });

    mockQueryResults({ results: albums, isLoadingInitial: false });
    rerender(<Results color={undefined} />);
    expect(screen.getByRole("progressbar", { hidden: true })).toBe(spinner);

    mockQueryResults({ results: [], isLoadingInitial: true });
    rerender(<Results color={undefined} />);
    expect(screen.getByRole("progressbar", { hidden: true })).toBe(spinner);

    mockQueryResults({ results: albums, isLoadingInitial: false });
    rerender(<Results color={undefined} />);
    expect(screen.getByRole("progressbar", { hidden: true })).toBe(spinner);
  });

  it("hides the overlay once results land and shows it while loading", () => {
    mockQueryResults({ results: [], isLoadingInitial: true });
    const { rerender } = renderWithProviders(<Results color={undefined} />);
    expect(getComputedStyle(screen.getByTestId("catalog-loading-overlay")).visibility).toBe(
      "visible",
    );

    mockQueryResults({ results: albums, isLoadingInitial: false });
    rerender(<Results color={undefined} />);
    expect(getComputedStyle(screen.getByTestId("catalog-loading-overlay")).visibility).toBe(
      "hidden",
    );
  });

  it("renders the fetched rows once loading completes", () => {
    mockQueryResults({ results: albums, isLoadingInitial: false });
    renderWithProviders(<Results color={undefined} />);

    expect(screen.getByText("DOGA")).toBeDefined();
    expect(screen.getByText("Cover Story")).toBeDefined();
  });

  it("keeps the same spinner DOM node mounted across a refetch cycle on mobile", () => {
    mockUseMediaQuery.mockReturnValue(true);
    mockQueryResults({ results: [], isLoadingInitial: true });
    const { rerender } = renderWithProviders(<Results color={undefined} />);
    const spinner = screen.getByRole("progressbar", { hidden: true });

    mockQueryResults({ results: albums, isLoadingInitial: false });
    rerender(<Results color={undefined} />);
    expect(screen.getByRole("progressbar", { hidden: true })).toBe(spinner);

    mockQueryResults({ results: [], isLoadingInitial: true });
    rerender(<Results color={undefined} />);
    expect(screen.getByRole("progressbar", { hidden: true })).toBe(spinner);
  });
});
