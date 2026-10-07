import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/helpers";

const mockCardQuery = vi.fn();
const mockGenresQuery = vi.fn();
const mockRefile = vi.fn();
const mockPush = vi.fn();
const mockByCodeQuery = vi.fn();
const mockRefiling = { value: false };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush, replace: vi.fn() }) }));
vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetArtistCardQuery: (...a: unknown[]) => mockCardQuery(...a),
    useGetGenresQuery: (...a: unknown[]) => mockGenresQuery(...a),
    useResolveArtistByCodeQuery: (...a: unknown[]) => mockByCodeQuery(...a),
    useRefileArtistMutation: () => [mockRefile, { isLoading: mockRefiling.value }],
  };
});

import ArtistRefileForm from "@/src/components/experiences/classic/catalog/ArtistRefileForm";

const ARTIST_ID = 431;
const GENRE_ID = 6;
// Isis, the librarian's own case: Hiphop IS 1 -> IS 31.
const card = {
  artist_id: ARTIST_ID,
  artist_name: "Isis",
  alphabetical_name: "Isis",
  genre_id: GENRE_ID,
  code_letters: "IS",
  code_artist_number: 1,
};
const holder = { id: 777, artist_name: "Isobel Campbell", code_letters: "IS", code_number: 31, genre_id: GENRE_ID };

const byCode = (artists: unknown[] | null | undefined, error?: unknown, isFetching = false) =>
  mockByCodeQuery.mockReturnValue({
    currentData: artists === undefined ? undefined : { artists },
    error,
    isFetching,
  });
const NOT_ASSIGNED = { resolveArtistByCodeError: { status: 404, data: { reason: "code_not_assigned" } } };
const occupancyText = () => screen.getByTestId("artist-refile-occupancy");
const lookedUp = (n: number) =>
  waitFor(() =>
    expect(mockByCodeQuery).toHaveBeenLastCalledWith({ genre_id: GENRE_ID, code_letters: "IS", code_number: n }),
  );
const rejects = (status: number, data: unknown) => ({
  unwrap: () => Promise.reject({ refileArtistError: { status, data } }),
});
const resolves = (body: object) => ({ unwrap: () => Promise.resolve({ ...card, ...body }) });

const type = async (value: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New Call Number:"), value);
  return user;
};
const toConfirm = async (value = "31") => {
  const user = await type(value);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  return user;
};

describe("classic ArtistRefileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefiling.value = false;
    byCode(undefined);
    mockCardQuery.mockReturnValue({ data: card, isLoading: false });
    mockGenresQuery.mockReturnValue({ data: [{ id: GENRE_ID, genre_name: "Hiphop" }] });
  });

  it("scopes the card read to the shelf and shows the current full code", () => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);

    expect(mockCardQuery).toHaveBeenCalledWith({ artistId: ARTIST_ID, genre_id: GENRE_ID });
    expect(screen.getByTestId("artist-refile-current")).toHaveTextContent("Hiphop IS 1");
  });

  it("holds Continue until a number is chosen", async () => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it.each([["-1"], ["1.5"], ["2147483648"]])("refuses %s", async (value) => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await type(value);

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("confirms with both codes composed and the relabel warning", async () => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await toConfirm();

    expect(screen.getByTestId("artist-refile-confirm-copy")).toHaveTextContent(
      "Move Isis from Hiphop IS 1 to Hiphop IS 31. Every release under this shelf re-labels at once; the records on the shelf will need new labels.",
    );
  });

  it("submits the shelf, letters and number, then lands on the card with the banner params", async () => {
    mockRefile.mockReturnValue(resolves({ code_artist_number: 31, changed: true, previous_code_artist_number: 1, releases_to_relabel: 2 }));
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    expect(mockRefile).toHaveBeenCalledWith({
      artistId: ARTIST_ID,
      code_letters: "IS",
      body: { genre_id: GENRE_ID, code_artist_number: 31 },
    });
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        `/dashboard/library/artist/${ARTIST_ID}?genre_id=${GENRE_ID}&refiled=1&from=1&n=2`,
      ),
    );
  });

  it("stays and says nothing changed on a no-op 200", async () => {
    mockRefile.mockReturnValue(resolves({ changed: false, previous_code_artist_number: 31, releases_to_relabel: 0 }));
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    expect(await screen.findByTestId("artist-refile-unchanged")).toHaveTextContent("Nothing changed.");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("returns to the choice naming the holder, linked, on a 409 conflict", async () => {
    mockRefile.mockReturnValue(rejects(409, { reason: "artist_code_conflict", artist: { ...holder, code_artist_number: 31 } }));
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    const refusal = await screen.findByTestId("artist-refile-refusal");
    expect(refusal).toHaveTextContent("That number is held by Isobel Campbell. Nothing was changed.");
    expect(refusal.querySelector("a")?.getAttribute("href")).toBe(`/dashboard/library/artist/777?genre_id=${GENRE_ID}`);
    expect(screen.getByTestId("artist-refile-choose")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it.each([
    { name: "lettered section", status: 409, body: { reason: "lettered_compilation_section" }, text: "lettered compilation section" },
    { name: "various artists section", status: 409, body: { reason: "various_artists_section" }, text: "Various Artists section" },
    { name: "not filed", status: 404, body: { message: "Artist not filed under genre 6" }, text: "not filed under that genre" },
    { name: "not filed by code, message reworded", status: 404, body: { message: "No shelf entry", code: "artist_not_filed_in_genre" }, text: "not filed under that genre" },
    { name: "not found", status: 404, body: { message: "Artist not found" }, text: "no longer in the catalog" },
    { name: "lock", status: 503, body: {}, text: "someone else is editing the shelf" },
    { name: "unknown 409", status: 409, body: { reason: "something_new" }, text: "could not be re-filed" },
  ])("states a $name refusal once, without navigating", async ({ status, body, text }) => {
    mockRefile.mockReturnValue(rejects(status, body));
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    expect(await screen.findAllByRole("alert")).toHaveLength(1);
    expect(screen.getByTestId("artist-refile-refusal")).toHaveTextContent(text);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it.each([
    { label: "a lettered compilation section", body: { code_comp_letter: "L" }, text: "lettered compilation section" },
    { label: "Various Artists", body: { code_letters: "V/A" }, text: "Compilation sections are not re-filed" },
  ])("renders a refusal and no form for $label", ({ body, text }) => {
    mockCardQuery.mockReturnValue({ data: { ...card, ...body }, isLoading: false });
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);

    expect(screen.getByTestId("artist-refile-ineligible")).toHaveTextContent(text);
    expect(screen.getByRole("link", { name: "Back to the Artist Card" })).toBeDefined();
    expect(screen.queryByLabelText("New Call Number:")).toBeNull();
  });

  it("shows a loading line, then a load error, while the card has no data", () => {
    mockCardQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { unmount } = renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    expect(screen.getByText("Loading the artist...")).toBeDefined();
    unmount();

    mockCardQuery.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    expect(screen.getByTestId("artist-refile-error")).toHaveTextContent("could not be loaded");
  });

  it("holds Continue until the genre name is known", async () => {
    mockGenresQuery.mockReturnValue({ data: undefined });
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await type("31");

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("clears a refusal when the number is edited", async () => {
    mockRefile.mockReturnValue(rejects(409, { reason: "artist_code_conflict", artist: { ...holder, code_artist_number: 31 } }));
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));
    await screen.findByTestId("artist-refile-refusal");

    await user.type(screen.getByLabelText("New Call Number:"), "2");

    expect(screen.queryByTestId("artist-refile-refusal")).toBeNull();
  });

  it.each([
    { name: "lettered section", status: 409, body: { reason: "lettered_compilation_section" } },
    { name: "various artists section", status: 409, body: { reason: "various_artists_section" } },
    { name: "not filed", status: 404, body: { message: "Artist not filed under genre 6" } },
    { name: "not found", status: 404, body: { message: "Artist not found" } },
  ])("withdraws Continue after a $name refusal on the merits", async ({ status, body }) => {
    mockRefile.mockReturnValue(rejects(status, body));
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    await screen.findByTestId("artist-refile-refusal");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to the Artist Card" })).toBeDefined();
  });

  it.each([
    { name: "lock", status: 503, body: {} },
    { name: "server error", status: 500, body: {} },
  ])("keeps Continue after a retryable $name refusal", async ({ status, body }) => {
    mockRefile.mockReturnValue(rejects(status, body));
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    await screen.findByTestId("artist-refile-refusal");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("says the outcome is unknown when no answer came back", async () => {
    mockRefile.mockReturnValue({ unwrap: () => Promise.reject(new Error("network")) });
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    expect(await screen.findByTestId("artist-refile-refusal")).toHaveTextContent("may or may not have been re-filed");
  });

  it("disables both buttons while a submit is in flight", async () => {
    const { rerender } = renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await toConfirm();
    mockRefiling.value = true;
    rerender(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);

    expect(screen.getByRole("button", { name: "Re-file The Artist" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("keeps both buttons disabled and drops the stale copy once the re-file lands", async () => {
    mockRefile.mockReturnValue(resolves({ code_artist_number: 31, changed: true, previous_code_artist_number: 1, releases_to_relabel: 2 }));
    // The refetched card now carries the new number, as the invalidation would deliver.
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = await toConfirm();
    mockCardQuery.mockReturnValue({ data: { ...card, code_artist_number: 31 }, isLoading: false });
    await user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    await waitFor(() =>
      expect(screen.getByTestId("artist-refile-confirm-copy")).toHaveTextContent("Re-filed; returning to the card"),
    );
    expect(screen.getByRole("button", { name: "Re-file The Artist" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  describe("advisory occupancy line", () => {
    it("says nothing until a number is chosen, and before the debounce elapses", async () => {
      byCode(undefined, NOT_ASSIGNED);
      renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
      expect(occupancyText()).toBeEmptyDOMElement();

      await type("31");
      // Typed, but the lookup has not been issued yet.
      expect(occupancyText()).toBeEmptyDOMElement();
      await lookedUp(31);
    });

    it("reports a free number (an unassigned code is a 404)", async () => {
      byCode(undefined, NOT_ASSIGNED);
      renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
      await type("31");

      await waitFor(() => expect(occupancyText()).toHaveTextContent("Hiphop IS 31 is free."));
    });

    it("names the holder of an occupied number and links to their card", async () => {
      byCode([holder]);
      renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
      await type("31");

      await waitFor(() => expect(occupancyText()).toHaveTextContent("Hiphop IS 31 is held by Isobel Campbell."));
      expect(occupancyText().querySelector("a")?.getAttribute("href")).toBe(
        `/dashboard/library/artist/777?genre_id=${GENRE_ID}`,
      );
    });

    it("does not count the artist itself as a holder", async () => {
      byCode([{ ...holder, id: ARTIST_ID, artist_name: "Isis" }]);
      renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
      await type("31");

      await waitFor(() => expect(occupancyText()).toHaveTextContent("is free."));
    });

    it("calls the artist's own number the current one, not free, and does not look it up", async () => {
      renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
      await type("1");

      expect(occupancyText()).toHaveTextContent("That is the current call number.");
      expect(mockByCodeQuery).not.toHaveBeenCalledWith(expect.objectContaining({ code_number: 1 }));
    });

    it.each([
      { name: "an in-flight lookup", artists: [holder], error: undefined, fetching: true },
      { name: "an unreadable body", artists: null, error: undefined, fetching: false },
      { name: "a non-404 error", artists: undefined, error: { resolveArtistByCodeError: { status: 500, data: {} } }, fetching: false },
      {
        name: "a genre_not_found 404",
        artists: undefined,
        error: { resolveArtistByCodeError: { status: 404, data: { reason: "genre_not_found" } } },
        fetching: false,
      },
    ])("says nothing for $name", async ({ artists, error, fetching }) => {
      byCode(artists, error, fetching);
      renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
      await type("31");
      await lookedUp(31);

      expect(occupancyText()).toBeEmptyDOMElement();
    });
  });
});
