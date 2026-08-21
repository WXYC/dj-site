import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

const mockSearchCatalogQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("searchString=autechre"),
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useSearchCatalogQuery: (...args: unknown[]) => mockSearchCatalogQuery(...args),
  };
});

import SearchResults from "@/src/components/experiences/classic/catalog/SearchResults";

/**
 * The release title is the row's link to the album card, mirroring
 * `card-catalog-search`'s `<a href="libraryRelease?id=…">`. Rows whose id was
 * synthesized client-side (always negative — a hash of the row's content, or a
 * contentless counter) have no Backend `library.id` to route to and must stay
 * plain text rather than link to a URL that cannot resolve.
 */
describe("Classic SearchResults release link", () => {
  it("links the release title to the classic release view", () => {
    const album = createTestAlbum({
      id: 9200,
      artist: createTestArtist({ name: "Autechre", lettercode: "AU", numbercode: 3 }),
      title: "Tri Repetae",
    });
    mockSearchCatalogQuery.mockReturnValue({ data: [album], isLoading: false, error: undefined });

    renderWithProviders(<SearchResults />);

    const link = screen.getByRole("link", { name: "Tri Repetae" });
    expect(link.getAttribute("href")).toBe("/dashboard/library/release/9200");
  });

  it("leaves the title as plain text when the row's id was synthesized", () => {
    const album = createTestAlbum({
      id: -128374,
      artist: createTestArtist({ name: "Autechre", lettercode: "AU", numbercode: 3 }),
      title: "Untracked Release",
    });
    mockSearchCatalogQuery.mockReturnValue({ data: [album], isLoading: false, error: undefined });

    renderWithProviders(<SearchResults />);

    expect(screen.getByText("Untracked Release")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Untracked Release" })).toBeNull();
  });

  it("links the artist name to the ungated view card", () => {
    const album = createTestAlbum({
      id: 9200,
      artist: createTestArtist({ name: "Autechre", lettercode: "AU", numbercode: 3, id: 19516 }),
      title: "Tri Repetae",
    });
    mockSearchCatalogQuery.mockReturnValue({ data: [album], isLoading: false, error: undefined });

    renderWithProviders(<SearchResults />);

    const link = screen.getByRole("link", { name: "Autechre" });
    expect(link.getAttribute("href")).toBe("/dashboard/library/artist/19516/view");
  });

  it("leaves the artist as plain text when the row carries no artist id", () => {
    const album = createTestAlbum({
      id: 9201,
      artist: createTestArtist({ name: "Autechre", lettercode: "AU", numbercode: 3, id: undefined }),
      title: "Amber",
    });
    mockSearchCatalogQuery.mockReturnValue({ data: [album], isLoading: false, error: undefined });

    renderWithProviders(<SearchResults />);

    expect(screen.queryByRole("link", { name: "Autechre" })).toBeNull();
    expect(screen.getByText("Autechre")).toBeDefined();
  });
});
