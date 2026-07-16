import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

const mockSearchCatalogQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
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

describe("Classic SearchResults EXCLUSIVE capsule", () => {
  it("should render the EXCLUSIVE capsule on rows where on_streaming === false", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Chuquimamani-Condori", lettercode: "EL", numbercode: 12 }),
      title: "Edits",
      on_streaming: false,
    });
    mockSearchCatalogQuery.mockReturnValue({
      data: [album],
      isLoading: false,
      error: undefined,
    });

    renderWithProviders(<SearchResults />);

    expect(screen.getByText("EXCLUSIVE")).toBeDefined();
  });

  it("should NOT render the EXCLUSIVE capsule on rows where on_streaming === true", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Juana Molina", lettercode: "RO", numbercode: 34 }),
      title: "DOGA",
      on_streaming: true,
    });
    mockSearchCatalogQuery.mockReturnValue({
      data: [album],
      isLoading: false,
      error: undefined,
    });

    renderWithProviders(<SearchResults />);

    expect(screen.queryByText("EXCLUSIVE")).toBeNull();
  });

  it("should NOT render the EXCLUSIVE capsule on rows where on_streaming === undefined (unknown != off-streaming)", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 55 }),
      title: "On Your Own Love Again",
      // on_streaming intentionally undefined — createTestAlbum's default
    });
    mockSearchCatalogQuery.mockReturnValue({
      data: [album],
      isLoading: false,
      error: undefined,
    });

    renderWithProviders(<SearchResults />);

    expect(screen.queryByText("EXCLUSIVE")).toBeNull();
  });
});

// Regression: a library-unlinked / LML-proxy catalog row can arrive with no
// `artist` object. The Artist column (`result.artist.name`) and the Library
// Code column (`result.artist.lettercode`) dereferenced it unguarded, so one
// such row threw mid-render and the only error boundary (app/global-error)
// white-screened the whole page. Same null-artist class guarded for the Modern
// experience in #778 (search results). Pair the null-artist row with a normal
// one so the table renders a realistic multi-row list.
describe("Classic SearchResults — null artist (regression)", () => {
  it("does not throw and shows a fallback when a result row has a null artist", () => {
    const nullArtistRow = {
      ...createTestAlbum({ id: 9001, title: "Untitled" }),
      artist: null,
    } as unknown as ReturnType<typeof createTestAlbum>;
    const goodRow = createTestAlbum({
      id: 9002,
      title: "DOGA",
      artist: createTestArtist({
        name: "Juana Molina",
        lettercode: "RO",
        numbercode: 34,
      }),
    });
    mockSearchCatalogQuery.mockReturnValue({
      data: [nullArtistRow, goodRow],
      isLoading: false,
      error: undefined,
    });

    expect(() => renderWithProviders(<SearchResults />)).not.toThrow();
    // The normal row still renders its artist; the null-artist row shows the
    // "Unknown" fallback instead of crashing.
    expect(screen.getByText("Juana Molina")).toBeDefined();
    expect(screen.getByText("Unknown")).toBeDefined();
  });
});
