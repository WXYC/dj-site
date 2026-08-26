import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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
  it("renders both chooser forms by default", () => {
    renderWithProviders(<LibraryChooser />);

    expect(screen.getByTestId("artist-search-form")).toBeInTheDocument();
    expect(screen.getByTestId("new-artist-form")).toBeInTheDocument();
    expect(screen.queryByTestId("multiple-artists-display")).not.toBeInTheDocument();
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
