import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/helpers";

const mockCardQuery = vi.fn();
const mockGenresQuery = vi.fn();
const mockByCodeQuery = vi.fn();
const mockRefile = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush, replace: vi.fn() }) }));
vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetArtistCardQuery: (...a: unknown[]) => mockCardQuery(...a),
    useGetGenresQuery: (...a: unknown[]) => mockGenresQuery(...a),
    useResolveArtistByCodeQuery: (...a: unknown[]) => mockByCodeQuery(...a),
    useRefileArtistMutation: () => [mockRefile, { isLoading: false }],
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

const byCode = (artists: unknown[] | null | undefined, error?: unknown) =>
  mockByCodeQuery.mockReturnValue({
    currentData: artists === undefined ? undefined : { artists },
    error,
    isFetching: false,
  });
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
    mockCardQuery.mockReturnValue({ data: card, isLoading: false });
    mockGenresQuery.mockReturnValue({ data: [{ id: GENRE_ID, genre_name: "Hiphop" }] });
    byCode(undefined);
  });

  it("scopes the card read to the shelf and shows the current full code", () => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);

    expect(mockCardQuery).toHaveBeenCalledWith({ artistId: ARTIST_ID, genre_id: GENRE_ID });
    expect(screen.getByTestId("artist-refile-current")).toHaveTextContent("Hiphop IS 1");
  });

  it("holds Continue and says nothing until a number is chosen", async () => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByTestId("artist-refile-occupancy")).toBeEmptyDOMElement();
  });

  it.each([["-1"], ["1.5"], ["2147483648"]])("refuses %s", async (value) => {
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await type(value);

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("reports a free number (an unassigned code is a 404)", async () => {
    byCode(undefined, { resolveArtistByCodeError: { status: 404, data: { reason: "code_not_assigned" } } });
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await type("31");

    await waitFor(() => expect(screen.getByTestId("artist-refile-occupancy")).toHaveTextContent("Hiphop IS 31 is free."));
    expect(mockByCodeQuery).toHaveBeenLastCalledWith({ genre_id: GENRE_ID, code_letters: "IS", code_number: 31 });
  });

  it("names the holder of an occupied number and links to their card", async () => {
    byCode([holder]);
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await type("31");

    const line = await waitFor(() => {
      const el = screen.getByTestId("artist-refile-occupancy");
      expect(el).toHaveTextContent("Hiphop IS 31 is held by Isobel Campbell.");
      return el;
    });
    expect(line.querySelector("a")?.getAttribute("href")).toBe(
      `/dashboard/library/artist/777?genre_id=${GENRE_ID}`,
    );
  });

  it("does not count the artist itself as a holder", async () => {
    byCode([{ ...holder, id: ARTIST_ID, artist_name: "Isis" }]);
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await type("1");

    await waitFor(() => expect(screen.getByTestId("artist-refile-occupancy")).toHaveTextContent("is free."));
  });

  it("says nothing when the occupancy answer is unreadable", async () => {
    byCode(null);
    renderWithProviders(<ArtistRefileForm artistId={ARTIST_ID} genreId={GENRE_ID} />);
    await type("31");
    await new Promise((r) => setTimeout(r, 400));

    expect(screen.getByTestId("artist-refile-occupancy")).toBeEmptyDOMElement();
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
    { name: "not filed", status: 404, body: { message: "Artist not filed under genre 6" }, text: "not filed under that genre" },
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
});
