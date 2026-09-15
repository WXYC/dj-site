import { describe, it, expect, beforeEach, vi } from "vitest";
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockSafeCapture = vi.fn();
vi.mock("@/lib/posthog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/posthog")>();
  return { ...actual, safeCapture: (...args: unknown[]) => mockSafeCapture(...args) };
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
  artists: Array.from({ length: 27 }, (_, i) => ({
    id: i + 1,
    artist_name: `Various Artists - Rock - ${i}`,
    code_letters: "V/A",
    code_number: 0,
    genre_id: 11,
  })),
};

const capturesNamed = (event: string) =>
  mockSafeCapture.mock.calls.filter((call) => call[0] === event);

/**
 * The disambiguation screen swaps in behind the chooser's own URL, so a visit
 * to it produces no pageview and, before this, no event of any kind: the whole
 * episode of landing on a 27-owner list, reading it, and going back was
 * invisible to every instrument.
 */
describe("classic LibraryChooser — disambiguation screen telemetry", () => {
  beforeEach(() => {
    mockSafeCapture.mockClear();
    capturedOnMultiMatch = undefined;
  });

  it("records reaching the screen, with the size of the list shown", async () => {
    renderWithProviders(<LibraryChooser />);
    expect(capturedOnMultiMatch).toBeDefined();

    act(() => capturedOnMultiMatch!(MULTI_MATCH));

    expect(await screen.findByTestId("multiple-artists-display")).toBeInTheDocument();
    expect(capturesNamed("library_multi_match_shown")).toHaveLength(1);
    expect(capturesNamed("library_multi_match_shown")[0][1]).toMatchObject({
      owner_count: 27,
      code_letters: "V/A",
      code_number: 0,
    });
  });

  // Without the leaving half, the screen's arrival is a trace with no end: how
  // long a librarian spent on an unaddressable list is the question the silent
  // window in the original report could not answer.
  it("records leaving it again", async () => {
    const { user } = renderWithProviders(<LibraryChooser />);
    act(() => capturedOnMultiMatch!(MULTI_MATCH));
    await screen.findByTestId("multiple-artists-display");

    await user.click(screen.getByRole("button", { name: "back" }));

    await screen.findByTestId("artist-search-form");
    expect(capturesNamed("library_multi_match_dismissed")).toHaveLength(1);
  });

  it("emits nothing while the chooser is merely on screen", () => {
    renderWithProviders(<LibraryChooser />);

    expect(capturesNamed("library_multi_match_shown")).toHaveLength(0);
    expect(capturesNamed("library_multi_match_dismissed")).toHaveLength(0);
  });
});
