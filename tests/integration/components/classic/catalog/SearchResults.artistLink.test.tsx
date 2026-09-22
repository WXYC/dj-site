import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist, renderWithProviders } from "@/tests/helpers";

const mockSearchCatalogQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("searchString=fust"),
  usePathname: () => "/dashboard/catalog",
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useSearchCatalogQuery: (...args: unknown[]) => mockSearchCatalogQuery(...args),
  };
});

import SearchResults from "@/src/components/experiences/classic/catalog/SearchResults";

function renderRow(
  artist: Parameters<typeof createTestArtist>[0],
  { canModify }: { canModify: boolean },
) {
  mockSearchCatalogQuery.mockReturnValue({
    data: [createTestAlbum({ id: 9200, title: "Tri Repetae", artist: createTestArtist(artist) })],
    isLoading: false,
    error: undefined,
  });

  renderWithProviders(<SearchResults canModify={canModify} />);
}

/**
 * `LibraryCatalogServlet.goToArtistModifyCard` (`:152`) picks the artist card
 * from the viewer's authority, not from the `mode=view` the row's href carries
 * — `ArtistViewServlet` never reads that parameter. An admin gets
 * `libraryAdmin/artistCardModify.jsp`, which carries the "Add a Library
 * Release for This Artist" form (`artistCardModify.jsp:86`); everyone else
 * gets the read-only `lucene/artistCardDisplay.jsp`, which has no add form at
 * all. Landing a librarian on the read-only card costs him the one action the
 * search was the way to reach.
 */
describe("Classic SearchResults artist link — authority decides the card", () => {
  it("sends a viewer with modify authority to the card that can add a release", () => {
    renderRow({ id: 19516, name: "Fust", lettercode: "RO", numbercode: 12 }, { canModify: true });

    expect(screen.getByRole("link", { name: "Fust" }).getAttribute("href")).toBe(
      "/dashboard/library/artist/19516",
    );
  });

  it("keeps a viewer without modify authority on the read-only view card", () => {
    renderRow({ id: 19516, name: "Fust", lettercode: "RO", numbercode: 12 }, { canModify: false });

    expect(screen.getByRole("link", { name: "Fust" }).getAttribute("href")).toBe(
      "/dashboard/library/artist/19516/view",
    );
  });

  // `artistCardHref` routes on `code_letters`, so the compilation bucket has to
  // reach the bucket card rather than the ordinary artist card — the JSP's
  // admin branch makes the same split at `:158`.
  it("sends a modify-authority viewer to the bucket card for a compilation row", () => {
    renderRow(
      { id: 19517, name: "Various Artists", lettercode: "V/A", numbercode: 3 },
      { canModify: true },
    );

    expect(screen.getByRole("link", { name: /various artists/i }).getAttribute("href")).toBe(
      "/dashboard/library/various/19517",
    );
  });

  // The JSP's non-admin branch (`:168`) forwards every artist to the one
  // display card without distinguishing a bucket, and there is no read-only
  // bucket screen here to route to either.
  it("keeps a compilation row on the ordinary view card without modify authority", () => {
    renderRow(
      { id: 19517, name: "Various Artists", lettercode: "V/A", numbercode: 3 },
      { canModify: false },
    );

    expect(screen.getByRole("link", { name: /various artists/i }).getAttribute("href")).toBe(
      "/dashboard/library/artist/19517/view",
    );
  });

  /**
   * An `artists` row is not one band. Two acts filed under the same name in
   * different genres share it, and the crossreference is unique on the
   * (artist, genre) pair — so the artist id alone does not identify a card,
   * and the card read falls back to the lowest-genre membership when no genre
   * is named. The search row is where a librarian enters, and it is the row
   * that knows which of the two it is: its own call number was keyed on that
   * genre.
   */
  it("scopes the modify link to the shelf the row was filed under", () => {
    renderRow(
      { id: 431, name: "Isis", lettercode: "IS", numbercode: 13, genre: "Rock", genre_id: 11 },
      { canModify: true },
    );

    expect(screen.getByRole("link", { name: "Isis" }).getAttribute("href")).toBe(
      "/dashboard/library/artist/431?genre_id=11",
    );
  });

  it("scopes the read-only link to the same shelf", () => {
    renderRow(
      { id: 431, name: "Isis", lettercode: "IS", numbercode: 1, genre: "Hiphop", genre_id: 4 },
      { canModify: false },
    );

    expect(screen.getByRole("link", { name: "Isis" }).getAttribute("href")).toBe(
      "/dashboard/library/artist/431/view?genre_id=4",
    );
  });

  /**
   * The bucket card is keyed on the compilation artist alone — a bucket spans
   * genres by construction, so scoping it to one would hide releases that
   * belong on it.
   */
  it("leaves the compilation bucket unscoped even when the row carries a genre", () => {
    renderRow(
      { id: 19517, name: "Various Artists", lettercode: "V/A", numbercode: 3, genre_id: 11 },
      { canModify: true },
    );

    expect(screen.getByRole("link", { name: /various artists/i }).getAttribute("href")).toBe(
      "/dashboard/library/various/19517",
    );
  });

  /**
   * A response from a Backend that predates the genre-bearing search row has
   * no id to send. The link must stay valid and fall back to the unscoped
   * card rather than emitting `?genre_id=undefined`.
   */
  it.each([true, false])(
    "omits the parameter entirely when the row carries no genre id (canModify=%s)",
    (canModify) => {
      renderRow({ id: 19516, name: "Fust", lettercode: "RO", numbercode: 12 }, { canModify });

      const href = screen.getByRole("link", { name: "Fust" }).getAttribute("href");
      expect(href).not.toContain("genre_id");
      expect(href).toBe(canModify ? "/dashboard/library/artist/19516" : "/dashboard/library/artist/19516/view");
    },
  );

  it.each([true, false])(
    "leaves the artist as plain text when the row carries no artist id (canModify=%s)",
    (canModify) => {
      renderRow({ id: undefined, name: "Fust", lettercode: "RO", numbercode: 12 }, { canModify });

      expect(screen.queryByRole("link", { name: "Fust" })).toBeNull();
      expect(screen.getByText("Fust")).toBeDefined();
    },
  );
});
