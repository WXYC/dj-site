import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/tests/helpers";
import ArtistAddForm from "@/src/components/experiences/modern/catalog/ArtistAddForm";

const GENRE_ID = TEST_ENTITY_IDS.GENRE.ROCK;
const JAZZ_GENRE_ID = TEST_ENTITY_IDS.GENRE.JAZZ;
const { MOLINA, STEREOLAB } = TEST_SEARCH_STRINGS.CODE_LETTERS;

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

// No organization configured (the real production shape): the WXYC tier
// resolves via fetchOrganizationRoleForUserClient's JWT decode, not the raw
// session role, so every test drives that mock and awaits resolution.
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import { toast } from "sonner";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

function sessionWithRole() {
  return {
    data: {
      user: {
        id: "user-1",
        email: "test@wxyc.org",
        name: "Test User",
        username: "testuser",
        role: null,
        emailVerified: true,
      },
      session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
    },
    isPending: false,
    error: null,
  };
}

function mockGenres(
  genres: { id: number; genre_name: string }[] = [{ id: GENRE_ID, genre_name: "Rock" }],
) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () => HttpResponse.json(genres)),
  );
}

function mockArtistSearch(artists: unknown[] = []): { getCallCount: () => number } {
  let calls = 0;
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => {
      calls += 1;
      return HttpResponse.json({ artists });
    }),
  );
  return { getCallCount: () => calls };
}

/** Captures the query params every peek-code preview request was made with. */
function mockPeekCode(
  respond: (code_letters: string) => number = () => 7,
): { getQueries: () => { code_letters: string | null; genre_id: string | null }[] } {
  const queries: { code_letters: string | null; genre_id: string | null }[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      queries.push({
        code_letters: params.get("code_letters"),
        genre_id: params.get("genre_id"),
      });
      return HttpResponse.json({
        next_code_number: respond(params.get("code_letters") ?? ""),
      });
    }),
  );
  return { getQueries: () => queries };
}

/** Captures the exact serialized JSON body POSTed to /library/artists. */
function mockAddArtist(
  respond: (body: unknown) => Response | Promise<Response>,
): { getBodies: () => unknown[] } {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${TEST_BACKEND_URL}/library/artists`, async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return respond(body);
    }),
  );
  return { getBodies: () => bodies };
}

function created(overrides: Record<string, unknown> = {}) {
  return HttpResponse.json(
    {
      id: 99,
      artist_name: "Juana Molina",
      code_letters: MOLINA,
      code_number: 12,
      genre_id: GENRE_ID,
      ...overrides,
    },
    { status: 201 },
  );
}

function conflictResponse(overrides: Record<string, unknown> = {}) {
  return HttpResponse.json(
    {
      message: "Artist code already exists for that genre and code letters.",
      artist: { artist_id: 5, artist_name: "Stereolab", code_letters: MOLINA },
      ...overrides,
    },
    { status: 409 },
  );
}

async function selectGenre(
  user: ReturnType<typeof renderWithProviders>["user"],
  name = "Rock",
) {
  const genreSelect = await screen.findByRole("combobox", { name: /genre/i });
  await user.click(genreSelect);
  await user.click(await screen.findByRole("option", { name }));
}

async function fillCoreFields(
  user: ReturnType<typeof renderWithProviders>["user"],
  codeLetters: string = MOLINA,
) {
  await selectGenre(user);

  const nameInput = await screen.findByPlaceholderText("Search artists...");
  await user.type(nameInput, "Juana Molina");

  await user.type(screen.getByLabelText(/call letters/i), codeLetters);
  await user.type(screen.getByLabelText("Code number"), "12");
}

describe("ArtistAddForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenres();
    mockArtistSearch([]);
    mockPeekCode();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<ArtistAddForm />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByText(/add artist/i)).not.toBeInTheDocument(),
      );
    });

    it("renders the form for a Music Director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<ArtistAddForm />);

      expect(await screen.findByRole("button", { name: /add artist/i })).toBeInTheDocument();
    });
  });

  describe("as a Music Director", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("submits a valid AddArtistRequestBody, asserting the serialized outgoing body", async () => {
      const { getBodies } = mockAddArtist((body) =>
        created({ artist_name: (body as { artist_name: string }).artist_name }),
      );
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));

      await waitFor(() => expect(getBodies()).toHaveLength(1));
      expect(getBodies()[0]).toEqual({
        artist_name: "Juana Molina",
        code_letters: MOLINA,
        genre_id: GENRE_ID,
        code_number: 12,
      });
    });

    it("carries alphabetical_name on the wire when one is typed", async () => {
      const { getBodies } = mockAddArtist(() => created());
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.type(
        screen.getByLabelText(/alphabetical name/i),
        "Molina, Juana",
      );
      await user.click(screen.getByRole("button", { name: /add artist/i }));

      await waitFor(() => expect(getBodies()).toHaveLength(1));
      expect(getBodies()[0]).toEqual({
        artist_name: "Juana Molina",
        code_letters: MOLINA,
        genre_id: GENRE_ID,
        code_number: 12,
        alphabetical_name: "Molina, Juana",
      });
    });

    it("shows the assigned code from the 201 response rather than echoing what was typed", async () => {
      // The response deliberately disagrees with the typed MO/12 so the
      // assertion can only pass by reading the server's copy of what was
      // filed — an echo of client state would render MO12.
      mockAddArtist(() => created({ code_letters: STEREOLAB, code_number: 44 }));
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));

      expect(
        await screen.findByText(new RegExp(`${STEREOLAB}44`)),
      ).toBeInTheDocument();
      expect(screen.queryByText(new RegExp(`${MOLINA}12`))).not.toBeInTheDocument();
    });

    it("clears the fields and confirms by name after a successful add", async () => {
      mockAddArtist(() => created());
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.type(
        screen.getByLabelText(/alphabetical name/i),
        "Molina, Juana",
      );
      await user.click(screen.getByRole("button", { name: /add artist/i }));

      // The next artist in a batch starts from an empty form, not from the
      // last one's values.
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Added Juana Molina"),
      );
      expect(screen.getByPlaceholderText("Search artists...")).toHaveValue("");
      expect(screen.getByLabelText(/alphabetical name/i)).toHaveValue("");
      expect(screen.getByLabelText(/call letters/i)).toHaveValue("");
      expect(screen.getByLabelText("Code number")).toHaveValue("");
      // The genre is deliberately kept: an MD files a whole genre at a time.
      expect(screen.getByRole("combobox", { name: /genre/i })).toHaveTextContent(
        "Rock",
      );
    });

    it("renders the conflicting artist by name on a 409 response instead of a generic failure", async () => {
      mockAddArtist(() => conflictResponse());
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/Stereolab/);
      // A recoverable outcome gets one surface. The backend's 409 carries a
      // generic message that the global rejected-query middleware would
      // otherwise toast on top of this banner.
      expect(toast.error).not.toHaveBeenCalled();
    });

    it.each([
      ["the code number", async (user: ReturnType<typeof renderWithProviders>["user"]) =>
        user.type(screen.getByLabelText("Code number"), "3")],
      ["the call letters", async (user: ReturnType<typeof renderWithProviders>["user"]) =>
        user.type(screen.getByLabelText(/call letters/i), "X")],
    ])(
      "clears the stale conflict banner once %s is edited",
      async (_label, edit) => {
        mockAddArtist(() => conflictResponse());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user);
        await user.click(screen.getByRole("button", { name: /add artist/i }));
        expect(await screen.findByRole("alert")).toHaveTextContent(`${MOLINA}12`);

        // Editing a field the server actually saw must drop the banner rather
        // than have it keep reporting the new, unsubmitted value as taken.
        await edit(user);

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      },
    );

    it("clears the stale conflict banner when the genre changes", async () => {
      mockGenres([
        { id: GENRE_ID, genre_name: "Rock" },
        { id: JAZZ_GENRE_ID, genre_name: "Jazz" },
      ]);
      mockAddArtist(() => conflictResponse());
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));
      expect(await screen.findByRole("alert")).toHaveTextContent(`${MOLINA}12`);

      // (code_letters, genre_id, code_number) is the uniqueness triple — a
      // code rejected under one genre may be free under another, so moving
      // genres must not leave the prior genre's rejection standing.
      await selectGenre(user, "Jazz");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    describe("call letters", () => {
      it("normalizes to uppercase on the wire and in the code preview", async () => {
        const { getQueries } = mockPeekCode();
        const { getBodies } = mockAddArtist(() => created());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user, "mo");

        // Both backend lookups keyed on call letters compare the column for
        // equality, and the catalog is filed uppercase: a lowercase value
        // would miss the duplicate check and preview a next code of 1.
        expect(screen.getByLabelText(/call letters/i)).toHaveValue(MOLINA);
        await waitFor(() =>
          expect(getQueries().at(-1)).toEqual({
            code_letters: MOLINA,
            genre_id: String(GENRE_ID),
          }),
        );

        await user.click(screen.getByRole("button", { name: /add artist/i }));

        await waitFor(() => expect(getBodies()).toHaveLength(1));
        expect(getBodies()[0]).toMatchObject({ code_letters: MOLINA });
      });

      it("caps typed input at the four characters the column holds and says so", async () => {
        const { getBodies } = mockAddArtist(() => created());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user, "molina");

        // artists.code_letters is a varchar(4) with no server-side guard: an
        // over-long value reaches PostgreSQL and returns a 500.
        expect(screen.getByLabelText(/call letters/i)).toHaveValue("MOLI");
        expect(screen.getByText(/up to 4 characters/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /add artist/i }));

        await waitFor(() => expect(getBodies()).toHaveLength(1));
        expect(getBodies()[0]).toMatchObject({ code_letters: "MOLI" });
      });

      it("blocks a value that arrives past the field's own cap", async () => {
        const { getBodies } = mockAddArtist(() => created());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user);
        // maxLength constrains typing and pasting, but not a programmatic set
        // (autofill, password managers) — so the ceiling is also checked before
        // submit rather than trusted to the field alone.
        fireEvent.change(screen.getByLabelText(/call letters/i), {
          target: { value: "MOLINA" },
        });

        expect(screen.getByText(/at most 4 characters/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();
        expect(getBodies()).toHaveLength(0);
      });
    });

    describe("the remaining column ceilings", () => {
      it.each([
        ["artist name", "Search artists...", 129],
        ["alphabetical name", "Defaults to artist name", 129],
      ])(
        "blocks an over-long %s before it reaches the varchar(128) column",
        async (_label, placeholder, length) => {
          const { getBodies } = mockAddArtist(() => created());
          const { user } = renderWithProviders(<ArtistAddForm />);

          await fillCoreFields(user);
          fireEvent.change(screen.getByPlaceholderText(placeholder), {
            target: { value: "Nilüfer".padEnd(length, "!") },
          });

          expect(screen.getAllByText(/at most 128 characters/i).length).toBeGreaterThan(0);
          expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();
          expect(getBodies()).toHaveLength(0);
        },
      );

      it("blocks a code number past the integer column's range", async () => {
        const { getBodies } = mockAddArtist(() => created());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await selectGenre(user);
        await user.type(
          await screen.findByPlaceholderText("Search artists..."),
          "Juana Molina",
        );
        await user.type(screen.getByLabelText(/call letters/i), MOLINA);
        // artist_genre_code is a PG int4; a larger value raises 22003 at bind
        // time in the duplicate pre-check, before anything is inserted.
        await user.type(screen.getByLabelText("Code number"), "2147483648");

        expect(screen.getByText(/no greater than 2147483647/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();
        expect(getBodies()).toHaveLength(0);
      });
    });

    describe("the call-letter preview", () => {
      it("previews the next code for the current call-letters/genre pair", async () => {
        const { getQueries } = mockPeekCode(() => 7);
        const { user } = renderWithProviders(<ArtistAddForm />);

        await selectGenre(user);
        await user.type(screen.getByLabelText(/call letters/i), MOLINA);

        expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");
        expect(screen.getByText("Next code:")).toBeInTheDocument();
        expect(getQueries()).toContainEqual({
          code_letters: MOLINA,
          genre_id: String(GENRE_ID),
        });
      });

      it("re-previews when the call letters change", async () => {
        mockPeekCode((code_letters) => (code_letters === MOLINA ? 7 : 3));
        const { user } = renderWithProviders(<ArtistAddForm />);

        await selectGenre(user);
        const codeLettersInput = screen.getByLabelText(/call letters/i);
        await user.type(codeLettersInput, MOLINA);
        expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");

        await user.clear(codeLettersInput);
        await user.type(codeLettersInput, STEREOLAB);

        await waitFor(() =>
          expect(screen.getByTestId("next-code-number")).toHaveTextContent("3"),
        );
      });
    });

    describe("duplicate protection", () => {
      it("blocks submission and surfaces a duplicate when an existing artist is picked from the typeahead", async () => {
        mockArtistSearch([
          { id: 12, artist_name: "Juana Molina", code_letters: MOLINA, code_number: 3 },
        ]);
        const { getBodies } = mockAddArtist(() => created());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await selectGenre(user);

        const nameInput = await screen.findByPlaceholderText("Search artists...");
        await user.type(nameInput, "Juana Molina");
        await user.click(await screen.findByText("Juana Molina"));

        await user.type(screen.getByLabelText(/call letters/i), MOLINA);
        await user.type(screen.getByLabelText("Code number"), "12");

        expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
        expect(getBodies()).toHaveLength(0);
      });

      it("keeps submission blocked when the genre changes after an existing artist was picked", async () => {
        mockGenres([
          { id: GENRE_ID, genre_name: "Rock" },
          { id: JAZZ_GENRE_ID, genre_name: "Jazz" },
        ]);
        const { getCallCount } = mockArtistSearch([
          { id: 12, artist_name: "Juana Molina", code_letters: MOLINA, code_number: 3 },
        ]);
        const { getBodies } = mockAddArtist(() => created());
        const { user, container } = renderWithProviders(<ArtistAddForm />);

        await selectGenre(user);
        const nameInput = await screen.findByPlaceholderText("Search artists...");
        await user.type(nameInput, "Juana Molina");
        await user.click(await screen.findByText("Juana Molina"));
        await user.type(screen.getByLabelText(/call letters/i), MOLINA);
        await user.type(screen.getByLabelText("Code number"), "12");
        expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();

        const searchesUnderRock = getCallCount();
        await selectGenre(user, "Jazz");

        // The typeahead retracts the held artist on a genre change but never
        // reopens its panel, so nothing checks this name under Jazz. Treating
        // the retraction as "new here" is how the form would create the very
        // duplicate the typeahead exists to prevent.
        expect(getCallCount()).toBe(searchesUnderRock);
        expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();
        expect(
          screen.getByText(/re-check this name under the new genre/i),
        ).toBeInTheDocument();

        // Submitting past the disabled button (Enter in a field, say) must hit
        // the same block rather than only the button's disabled state.
        fireEvent.submit(container.querySelector("form")!);
        expect(getBodies()).toHaveLength(0);
      });

      it("re-enables submission once the MD chooses to create the artist under the new genre", async () => {
        mockGenres([
          { id: GENRE_ID, genre_name: "Rock" },
          { id: JAZZ_GENRE_ID, genre_name: "Jazz" },
        ]);
        mockArtistSearch([]);
        const { getBodies } = mockAddArtist(() => created());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user);
        await selectGenre(user, "Jazz");
        expect(
          screen.getByText(/re-check this name under the new genre/i),
        ).toBeInTheDocument();

        // The "create new" row only renders once a search under the current
        // genre has settled with no match, so choosing it is the answer the
        // stale flag is waiting for.
        await user.click(screen.getByPlaceholderText("Search artists..."));
        await user.click(
          await screen.findByRole("option", {
            name: 'Create new artist "Juana Molina"',
          }),
        );

        expect(
          screen.queryByText(/re-check this name under the new genre/i),
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /add artist/i }));

        await waitFor(() => expect(getBodies()).toHaveLength(1));
        expect(getBodies()[0]).toMatchObject({ genre_id: JAZZ_GENRE_ID });
      });

      it("re-enables submission once the name itself is edited under the new genre", async () => {
        mockGenres([
          { id: GENRE_ID, genre_name: "Rock" },
          { id: JAZZ_GENRE_ID, genre_name: "Jazz" },
        ]);
        mockArtistSearch([]);
        mockAddArtist(() => created());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user);
        await selectGenre(user, "Jazz");
        expect(
          screen.getByText(/re-check this name under the new genre/i),
        ).toBeInTheDocument();

        // A different string is a different question — nothing about the old
        // genre's answer is left to be stale.
        await user.type(screen.getByPlaceholderText("Search artists..."), "!");

        expect(
          screen.queryByText(/re-check this name under the new genre/i),
        ).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /add artist/i })).toBeEnabled();
      });

      it("re-enables submission when the name is edited away from a picked artist", async () => {
        mockArtistSearch([
          { id: 12, artist_name: "Juana Molina", code_letters: MOLINA, code_number: 3 },
        ]);
        mockAddArtist(() => created());
        const { user } = renderWithProviders(<ArtistAddForm />);

        await selectGenre(user);
        const nameInput = await screen.findByPlaceholderText("Search artists...");
        await user.type(nameInput, "Juana Molina");
        await user.click(await screen.findByText("Juana Molina"));
        await user.type(screen.getByLabelText(/call letters/i), MOLINA);
        await user.type(screen.getByLabelText("Code number"), "12");
        expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();

        // The typeahead retracts the artist it reported once the text stops
        // naming it; the id it handed over is only good for that exact text.
        await user.type(nameInput, " Trio");

        await waitFor(() =>
          expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument(),
        );
        expect(screen.getByRole("button", { name: /add artist/i })).toBeEnabled();
      });
    });

    describe("failure handling", () => {
      it("shows exactly one toast carrying the server's message when the add fails", async () => {
        mockAddArtist(() =>
          HttpResponse.json({ message: "Artist could not be filed" }, { status: 500 }),
        );
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user);
        await user.click(screen.getByRole("button", { name: /add artist/i }));

        // The global rtkQueryErrorLogger middleware already toasts this; a
        // second unconditional toast here would stack two on one failure.
        await waitFor(() =>
          expect(toast.error).toHaveBeenCalledWith("Artist could not be filed"),
        );
        expect(toast.error).toHaveBeenCalledTimes(1);
      });

      it("shows exactly one fallback toast when the add fails with no server message", async () => {
        mockAddArtist(() => HttpResponse.json({ error: "rejected" }, { status: 500 }));
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user);
        await user.click(screen.getByRole("button", { name: /add artist/i }));

        await waitFor(() =>
          expect(toast.error).toHaveBeenCalledWith("Failed to add artist"),
        );
        expect(toast.error).toHaveBeenCalledTimes(1);
      });

      it("survives a 409 whose body carries no usable artist", async () => {
        mockAddArtist(() => conflictResponse({ artist: null }));
        const { user } = renderWithProviders(<ArtistAddForm />);

        await fillCoreFields(user);
        await user.click(screen.getByRole("button", { name: /add artist/i }));

        await waitFor(() =>
          expect(toast.error).toHaveBeenCalledWith("Failed to add artist"),
        );
        expect(toast.error).toHaveBeenCalledTimes(1);
        // Rendering the banner would dereference `artist.artist_name`; there is
        // no error boundary here, so a malformed 409 must not reach it.
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /add artist/i })).toBeInTheDocument();
      });

      it("explains a genres outage and offers a retry instead of an empty dropdown", async () => {
        let genreCalls = 0;
        server.use(
          http.get(`${TEST_BACKEND_URL}/library/genres`, () => {
            genreCalls += 1;
            return genreCalls === 1
              ? HttpResponse.json({ message: "genres unavailable" }, { status: 500 })
              : HttpResponse.json([{ id: GENRE_ID, genre_name: "Rock" }]);
          }),
        );
        const { user } = renderWithProviders(<ArtistAddForm />);

        // genre_id is required to submit, so an empty dropdown leaves the form
        // permanently un-submittable with nothing explaining why.
        expect(await screen.findByText(/genres are unavailable/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /try again/i }));

        await waitFor(() =>
          expect(screen.queryByText(/genres are unavailable/i)).not.toBeInTheDocument(),
        );
        await selectGenre(user);
        expect(await screen.findByPlaceholderText("Search artists...")).toBeEnabled();
      });
    });

    it("disables every field while the add is in flight", async () => {
      let release: () => void = () => {};
      const inFlight = new Promise<void>((resolve) => {
        release = resolve;
      });
      mockAddArtist(async () => {
        await inFlight;
        return created();
      });
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));

      // The success handler clears every field unconditionally; anything typed
      // during the request would be discarded with no signal.
      await waitFor(() =>
        expect(screen.getByLabelText("Code number")).toBeDisabled(),
      );
      expect(screen.getByLabelText(/call letters/i)).toBeDisabled();
      expect(screen.getByLabelText(/alphabetical name/i)).toBeDisabled();
      expect(screen.getByPlaceholderText("Search artists...")).toBeDisabled();
      expect(screen.getByRole("combobox", { name: /genre/i })).toBeDisabled();

      release();
      await waitFor(() =>
        expect(screen.getByLabelText("Code number")).toBeEnabled(),
      );
    });

    it("reuses parseRequiredPositiveInt to reject a non-numeric code number", async () => {
      mockAddArtist(() => created());
      const { user } = renderWithProviders(<ArtistAddForm />);

      await selectGenre(user);

      const nameInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(nameInput, "Juana Molina");
      await user.type(screen.getByLabelText(/call letters/i), MOLINA);
      await user.type(screen.getByLabelText("Code number"), "abc");

      expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();
    });
  });
});
