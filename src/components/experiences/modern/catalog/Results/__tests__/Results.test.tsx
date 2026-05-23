import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";

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

vi.mock("@/src/hooks/binHooks", () => ({
  useAddToBin: () => ({ addToBin: vi.fn(), loading: false }),
  useRemoveFromBin: () => ({ removeFromBin: vi.fn(), loading: false }),
  useBin: () => ({ bin: [], loading: false, isSuccess: true, isError: false }),
}));

const hookState = {
  search: {
    selected: [] as number[],
    setSelection: vi.fn(),
    hasActiveQuery: false,
    clearSelection: vi.fn(),
  },
  results: {
    results: [] as ReturnType<typeof createTestAlbum>[],
    total: 0,
    isLoading: false,
    isError: false,
    hasMore: false,
    loadNextPage: vi.fn(),
  },
};

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogQuerySearch: () => hookState.search,
  useCatalogQueryResults: () => hookState.results,
}));

import Results from "../Results";

function setHookState(overrides: {
  hasActiveQuery?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  results?: ReturnType<typeof createTestAlbum>[];
  total?: number;
}) {
  hookState.search.hasActiveQuery = overrides.hasActiveQuery ?? false;
  hookState.results.isLoading = overrides.isLoading ?? false;
  hookState.results.isError = overrides.isError ?? false;
  hookState.results.results = overrides.results ?? [];
  hookState.results.total = overrides.total ?? 0;
}

describe("Catalog Results status line", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHookState({});
  });

  it("renders 'Searching...' while a search is in flight", () => {
    setHookState({ hasActiveQuery: true, isLoading: true });
    renderWithProviders(<Results color="primary" />);
    expect(screen.getByText("Searching...")).toBeDefined();
  });

  it("renders 'Found N results' once results land (plural)", () => {
    const albums = [
      createTestAlbum({
        title: "DOGA",
        artist: createTestArtist({ name: "Juana Molina", lettercode: "RO", numbercode: 42 }),
      }),
      createTestAlbum({
        title: "Moon Pix",
        artist: createTestArtist({ name: "Cat Power", lettercode: "RO", numbercode: 23 }),
      }),
    ];
    setHookState({ hasActiveQuery: true, isLoading: false, results: albums, total: 2 });
    renderWithProviders(<Results color="primary" />);
    expect(screen.getByText("Found 2 results")).toBeDefined();
  });

  it("renders 'Found 1 result' (singular) when total is 1", () => {
    const albums = [
      createTestAlbum({
        title: "On Your Own Love Again",
        artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 112 }),
      }),
    ];
    setHookState({ hasActiveQuery: true, isLoading: false, results: albums, total: 1 });
    renderWithProviders(<Results color="primary" />);
    expect(screen.getByText("Found 1 result")).toBeDefined();
  });

  it("renders 'No results found' when the search completes with zero matches", () => {
    setHookState({ hasActiveQuery: true, isLoading: false, results: [], total: 0 });
    renderWithProviders(<Results color="primary" />);
    expect(screen.getByText("No results found")).toBeDefined();
  });

  it("renders an error message when the query errors", () => {
    setHookState({
      hasActiveQuery: true,
      isLoading: false,
      isError: true,
      results: [],
      total: 0,
    });
    renderWithProviders(<Results color="primary" />);
    expect(screen.getByText("Search failed. Please try again.")).toBeDefined();
    expect(screen.queryByText("No results found")).toBeNull();
  });

  it("renders no status line at all when there is no active query", () => {
    setHookState({ hasActiveQuery: false });
    renderWithProviders(<Results color="primary" />);
    expect(screen.queryByText("Searching...")).toBeNull();
    expect(screen.queryByText("No results found")).toBeNull();
    expect(screen.queryByText(/^Found /)).toBeNull();
  });
});
