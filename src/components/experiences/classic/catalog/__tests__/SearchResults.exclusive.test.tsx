import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestStore,
} from "@/lib/test-utils/render";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";
import { catalogSlice } from "@/lib/features/catalog/frontend";

const mockSearchCatalogQuery = vi.fn();
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams("");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/features/catalog/api")
  >();
  return {
    ...actual,
    useSearchCatalogQuery: (...args: unknown[]) =>
      mockSearchCatalogQuery(...args),
  };
});

import SearchResults from "../SearchResults";

beforeEach(() => {
  mockSearchCatalogQuery.mockReset();
  mockReplace.mockReset();
  Array.from(mockSearchParams.keys()).forEach((k) =>
    mockSearchParams.delete(k)
  );
});

function storeWithExclusive() {
  const store = createTestStore();
  store.dispatch(catalogSlice.actions.setExclusiveFilter(true));
  return store;
}

describe("Classic catalog SearchResults — Exclusive filter", () => {
  it("does NOT fire the search when neither query nor exclusive filter is set", () => {
    mockSearchCatalogQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    });
    renderWithProviders(<SearchResults />);
    const [, options] = mockSearchCatalogQuery.mock.calls[0] ?? [];
    expect(options?.skip).toBe(true);
  });

  it("fires the search with on_streaming=false when exclusive filter is on (no query)", () => {
    const album = createTestAlbum({
      artist: createTestArtist({
        name: "Stereolab",
        lettercode: "RO",
        numbercode: 87,
      }),
      title: "Aluminum Tunes",
      on_streaming: false,
    });
    mockSearchCatalogQuery.mockReturnValue({
      data: [album],
      isLoading: false,
      error: undefined,
    });
    renderWithProviders(<SearchResults />, { store: storeWithExclusive() });
    const [params, options] = mockSearchCatalogQuery.mock.calls.at(-1) ?? [];
    expect(params).toMatchObject({ on_streaming: false });
    expect(options?.skip).toBe(false);
  });

  it("renders the Exclusive filter chip when the filter is on", () => {
    mockSearchCatalogQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    renderWithProviders(<SearchResults />, { store: storeWithExclusive() });
    expect(screen.getByTestId("classic-filter-chip-exclusive")).toBeDefined();
  });

  it("does NOT render the Exclusive filter chip when the filter is off", () => {
    mockSearchCatalogQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    renderWithProviders(<SearchResults />);
    expect(
      screen.queryByTestId("classic-filter-chip-exclusive")
    ).toBeNull();
  });

  it("clicking the chip dismiss clears the exclusive filter", async () => {
    mockSearchCatalogQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const store = storeWithExclusive();
    const { user } = renderWithProviders(<SearchResults />, { store });
    await user.click(
      screen.getByRole("button", { name: /remove exclusive filter/i })
    );
    expect(
      catalogSlice.selectors.getExclusiveFilter(store.getState())
    ).toBe(false);
  });

  it("clicking the chip dismiss strips ?exclusive=true from the URL", async () => {
    mockSearchCatalogQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    mockSearchParams.set("exclusive", "true");
    const store = storeWithExclusive();
    const { user } = renderWithProviders(<SearchResults />, { store });
    await user.click(
      screen.getByRole("button", { name: /remove exclusive filter/i })
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const replacedUrl = mockReplace.mock.calls[0][0] as string;
    expect(replacedUrl).not.toContain("exclusive=true");
    expect(replacedUrl).toBe("/dashboard/catalog");
  });

  it("chip dismiss preserves other params (e.g. searchString)", async () => {
    mockSearchCatalogQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    mockSearchParams.set("exclusive", "true");
    mockSearchParams.set("searchString", "polvo");
    const store = storeWithExclusive();
    const { user } = renderWithProviders(<SearchResults />, { store });
    await user.click(
      screen.getByRole("button", { name: /remove exclusive filter/i })
    );
    const replacedUrl = mockReplace.mock.calls[0][0] as string;
    expect(replacedUrl).toContain("searchString=polvo");
    expect(replacedUrl).not.toContain("exclusive=true");
  });
});
