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

// `usePathname` is needed because the chooser renders the free-text search
// above the swap, and SearchForm/SearchResults read the screen they are mounted
// on from the router rather than from a prop.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/library",
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
  // Both exits are stubbed, because the screen has two and they mean opposite
  // things: `back` abandons the list, `choose` resolves it.
  default: ({
    onChooseAgain,
    onChoose,
  }: {
    onChooseAgain: () => void;
    onChoose?: (artist: { id: number }, index: number) => void;
  }) => (
    <div data-testid="multiple-artists-display">
      <button type="button" onClick={onChooseAgain}>
        back
      </button>
      <button type="button" onClick={() => onChoose?.({ id: 4 }, 3)}>
        choose
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

/**
 * The other arrival on this screen: a call-letters browse, which has no single
 * number and is not evidence of anything colliding.
 */
const BUCKET_BROWSE = {
  genreName: "Rock",
  codeLetters: "MA",
  codeNumber: null,
  artists: [
    { id: 40, artist_name: "Magnetic Fields", code_letters: "MA", code_number: 3, genre_id: 11 },
    { id: 41, artist_name: "Mary Lattimore", code_letters: "MA", code_number: 11, genre_id: 11 },
  ],
};

const capturesNamed = (event: string) =>
  mockSafeCapture.mock.calls.filter((call) => call[0] === event);

/**
 * The disambiguation screen swaps in behind the chooser's own URL, so a visit
 * to it produces no pageview. These events are the only trace that landing on a
 * 27-owner list, reading it, and leaving happened at all.
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
      browse: false,
    });
  });

  // Two searches land on this screen and they mean opposite things: a
  // contested code is evidence that codes collide, a browse is a librarian
  // reading a shelf section. Without the flag a raw count of arrivals reads
  // as collisions and is inflated by every browse; with it, the property is
  // false rather than a number the browse never had.
  it("marks a call-letters browse apart from a contested code", async () => {
    renderWithProviders(<LibraryChooser />);

    act(() => capturedOnMultiMatch!(BUCKET_BROWSE));

    expect(await screen.findByTestId("multiple-artists-display")).toBeInTheDocument();
    expect(capturesNamed("library_multi_match_shown")[0][1]).toMatchObject({
      owner_count: 2,
      code_letters: "MA",
      code_number: null,
      browse: true,
    });
  });

  // The exits are shared by both arrivals, so they carry the same flag: a
  // browse's ending attributed to the collision population would break the
  // pairing the two halves exist for.
  it("carries the arrival's arm onto the exits it shares", async () => {
    const { user } = renderWithProviders(<LibraryChooser />);
    act(() => capturedOnMultiMatch!(BUCKET_BROWSE));
    await screen.findByTestId("multiple-artists-display");

    await user.click(screen.getByRole("button", { name: "choose" }));

    expect(capturesNamed("library_multi_match_resolved")[0][1]).toMatchObject({
      code_letters: "MA",
      code_number: null,
      browse: true,
      owner_index: 3,
    });
  });

  // Without a leaving half, the arrival is a trace with no end, and how long a
  // librarian spent on an unaddressable list is unanswerable.
  it("records leaving it again", async () => {
    const { user } = renderWithProviders(<LibraryChooser />);
    act(() => capturedOnMultiMatch!(MULTI_MATCH));
    await screen.findByTestId("multiple-artists-display");

    await user.click(screen.getByRole("button", { name: "back" }));

    await screen.findByTestId("artist-search-form");
    expect(capturesNamed("library_multi_match_dismissed")).toHaveLength(1);
    // The payload, not just the count: a regression that emitted this with an
    // empty body, or read a stale closure's triple, passes a length check.
    expect(capturesNamed("library_multi_match_dismissed")[0][1]).toMatchObject({
      owner_count: 27,
      code_letters: "V/A",
      code_number: 0,
    });
  });

  /**
   * The successful exit. A row link is a plain navigation, so it never runs
   * through the state that produces DISMISSED -- leaving it uninstrumented
   * would make SHOWN minus DISMISSED read as a permanent leak, and would
   * restrict the dwell measurement to abandonments, which is the opposite of
   * the population worth measuring.
   */
  it("records choosing an owner, with its position in the list", async () => {
    const { user } = renderWithProviders(<LibraryChooser />);
    act(() => capturedOnMultiMatch!(MULTI_MATCH));
    await screen.findByTestId("multiple-artists-display");

    await user.click(screen.getByRole("button", { name: "choose" }));

    expect(capturesNamed("library_multi_match_resolved")).toHaveLength(1);
    expect(capturesNamed("library_multi_match_resolved")[0][1]).toMatchObject({
      owner_count: 27,
      code_letters: "V/A",
      code_number: 0,
      owner_index: 3,
    });
    // Resolving is not abandoning; the two endings must not both fire.
    expect(capturesNamed("library_multi_match_dismissed")).toHaveLength(0);
  });

  it("emits nothing while the chooser is merely on screen", () => {
    renderWithProviders(<LibraryChooser />);

    expect(capturesNamed("library_multi_match_shown")).toHaveLength(0);
    expect(capturesNamed("library_multi_match_dismissed")).toHaveLength(0);
    expect(capturesNamed("library_multi_match_resolved")).toHaveLength(0);
  });
});
