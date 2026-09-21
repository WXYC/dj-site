import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/helpers";
import type { ArtistCard } from "@/lib/features/catalog/types";

const mockGetArtistCardQuery = vi.fn();
const mockGetGenresQuery = vi.fn();
const mockDeleteArtist = vi.fn();

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetArtistCardQuery: (...args: unknown[]) => mockGetArtistCardQuery(...args),
    useGetGenresQuery: (...args: unknown[]) => mockGetGenresQuery(...args),
    useDeleteArtistMutation: () => [mockDeleteArtist, { isLoading: false }],
  };
});

import ArtistDeleteConfirm from "@/src/components/experiences/classic/catalog/ArtistDeleteConfirm";

const ARTIST_ID = 30021;
const GENRE_ID = 8;

// Chuquimamani-Condori -- WXYC-representative (Electronic; the org's own
// quick-reference fixture), not a mainstream placeholder.
const artist = (overrides: Partial<ArtistCard> = {}): ArtistCard => ({
  artist_id: ARTIST_ID,
  artist_name: "Chuquimamani-Condori",
  alphabetical_name: "Chuquimamani-Condori",
  genre_id: GENRE_ID,
  code_letters: "EL",
  code_artist_number: 15,
  release_count: 0,
  cross_reference_source_count: 0,
  cross_reference_target_count: 0,
  library_cross_reference_count: 0,
  compilation_credit_count: 0,
  ...overrides,
});

const loaded = (overrides: Partial<ArtistCard> = {}) =>
  mockGetArtistCardQuery.mockReturnValue({
    data: artist(overrides),
    isLoading: false,
    isError: false,
  });

// Mirrors `ReleaseDeleteConfirm.test.tsx`'s `playCounts()` / `playCountsLoading()`
// / `playCountsFailed()` trio: a `vi.fn` genres mock so each of the identity
// screen's genre-read states -- resolved, pending, failed, and a genuinely
// absent row -- can be arranged and pinned independently.
const genresLoaded = (rows: { id: number; genre_name: string }[] = [{ id: GENRE_ID, genre_name: "Electronic" }]) =>
  mockGetGenresQuery.mockReturnValue({ data: rows, isLoading: false, isError: false });

const genresLoading = () =>
  mockGetGenresQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });

const genresFailed = () =>
  mockGetGenresQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });

const rejectsWith = (error: unknown) => ({ unwrap: () => Promise.reject(error) });
const refusal = (status: number, data: unknown) =>
  rejectsWith({ deleteArtistError: { status, data } });

const clickDelete = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete The Artist" }));
};

describe("Classic ArtistDeleteConfirm — ArtistAdminServlet's delete branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    genresLoaded();
  });

  it("renders a one-click delete when all four gating counts are zero", () => {
    loaded();

    renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

    expect(screen.getByTestId("artist-delete-library-code").textContent).toBe("Electronic EL 15");
    expect(screen.getByTestId("artist-delete-name").textContent).toBe("Chuquimamani-Condori");
    expect(screen.getByTestId("artist-delete-status")).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete The Artist" })).not.toBeDisabled();
    expect(screen.getByRole("link", { name: "Cancel" })).toBeDefined();
  });

  it("renders nothing to press while the card is still loading", () => {
    mockGetArtistCardQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

    expect(screen.queryByRole("button", { name: "Delete The Artist" })).toBeNull();
  });

  it("refuses to offer a delete for a card it could not load", () => {
    mockGetArtistCardQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

    expect(screen.getByTestId("artist-delete-error")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Delete The Artist" })).toBeNull();
  });

  it.each([
    ["release_count", "3 releases"],
    ["cross_reference_source_count", "source of 3 cross-references"],
    ["cross_reference_target_count", "target of 3 cross-references"],
    ["library_cross_reference_count", "3 release cross-references"],
  ] as const)(
    "refuses when %s is non-zero, names the blocker, and offers no delete control",
    (key, fragment) => {
      loaded({ [key]: 3 } as Partial<ArtistCard>);

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

      const banner = screen.getByTestId("artist-delete-blocked");
      expect(banner.textContent).toContain(fragment);
      expect(banner.getAttribute("role")).toBe("alert");
      expect(screen.queryByRole("button", { name: "Delete The Artist" })).toBeNull();
      expect(screen.getByRole("link", { name: "Back to the Artist Card" })).toBeDefined();
    },
  );

  // The fail-closed path a future refactor is most likely to break: dj-site
  // and Backend-Service deploy independently, and a card served by a Backend
  // build predating these counts yields `undefined` for all four while
  // TypeScript still asserts `number`.
  it("falls to the blocked tier when the gating counts arrive as undefined", () => {
    mockGetArtistCardQuery.mockReturnValue({
      data: {
        ...artist(),
        release_count: undefined,
        cross_reference_source_count: undefined,
        cross_reference_target_count: undefined,
        library_cross_reference_count: undefined,
      } as unknown as ArtistCard,
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

    expect(screen.getByTestId("artist-delete-blocked")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Delete The Artist" })).toBeNull();
    // It must refuse without inventing a reason. Every gate names itself off
    // an unreadable count, so reciting them would assert four facts nothing
    // observed -- and the server 409s one reason at a time, so the all-four
    // sentence is only ever reachable here.
    const text = screen.getByTestId("artist-delete-blocked").textContent ?? "";
    expect(text).toContain("could not be read");
    expect(text).not.toContain("releases on file");
    expect(text).not.toContain("cross-references");
  });

  it("still renders a one-click delete when only compilation_credit_count is non-zero", () => {
    // Not a gate: its FK is ON DELETE SET NULL, so a delete unlinks the
    // credit rather than being blocked by it.
    loaded({ compilation_credit_count: 7 });

    renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

    expect(screen.getByRole("button", { name: "Delete The Artist" })).toBeDefined();
    expect(screen.queryByTestId("artist-delete-blocked")).toBeNull();
  });

  describe("the genre-prefixed identity", () => {
    // All three withhold Delete, because `code_artist_number` is genre-scoped
    // and "EL 15" names more than one shelf. They are NOT the same state
    // otherwise: in flight resolves itself, while a failed read and a missing
    // row never will -- `getGenres` has no retry and no polling -- so those
    // two owe the operator a sentence instead of a button that is disabled
    // forever for no stated reason.
    it.each([
      ["in flight", genresLoading, false],
      ["failed", genresFailed, true],
      ["missing the matching row", () => genresLoaded([{ id: 999, genre_name: "Jazz" }]), true],
    ])("shows the ambiguous code and holds Delete back while the genre is %s", (_label, arrangeGenres, explained) => {
      loaded();
      arrangeGenres();

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

      // Not "Electronic EL 15" -- the whole point is that the prefix must
      // not silently vanish while Delete stays live beside it.
      expect(screen.getByTestId("artist-delete-library-code").textContent).toBe("EL 15");
      expect(screen.getByRole("button", { name: "Delete The Artist" })).toBeDisabled();
      // Held, not withdrawn: Cancel must not flip to refusal wording for a
      // refusal that has not happened.
      expect(screen.getByRole("link", { name: "Cancel" })).toBeDefined();
      // A read that will never land says why; one still in flight does not,
      // since the disabled button is about to resolve on its own.
      const explanation = screen.queryByTestId("artist-delete-identity-unreadable");
      if (explained) {
        expect(explanation?.textContent).toContain("genre could not be read");
      } else {
        expect(explanation).toBeNull();
      }
    });

    it("goes live once the genre resolves", () => {
      loaded();
      genresLoaded();

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

      expect(screen.getByTestId("artist-delete-library-code").textContent).toBe("Electronic EL 15");
      expect(screen.getByRole("button", { name: "Delete The Artist" })).not.toBeDisabled();
    });

    it("does not delete on a click landed before the genre resolves", async () => {
      loaded();
      genresLoading();

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Delete The Artist" }));

      expect(mockDeleteArtist).not.toHaveBeenCalled();
    });

    it("freezes the resolved identity into the terminal state, immune to a later genres change", async () => {
      loaded();
      genresLoaded();
      mockDeleteArtist.mockReturnValue({
        unwrap: () => {
          // A later eviction or refetch of the genres list must not be able
          // to change what the terminal screen already committed to.
          genresLoaded([{ id: 999, genre_name: "Jazz" }]);
          return Promise.resolve(undefined);
        },
      });

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();

      expect(await screen.findByTestId("artist-deleted")).toBeDefined();
      expect(screen.getByTestId("artist-delete-library-code").textContent).toBe("Electronic EL 15");
    });
  });

  describe("after a delete that succeeded", () => {
    it("swaps to the terminal heading and offers no second Delete", async () => {
      loaded();
      mockDeleteArtist.mockReturnValue({ unwrap: () => Promise.resolve(undefined) });

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();

      expect(await screen.findByTestId("artist-deleted")).toBeDefined();
      expect(screen.getByText("The following Artist has been deleted:")).toBeDefined();
      expect(screen.queryByRole("button", { name: "Delete The Artist" })).toBeNull();
    });

    it("keeps showing the artist from a snapshot, since the row it was reading is gone", async () => {
      loaded();
      // The card behind this screen can stop resolving at any point after
      // the delete -- `deleteArtist` does not invalidate `ArtistCard`, but an
      // eviction or an unrelated refetch is not this component's to control.
      // Flipping the query mock as the delete resolves reproduces that
      // ordering rather than asserting against a second mount.
      mockDeleteArtist.mockReturnValue({
        unwrap: () => {
          mockGetArtistCardQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
          });
          return Promise.resolve(undefined);
        },
      });

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();

      expect(await screen.findByTestId("artist-deleted")).toBeDefined();
      expect(screen.getByTestId("artist-delete-name").textContent).toBe("Chuquimamani-Condori");
      expect(screen.queryByTestId("artist-delete-error")).toBeNull();
    });
  });

  describe("after a delete the server refused", () => {
    it("names the blocking reason for a 409 that raced in after a tier-1 render", async () => {
      loaded();
      mockDeleteArtist.mockReturnValue(
        refusal(409, {
          reason: "artist_has_releases",
          count: 2,
          message: "server text the client must not show",
        }),
      );

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();

      const banner = await screen.findByTestId("artist-delete-refusal");
      expect(banner.textContent).toContain("2 releases");
      expect(banner.textContent).not.toContain("server text");
      expect(screen.queryByTestId("artist-deleted")).toBeNull();
      expect(screen.queryByRole("button", { name: "Delete The Artist" })).toBeNull();
    });

    // A 409 racing in after a tier-1 render disproves the tier-1 sentence.
    // Leaving it on screen contradicts the refusal banner right beside it --
    // one saying nothing is filed, the other saying exactly what is.
    it("retracts the tier-1 'nothing is filed' sentence once the refusal disproves it", async () => {
      loaded();
      mockDeleteArtist.mockReturnValue(refusal(409, { reason: "artist_has_releases", count: 2 }));

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();

      await screen.findByTestId("artist-delete-refusal");
      expect(screen.queryByTestId("artist-delete-status")).toBeNull();
    });

    // The sole remaining control must not still read "Cancel" -- there is no
    // longer a Delete beside it to cancel.
    it("relabels the sole remaining control instead of leaving it as Cancel", async () => {
      loaded();
      mockDeleteArtist.mockReturnValue(refusal(409, { reason: "artist_has_releases", count: 2 }));

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();

      await screen.findByTestId("artist-delete-refusal");
      expect(screen.queryByRole("link", { name: "Cancel" })).toBeNull();
      expect(screen.getByRole("link", { name: "Back to the Artist Card" })).toBeDefined();
    });

    it("keeps the tier-1 sentence for a retryable lock stand-down, which has disproved nothing", async () => {
      loaded();
      mockDeleteArtist.mockReturnValue(
        refusal(503, {
          reason: "lock_unavailable",
          message: "Could not delete: the artist is being written to right now. Try again in a moment.",
        }),
      );

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();
      await screen.findByTestId("artist-delete-refusal");

      expect(screen.getByTestId("artist-delete-status")).toBeDefined();
      expect(screen.getByRole("link", { name: "Cancel" })).toBeDefined();
    });

    it("offers a retry for the lock stand-down", async () => {
      loaded();
      mockDeleteArtist.mockReturnValue(
        refusal(503, {
          reason: "lock_unavailable",
          message: "Could not delete: the artist is being written to right now. Try again in a moment.",
        }),
      );

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();
      await screen.findByTestId("artist-delete-refusal");

      expect(screen.getByRole("button", { name: "Delete The Artist" })).toBeDefined();
    });

    it("offers no retry for a refusal on the merits", async () => {
      loaded();
      mockDeleteArtist.mockReturnValue(refusal(409, { reason: "artist_has_releases", count: 1 }));

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);
      await clickDelete();
      await screen.findByTestId("artist-delete-refusal");

      expect(screen.queryByRole("button", { name: "Delete The Artist" })).toBeNull();
    });
  });

  // The screen names the genre-prefixed code because `code_artist_number` is
  // genre-scoped -- "EL 15" alone names two shelves for any of the 204 artists
  // carrying more than one membership. So the card read has to be scoped to the
  // shelf the librarian came from, or an irreversible write is confirmed under
  // another shelf's identity.
  describe("genre scope", () => {
    const ROCK_ID = 11;

    it("reads the card for the membership the URL named", () => {
      loaded();
      genresLoaded();

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} genreId={ROCK_ID} />);

      expect(mockGetArtistCardQuery).toHaveBeenCalledWith({
        artistId: ARTIST_ID,
        genre_id: ROCK_ID,
      });
    });

    // Cancel must land back on the card the librarian left, not on the
    // collapsed one -- otherwise declining a delete silently moves them to a
    // different band's page.
    it("returns Cancel to the same membership's card", async () => {
      loaded();
      genresLoaded();

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} genreId={ROCK_ID} />);

      const cancel = await screen.findByRole("link", { name: /cancel/i });
      expect(cancel.getAttribute("href")).toBe(
        `/dashboard/library/artist/${ARTIST_ID}?genre_id=${ROCK_ID}`,
      );
    });

    it("reads and returns unscoped when no membership was named", async () => {
      loaded();
      genresLoaded();

      renderWithProviders(<ArtistDeleteConfirm artistId={ARTIST_ID} />);

      expect(mockGetArtistCardQuery).toHaveBeenCalledWith({
        artistId: ARTIST_ID,
        genre_id: undefined,
      });
      const cancel = await screen.findByRole("link", { name: /cancel/i });
      expect(cancel.getAttribute("href")).toBe(`/dashboard/library/artist/${ARTIST_ID}`);
    });
  });
});
