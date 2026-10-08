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
const resolves = (body: object) => ({
  unwrap: () =>
    Promise.resolve({ ...card, previous_code_letters: card.code_letters, previous_genre_id: card.genre_id, ...body }),
});

const type = async (value: string) => {
  const user = userEvent.setup();
  // The box starts at the current number.
  await user.clear(screen.getByLabelText("New Call Number:"));
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

    expect(mockCardQuery).toHaveBeenCalledWith(
      { artistId: ARTIST_ID, genre_id: GENRE_ID },
      // The artist may have moved genres since this entry was cached.
      { refetchOnMountOrArgChange: true },
    );
    expect(screen.getByTestId("artist-refile-current")).toHaveTextContent("Hiphop IS 1");
  });

  it("starts at the current number, which holds Continue", async () => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    expect(screen.getByLabelText("New Call Number:")).toHaveValue(card.code_artist_number);
    expect(occupancyText()).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("holds Continue when the number is cleared", async () => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("New Call Number:"));
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
      "Move Isis from Hiphop IS 1 to Hiphop IS 31. Its releases filed under Hiphop re-label at once; the records will need new labels.",
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
    expect(refusal).toHaveTextContent("Hiphop IS 31 is held by Isobel Campbell. Nothing was changed.");
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
    it("says nothing on load, and nothing before the debounce elapses", async () => {
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

  describe("call letters", () => {
    const JAM_ID = 52;
    const JAZZ = 3;
    const ELECTRONIC = 9;
    // Jam Money, Jazz RE 36 -> JA 36.
    const jam = {
      artist_id: JAM_ID,
      artist_name: "Jam Money",
      alphabetical_name: "Jam Money",
      genre_id: JAZZ,
      code_letters: "RE",
      code_artist_number: 36,
      release_count: 12,
    };
    const jamHolder = { id: 901, artist_name: "Jessica Pratt", code_letters: "JA", code_number: 36, genre_id: JAZZ };
    const jamResolves = (body: object = {}) => ({
      unwrap: () =>
        Promise.resolve({
          ...jam,
          code_letters: "JA",
          changed: true,
          previous_code_artist_number: 36,
          previous_code_letters: "RE",
          previous_genre_id: JAZZ,
          releases_to_relabel: 4,
          ...body,
        }),
    });
    const lettersBox = () => screen.getByLabelText("New Call Letters:");
    const numberBox = () => screen.getByLabelText("New Call Number:");
    const setLetters = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
      await user.clear(lettersBox());
      if (value) await user.type(lettersBox(), value);
    };
    const setNumber = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
      await user.clear(numberBox());
      await user.type(numberBox(), value);
    };
    const render = () => renderWithProviders(<ArtistRefileForm artistId={JAM_ID} genreId={JAZZ} />);
    const reLettered = async (letters = "ja", number = "36") => {
      const user = userEvent.setup();
      await setLetters(user, letters);
      await setNumber(user, number);
      await user.click(screen.getByRole("button", { name: "Continue" }));
      return user;
    };
    const submit = (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    beforeEach(() => {
      mockCardQuery.mockReturnValue({ data: jam, isLoading: false });
      mockGenresQuery.mockReturnValue({
        data: [
          { id: JAZZ, genre_name: "Jazz" },
          { id: ELECTRONIC, genre_name: "Electronic" },
        ],
      });
    });

    it("seeds the letters and the number from the card", () => {
      render();

      expect(lettersBox()).toHaveValue("RE");
      expect(numberBox()).toHaveValue(36);
      // Nothing touched yet: the live region stays quiet on load.
      expect(occupancyText()).toBeEmptyDOMElement();
    });

    it("re-letters at the same number with no retyping, sending only what changed", async () => {
      mockRefile.mockReturnValue(jamResolves());
      render();
      const user = userEvent.setup();
      await setLetters(user, "ja");
      await user.click(screen.getByRole("button", { name: "Continue" }));
      await submit(user);

      expect(mockRefile).toHaveBeenCalledWith({
        artistId: JAM_ID,
        code_letters: "RE",
        body: { genre_id: JAZZ, code_artist_number: 36, code_letters: "JA" },
      });
    });

    it("confirms with both full codes and no per-card count (it spans every genre)", async () => {
      render();
      await reLettered();

      expect(screen.getByTestId("artist-refile-confirm-copy")).toHaveTextContent(
        "Move Jam Money from Jazz RE 36 to Jazz JA 36. Its releases filed under Jazz re-label at once; the records will need new labels.",
      );
      expect(screen.getByTestId("artist-refile-confirm-copy")).not.toHaveTextContent("12");
    });

    it("sends code_letters normalized, the source letters in the arg, and lands on the result's letters", async () => {
      mockRefile.mockReturnValue(jamResolves());
      render();
      const user = await reLettered(" ja ");
      await submit(user);

      expect(mockRefile).toHaveBeenCalledWith({
        artistId: JAM_ID,
        code_letters: "RE",
        body: { genre_id: JAZZ, code_artist_number: 36, code_letters: "JA" },
      });
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(
          `/dashboard/library/artist/${JAM_ID}?genre_id=${JAZZ}&refiled=1&from=36&n=4&from_letters=RE`,
        ),
      );
    });

    it("carries a non-canonical old code so the card can tell the letters changed", async () => {
      mockCardQuery.mockReturnValue({ data: { ...jam, code_letters: "??", code_artist_number: 35 }, isLoading: false });
      mockRefile.mockReturnValue(jamResolves({ previous_code_letters: "??", previous_code_artist_number: 35 }));
      render();
      const user = await reLettered("ja", "36");
      await submit(user);

      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(
          `/dashboard/library/artist/${JAM_ID}?genre_id=${JAZZ}&refiled=1&from=35&n=4&from_letters=%3F%3F`,
        ),
      );
    });

    it("routes by the result's letters, not the old card's", async () => {
      mockRefile.mockReturnValue(jamResolves({ code_letters: "V/A", previous_code_letters: "RE" }));
      render();
      const user = await reLettered("ja");
      await submit(user);

      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      expect(mockPush.mock.calls[0][0]).not.toContain(`genre_id=${JAZZ}`);
    });

    it.each([
      { label: "untouched", letters: null },
      { label: "retyped identically", letters: "RE" },
      { label: "retyped in lower case with spaces", letters: " re " },
    ])("omits code_letters when the letters are $label", async ({ letters }) => {
      mockRefile.mockReturnValue(
        jamResolves({ code_letters: "RE", code_artist_number: 37, previous_code_artist_number: 36, previous_code_letters: "RE" }),
      );
      render();
      const user = userEvent.setup();
      if (letters !== null) await setLetters(user, letters);
      await setNumber(user, "37");
      await user.click(screen.getByRole("button", { name: "Continue" }));
      await submit(user);

      expect(mockRefile).toHaveBeenCalledWith({
        artistId: JAM_ID,
        code_letters: "RE",
        body: { genre_id: JAZZ, code_artist_number: 37 },
      });
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.not.stringContaining("from_letters")));
    });

    it("lets a card with non-canonical letters re-number after its letters box is edited and put back", async () => {
      mockCardQuery.mockReturnValue({ data: { ...jam, code_letters: "??" }, isLoading: false });
      mockRefile.mockReturnValue(jamResolves({ code_letters: "??", previous_code_letters: "??" }));
      render();
      const user = userEvent.setup();
      await setLetters(user, "ja");
      await setLetters(user, "??");
      await setNumber(user, "37");

      expect(screen.queryByTestId("artist-refile-letters-error")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Continue" }));
      await submit(user);
      expect(mockRefile).toHaveBeenCalledWith(
        expect.objectContaining({ body: { genre_id: JAZZ, code_artist_number: 37 } }),
      );
    });

    it("compares against the stored letters the way the server does (trimmed, upper-cased)", async () => {
      mockCardQuery.mockReturnValue({ data: { ...jam, code_letters: " re " }, isLoading: false });
      mockRefile.mockReturnValue(jamResolves({ code_letters: "RE", code_artist_number: 37 }));
      render();
      const user = userEvent.setup();
      await setLetters(user, "RE");
      await setNumber(user, "37");
      await user.click(screen.getByRole("button", { name: "Continue" }));
      await submit(user);

      expect(mockRefile).toHaveBeenCalledWith(
        expect.objectContaining({ body: { genre_id: JAZZ, code_artist_number: 37 } }),
      );
    });

    it("holds Continue when neither the letters nor the number changed", async () => {
      render();

      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it.each([
      { label: "empty", value: "", text: "Enter the call letters." },
      { label: "too long", value: "ABCDE", text: "at most 4 characters" },
      { label: "a Various Artists bucket", value: "v/a", text: "Various Artists sections cannot be filed here." },
      { label: "a legacy compilation prefix", value: "Z-", text: "Various Artists sections cannot be filed here." },
      { label: "punctuation", value: "J.A", text: "only letters A-Z, digits and /" },
      { label: "a letter that upper-cases to two (ß)", value: "ß", text: "only letters A-Z, digits and /" },
      { label: "a letter that upper-cases to ASCII (ı)", value: "ı", text: "only letters A-Z, digits and /" },
      { label: "a ligature (ﬀ)", value: "ﬀ", text: "only letters A-Z, digits and /" },
    ])("refuses $label letters client-side", async ({ value, text }) => {
      byCode(undefined, NOT_ASSIGNED);
      render();
      const user = userEvent.setup();
      await setLetters(user, value);
      await setNumber(user, "37");
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
      expect(screen.getByTestId("artist-refile-letters-error")).toHaveTextContent(text);
      expect(occupancyText()).toBeEmptyDOMElement();
      expect(mockByCodeQuery).not.toHaveBeenCalledWith(expect.objectContaining({ code_letters: value.toUpperCase() }));
      expect(mockRefile).not.toHaveBeenCalled();
    });

    it("shows no letters error for valid letters", async () => {
      render();
      const user = userEvent.setup();
      await setLetters(user, "ja");

      expect(screen.queryByTestId("artist-refile-letters-error")).toBeNull();
    });

    it("follows the destination bucket for the occupancy lookup", async () => {
      byCode(undefined, NOT_ASSIGNED);
      render();
      const user = userEvent.setup();
      await setLetters(user, "ja");

      await waitFor(() =>
        expect(mockByCodeQuery).toHaveBeenLastCalledWith({ genre_id: JAZZ, code_letters: "JA", code_number: 36 }),
      );
      await waitFor(() => expect(occupancyText()).toHaveTextContent("Jazz JA 36 is free."));
    });

    it("names the holder of the destination code", async () => {
      byCode([jamHolder]);
      render();
      const user = userEvent.setup();
      await setLetters(user, "ja");

      await waitFor(() => expect(occupancyText()).toHaveTextContent("Jazz JA 36 is held by Jessica Pratt."));
    });

    it("blanks the line after a letters change until the new bucket's lookup settles", async () => {
      byCode(undefined, NOT_ASSIGNED);
      const { rerender } = render();
      const user = userEvent.setup();
      await setNumber(user, "37");
      await waitFor(() => expect(occupancyText()).toHaveTextContent("Jazz RE 37 is free."));

      // The JA lookup is still in flight: the RE answer must not speak for JA.
      byCode(undefined, NOT_ASSIGNED, true);
      await setLetters(user, "ja");
      rerender(<ArtistRefileForm artistId={JAM_ID} genreId={JAZZ} />);
      expect(occupancyText()).toBeEmptyDOMElement();

      byCode(undefined, NOT_ASSIGNED, false);
      rerender(<ArtistRefileForm artistId={JAM_ID} genreId={JAZZ} />);
      await waitFor(() => expect(occupancyText()).toHaveTextContent("Jazz JA 37 is free."));
    });

    it("looks up the current letters when only the number changes", async () => {
      byCode(undefined, NOT_ASSIGNED);
      render();
      const user = userEvent.setup();
      await setNumber(user, "37");

      await waitFor(() =>
        expect(mockByCodeQuery).toHaveBeenLastCalledWith({ genre_id: JAZZ, code_letters: "RE", code_number: 37 }),
      );
    });

    it("names the destination code, not 'that number', when a letters change hits a holder", async () => {
      mockRefile.mockReturnValue(
        rejects(409, { reason: "artist_code_conflict", artist: { ...jamHolder, code_artist_number: 36 } }),
      );
      render();
      const user = await reLettered();
      await submit(user);

      expect(await screen.findByTestId("artist-refile-refusal")).toHaveTextContent(
        "Jazz JA 36 is held by Jessica Pratt. Nothing was changed.",
      );
    });

    it.each([
      {
        name: "letters shared across genres, naming the other genre",
        status: 409,
        body: {
          reason: "letters_shared_across_genres",
          memberships: [
            { genre_id: JAZZ, code_artist_number: 36 },
            { genre_id: ELECTRONIC, code_artist_number: 4 },
          ],
        },
        text: "Jam Money is also filed under Electronic, so changing its letters would re-letter that shelf too.",
        keepsContinue: true,
      },
      {
        name: "letters shared across genres, memberships unreadable",
        status: 409,
        body: { reason: "letters_shared_across_genres" },
        text: "letters are used in another genre",
        keepsContinue: true,
      },
      {
        name: "already filed in genre",
        status: 409,
        body: { reason: "already_filed_in_genre" },
        text: "already has a membership or a release in that genre",
        keepsContinue: true,
      },
      {
        name: "genre not found",
        status: 404,
        body: { message: "x", code: "genre_not_found" },
        text: "That genre was not found",
        keepsContinue: true,
      },
    ])("states a $name refusal once; Continue stays: $keepsContinue", async ({ status, body, text, keepsContinue }) => {
      mockRefile.mockReturnValue(rejects(status, body));
      render();
      const user = await reLettered();
      await submit(user);

      expect(await screen.findAllByRole("alert")).toHaveLength(1);
      expect(screen.getByTestId("artist-refile-refusal")).toHaveTextContent(text);
      expect(screen.queryByRole("button", { name: "Continue" }) !== null).toBe(keepsContinue);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("clears a standing refusal when the letters are edited", async () => {
      mockRefile.mockReturnValue(rejects(409, { reason: "letters_shared_across_genres" }));
      render();
      const user = await reLettered();
      await submit(user);
      await screen.findByTestId("artist-refile-refusal");

      await user.type(lettersBox(), "X");

      expect(screen.queryByTestId("artist-refile-refusal")).toBeNull();
    });
  });

  describe("genre", () => {
    const JAM_ID = 52;
    const JAZZ = 3;
    const ELECTRONIC = 9;
    const jam = {
      artist_id: JAM_ID,
      artist_name: "Jam Money",
      alphabetical_name: "Jam Money",
      genre_id: JAZZ,
      code_letters: "RE",
      code_artist_number: 36,
    };
    const GENRES = [
      { id: JAZZ, genre_name: "Jazz" },
      { id: ELECTRONIC, genre_name: "Electronic" },
    ];
    const movedResult = (body: object = {}) => ({
      unwrap: () =>
        Promise.resolve({
          ...jam,
          genre_id: ELECTRONIC,
          changed: true,
          previous_code_artist_number: 36,
          previous_code_letters: "RE",
          previous_genre_id: JAZZ,
          releases_to_relabel: 4,
          ...body,
        }),
    });
    const genreBox = () => screen.getByLabelText("New Genre:");
    const render = () => renderWithProviders(<ArtistRefileForm artistId={JAM_ID} genreId={JAZZ} />);
    const toElectronic = async (user = userEvent.setup()) => {
      await user.selectOptions(genreBox(), String(ELECTRONIC));
      return user;
    };
    const confirm = (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: "Continue" }));
    const submit = (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: "Re-file The Artist" }));

    beforeEach(() => {
      mockCardQuery.mockReturnValue({ data: jam, isLoading: false });
      mockGenresQuery.mockReturnValue({ data: GENRES });
    });

    it("defaults the genre to the card's and holds Continue until something changes", () => {
      render();

      expect(genreBox()).toHaveValue(String(JAZZ));
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("moves the genre only: sends to_genre_id, keeps the letters and number, and lands on the destination card", async () => {
      mockRefile.mockReturnValue(movedResult());
      render();
      const user = await toElectronic();
      await confirm(user);

      expect(screen.getByTestId("artist-refile-confirm-copy")).toHaveTextContent(
        "Move Jam Money from Jazz RE 36 to Electronic RE 36. Its releases filed under Jazz move with it and re-label at once; the records will need new labels.",
      );
      await submit(user);
      expect(mockRefile).toHaveBeenCalledWith({
        artistId: JAM_ID,
        code_letters: "RE",
        body: { genre_id: JAZZ, code_artist_number: 36, to_genre_id: ELECTRONIC },
      });
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(
          `/dashboard/library/artist/${JAM_ID}?genre_id=${ELECTRONIC}&refiled=1&from=36&n=4&from_genre=${JAZZ}`,
        ),
      );
    });

    it.each([
      {
        label: "genre and letters",
        letters: "ja",
        number: null,
        body: { genre_id: JAZZ, code_artist_number: 36, code_letters: "JA", to_genre_id: ELECTRONIC },
        copy: "from Jazz RE 36 to Electronic JA 36",
        result: { code_letters: "JA", previous_code_letters: "RE" },
        url: `genre_id=${ELECTRONIC}&refiled=1&from=36&n=4&from_letters=RE&from_genre=${JAZZ}`,
      },
      {
        label: "genre and number",
        letters: null,
        number: "4",
        body: { genre_id: JAZZ, code_artist_number: 4, to_genre_id: ELECTRONIC },
        copy: "from Jazz RE 36 to Electronic RE 4",
        result: { code_artist_number: 4 },
        url: `genre_id=${ELECTRONIC}&refiled=1&from=36&n=4&from_genre=${JAZZ}`,
      },
    ])("moves $label together", async ({ letters, number, body, copy, result, url }) => {
      mockRefile.mockReturnValue(movedResult(result));
      render();
      const user = userEvent.setup();
      if (letters) {
        await user.clear(screen.getByLabelText("New Call Letters:"));
        await user.type(screen.getByLabelText("New Call Letters:"), letters);
      }
      if (number) {
        await user.clear(screen.getByLabelText("New Call Number:"));
        await user.type(screen.getByLabelText("New Call Number:"), number);
      }
      await toElectronic(user);
      await confirm(user);
      expect(screen.getByTestId("artist-refile-confirm-copy")).toHaveTextContent(copy);
      await submit(user);

      expect(mockRefile).toHaveBeenCalledWith({ artistId: JAM_ID, code_letters: "RE", body });
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.stringContaining(url)));
    });

    it("omits to_genre_id when the genre is chosen and put back", async () => {
      mockRefile.mockReturnValue(movedResult({ genre_id: JAZZ, code_artist_number: 37, previous_genre_id: JAZZ }));
      render();
      const user = userEvent.setup();
      await toElectronic(user);
      await user.selectOptions(genreBox(), String(JAZZ));
      await user.clear(screen.getByLabelText("New Call Number:"));
      await user.type(screen.getByLabelText("New Call Number:"), "37");
      await confirm(user);
      await submit(user);

      expect(mockRefile).toHaveBeenCalledWith({
        artistId: JAM_ID,
        code_letters: "RE",
        body: { genre_id: JAZZ, code_artist_number: 37 },
      });
    });

    it("re-points the occupancy lookup and line at the destination genre", async () => {
      byCode(undefined, NOT_ASSIGNED);
      render();
      await toElectronic();

      await waitFor(() =>
        expect(mockByCodeQuery).toHaveBeenLastCalledWith({ genre_id: ELECTRONIC, code_letters: "RE", code_number: 36 }),
      );
      await waitFor(() => expect(occupancyText()).toHaveTextContent("Electronic RE 36 is free."));
    });

    it("names the holder of the destination code, linked to the destination genre", async () => {
      byCode([{ id: 901, artist_name: "Chuquimamani-Condori", code_letters: "RE", code_number: 36, genre_id: ELECTRONIC }]);
      render();
      await toElectronic();

      await waitFor(() =>
        expect(occupancyText()).toHaveTextContent("Electronic RE 36 is held by Chuquimamani-Condori."),
      );
      expect(occupancyText().querySelector("a")?.getAttribute("href")).toBe(
        `/dashboard/library/artist/901?genre_id=${ELECTRONIC}`,
      );
    });

    it("stays quiet about the current code until a field is touched, then says it", async () => {
      render();
      expect(occupancyText()).toBeEmptyDOMElement();
      const user = userEvent.setup();
      await user.clear(screen.getByLabelText("New Call Number:"));
      await user.type(screen.getByLabelText("New Call Number:"), "36");

      expect(occupancyText()).toHaveTextContent("That is the current call number.");
    });

    it("states the genre-list outage and holds Continue, since nothing can be re-filed until the names load", async () => {
      mockGenresQuery.mockReturnValue({ data: undefined, isUninitialized: false, isLoading: false });
      render();

      expect(screen.queryByLabelText("New Genre:")).toBeNull();
      expect(screen.getByTestId("artist-refile-genres-unavailable")).toHaveTextContent("genre list could not be loaded");
      expect(screen.getByTestId("artist-refile-genres-unavailable")).toHaveTextContent("nothing can be re-filed until");
      const user = userEvent.setup();
      await user.clear(screen.getByLabelText("New Call Number:"));
      await user.type(screen.getByLabelText("New Call Number:"), "37");
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("says the artist is already filed there, instead of 'free', and holds Continue", async () => {
      byCode([{ id: JAM_ID, artist_name: "Jam Money", code_letters: "RE", code_number: 36, genre_id: ELECTRONIC }]);
      render();
      await toElectronic();

      await waitFor(() => expect(occupancyText()).toHaveTextContent("Jam Money is already filed under Electronic."));
      expect(occupancyText()).not.toHaveTextContent("free");
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("names the destination code when the holder cannot be read", async () => {
      mockRefile.mockReturnValue(rejects(409, { reason: "artist_code_conflict" }));
      render();
      const user = await toElectronic();
      await confirm(user);
      await submit(user);

      expect(await screen.findByTestId("artist-refile-refusal")).toHaveTextContent(
        "Electronic RE 36 is held by another artist. Nothing was changed.",
      );
    });

    it("conflict after a genre move names the destination code", async () => {
      mockRefile.mockReturnValue(
        rejects(409, {
          reason: "artist_code_conflict",
          artist: { id: 901, artist_name: "Chuquimamani-Condori", code_letters: "RE", code_artist_number: 36, genre_id: ELECTRONIC },
        }),
      );
      render();
      const user = await toElectronic();
      await confirm(user);
      await submit(user);

      expect(await screen.findByTestId("artist-refile-refusal")).toHaveTextContent(
        "Electronic RE 36 is held by Chuquimamani-Condori. Nothing was changed.",
      );
    });

    it.each([
      { name: "already filed in genre", status: 409, body: { reason: "already_filed_in_genre" }, text: "choose another genre" },
      { name: "genre not found", status: 404, body: { message: "x", code: "genre_not_found" }, text: "That genre was not found" },
    ])("keeps Continue after a $name refusal, since the genre can be changed here", async ({ status, body, text }) => {
      mockRefile.mockReturnValue(rejects(status, body));
      render();
      const user = await toElectronic();
      await confirm(user);
      await submit(user);

      expect(await screen.findByTestId("artist-refile-refusal")).toHaveTextContent(text);
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("clears a standing refusal when the genre is changed", async () => {
      mockRefile.mockReturnValue(rejects(409, { reason: "already_filed_in_genre" }));
      render();
      const user = await toElectronic();
      await confirm(user);
      await submit(user);
      await screen.findByTestId("artist-refile-refusal");

      await user.selectOptions(genreBox(), String(JAZZ));

      expect(screen.queryByTestId("artist-refile-refusal")).toBeNull();
    });

    it("the heading and load error cover letters and genre", () => {
      render();
      expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Letters, Number Or Genre");
    });
  });
});
