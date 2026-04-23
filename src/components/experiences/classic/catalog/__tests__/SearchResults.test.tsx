import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";
import { renderWithProviders } from "@/lib/test-utils/render";

const mockSearchCatalogQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("searchString=test"),
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useSearchCatalogQuery: (...args: unknown[]) => mockSearchCatalogQuery(...args),
  };
});

import SearchResults from "../SearchResults";

describe("Classic SearchResults Various Artists display", () => {
  it("should display 'Various Artists' when album_artist is set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Autechre", lettercode: "EL", numbercode: 5 }),
      album_artist: "Autechre",
      title: "All Tomorrow's Parties",
    });
    mockSearchCatalogQuery.mockReturnValue({
      data: [album],
      isLoading: false,
      error: undefined,
    });

    renderWithProviders(<SearchResults />);

    expect(screen.getByText("Various Artists")).toBeDefined();
    expect(screen.queryByText("Autechre")).toBeNull();
  });

  it("should display artist name normally when album_artist is not set", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87 }),
    });
    mockSearchCatalogQuery.mockReturnValue({
      data: [album],
      isLoading: false,
      error: undefined,
    });

    renderWithProviders(<SearchResults />);

    expect(screen.getByText("Stereolab")).toBeDefined();
    expect(screen.queryByText("Various Artists")).toBeNull();
  });
});
