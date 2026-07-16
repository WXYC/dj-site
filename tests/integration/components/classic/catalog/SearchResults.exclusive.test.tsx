import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";

const mockSearchCatalogQuery = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams("");

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

import SearchResults from "@/src/components/experiences/classic/catalog/SearchResults";

beforeEach(() => {
  mockSearchCatalogQuery.mockReset();
  mockReplace.mockReset();
  mockSearchParams = new URLSearchParams("");
});

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

  it("fires the search with on_streaming=false when ?exclusive=true is in the URL (no query)", () => {
    mockSearchParams = new URLSearchParams("exclusive=true");
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
    renderWithProviders(<SearchResults />);
    const [params, options] = mockSearchCatalogQuery.mock.calls.at(-1) ?? [];
    expect(params).toMatchObject({ on_streaming: false });
    expect(options?.skip).toBe(false);
  });

  it("renders the Exclusive filter chip when ?exclusive=true is in the URL", () => {
    mockSearchParams = new URLSearchParams("exclusive=true");
    mockSearchCatalogQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    renderWithProviders(<SearchResults />);
    expect(screen.getByTestId("classic-filter-chip-exclusive")).toBeDefined();
  });

  it("does NOT render the Exclusive filter chip when ?exclusive is absent", () => {
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

  it("clicking the chip dismiss strips ?exclusive=true from the URL", async () => {
    mockSearchParams = new URLSearchParams("exclusive=true");
    mockSearchCatalogQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const { user } = renderWithProviders(<SearchResults />);
    await user.click(
      screen.getByRole("button", { name: /remove exclusive filter/i })
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const replacedUrl = mockReplace.mock.calls[0][0] as string;
    expect(replacedUrl).not.toContain("exclusive=true");
    expect(replacedUrl).toBe("/dashboard/catalog");
  });

  it("chip dismiss preserves other params (e.g. searchString)", async () => {
    mockSearchParams = new URLSearchParams("exclusive=true&searchString=polvo");
    mockSearchCatalogQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const { user } = renderWithProviders(<SearchResults />);
    await user.click(
      screen.getByRole("button", { name: /remove exclusive filter/i })
    );
    const replacedUrl = mockReplace.mock.calls[0][0] as string;
    expect(replacedUrl).toContain("searchString=polvo");
    expect(replacedUrl).not.toContain("exclusive=true");
  });
});
