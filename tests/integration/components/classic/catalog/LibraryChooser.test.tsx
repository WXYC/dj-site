import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import {
  createTestAlbum,
  createTestArtist,
  renderWithProviders,
  setFieldValue,
} from "@/tests/helpers";

// The real better-auth client installs listeners whose teardown is deferred a
// second past the last subscriber; a short file finishes inside that second.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

const mockSearchCatalogQuery = vi.fn();
vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useSearchCatalogQuery: (...args: unknown[]) => mockSearchCatalogQuery(...args),
  };
});

let capturedOnMultiMatch: ((result: unknown) => void) | undefined;
vi.mock("@/src/components/experiences/classic/catalog/ArtistSearchForm", () => ({
  default: ({ onMultiMatch }: { onMultiMatch: (result: unknown) => void }) => {
    capturedOnMultiMatch = onMultiMatch;
    return <div data-testid="artist-search-form" />;
  },
}));
vi.mock("@/src/components/experiences/classic/catalog/NewArtistForm", () => ({
  default: () => <div data-testid="new-artist-form" />,
}));
vi.mock("@/src/components/experiences/classic/catalog/MultipleArtistsDisplay", () => ({
  default: ({ onChooseAgain }: { onChooseAgain: () => void }) => (
    <div data-testid="multiple-artists-display">
      <button type="button" onClick={onChooseAgain}>
        back
      </button>
    </div>
  ),
}));

import LibraryChooser from "@/src/components/experiences/classic/catalog/LibraryChooser";

const MULTI_MATCH = {
  genreName: "Rock",
  codeLetters: "V/A",
  codeNumber: 0,
  artists: [
    { id: 1, artist_name: "Various Artists - Rock - A", code_letters: "V/A", code_number: 0, genre_id: 11 },
    { id: 2, artist_name: "Various Artists - Rock - B", code_letters: "V/A", code_number: 0, genre_id: 11 },
  ],
};

describe("classic LibraryChooser — chooseLibraryCodeOrArtist.jsp + multipleArtistsDisplay.jsp, one URL", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams("");
    mockSearchCatalogQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    });
  });

  it("renders both chooser forms by default", () => {
    renderWithProviders(<LibraryChooser />);

    expect(screen.getByTestId("artist-search-form")).toBeInTheDocument();
    expect(screen.getByTestId("new-artist-form")).toBeInTheDocument();
    expect(screen.queryByTestId("multiple-artists-display")).not.toBeInTheDocument();
  });

  // An earlier chooser slice deferred this block as a divergence from the
  // JSP, because its destination didn't exist yet; the classic rotation
  // list slice builds that destination (the Awaiting Cataloging facet) and
  // restores it here, closing that divergence.
  it("restores the chooser's rotation block, above the <hr>, linking to the Awaiting Cataloging facet", () => {
    const { container } = renderWithProviders(<LibraryChooser />);

    expect(screen.getByText(/Import a killed rotation release into the library/i)).toBeInTheDocument();
    const rotationLink = screen.getByRole("link", { name: /View Rotation Releases Awaiting Cataloging/i });
    expect(rotationLink).toHaveAttribute("href", "/dashboard/rotation?status=uncataloged");

    // JSP order: rotation block, <hr>, artistSearchForm, newArtistForm --
    // with no <hr> between the two forms. Measured from the rotation block
    // rather than from the start of the document, so the free-text search
    // mounted above it cannot satisfy the JSP's own rule.
    const html = container.innerHTML;
    const rotationBlockIndex = html.indexOf("Import a killed rotation release");
    const hrIndex = html.indexOf("<hr", rotationBlockIndex);
    const artistFormIndex = html.indexOf('data-testid="artist-search-form"');
    const newArtistFormIndex = html.indexOf('data-testid="new-artist-form"');

    expect(rotationBlockIndex).toBeGreaterThanOrEqual(0);
    expect(hrIndex).toBeGreaterThan(rotationBlockIndex);
    expect(artistFormIndex).toBeGreaterThan(hrIndex);
    expect(newArtistFormIndex).toBeGreaterThan(artistFormIndex);
    expect(html.slice(artistFormIndex, newArtistFormIndex)).not.toContain("<hr");
  });

  it("replaces both forms with the disambiguation screen on a multi-match, matching the JSP's full-page swap", async () => {
    const { user } = renderWithProviders(<LibraryChooser />);
    expect(capturedOnMultiMatch).toBeDefined();

    act(() => capturedOnMultiMatch!(MULTI_MATCH));

    expect(await screen.findByTestId("multiple-artists-display")).toBeInTheDocument();
    expect(screen.queryByTestId("artist-search-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("new-artist-form")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "back" }));

    expect(await screen.findByTestId("artist-search-form")).toBeInTheDocument();
    expect(screen.getByTestId("new-artist-form")).toBeInTheDocument();
  });
});

/**
 * `chooseLibraryCodeOrArtist.jsp` offers no free-text search at all, so this
 * block covers an addition to the screen rather than parity with it.
 */
describe("classic LibraryChooser — free-text library search", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams("");
    mockSearchCatalogQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    });
  });

  it("offers the search without displacing the call-number form", () => {
    renderWithProviders(<LibraryChooser />);

    expect(screen.getByPlaceholderText(/type to search .*releases/i)).toBeInTheDocument();
    expect(screen.getByTestId("artist-search-form")).toBeInTheDocument();
  });

  describe("query round-trip", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("writes the query back to the chooser's own URL", () => {
      renderWithProviders(<LibraryChooser />);

      setFieldValue(screen.getByPlaceholderText(/type to search .*releases/i), "polvo");
      vi.advanceTimersByTime(300);

      expect(mockReplace).toHaveBeenCalledWith("/dashboard/library?searchString=polvo");
    });
  });

  it("sends an artist result to the card that can add a release", () => {
    // The page is MD-gated, so the result row never routes to the read-only
    // artist card -- reaching a release-adding card is the point of the search.
    mockSearchParams = new URLSearchParams("searchString=fust");
    mockSearchCatalogQuery.mockReturnValue({
      data: [
        createTestAlbum({
          id: 9200,
          title: "Tri Repetae",
          artist: createTestArtist({ id: 19516, name: "Fust", lettercode: "RO", numbercode: 12 }),
        }),
      ],
      isLoading: false,
      error: undefined,
    });

    renderWithProviders(<LibraryChooser />);

    expect(screen.getByRole("link", { name: "Fust" })).toHaveAttribute(
      "href",
      "/dashboard/library/artist/19516",
    );
  });
});
