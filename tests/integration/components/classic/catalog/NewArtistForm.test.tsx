import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { catalogApi } from "@/lib/features/catalog/api";

// The real better-auth client installs listeners whose teardown is deferred a
// second past the last subscriber; a short file finishes inside that second.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  // The shared mock leaves the session unauthenticated (getJWTToken resolves
  // null), which silently drops the Authorization header from every request
  // this file makes; resolve a token so the authenticated request path stays
  // exercised.
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

import NewArtistForm from "@/src/components/experiences/classic/catalog/NewArtistForm";

const GENRE_ID = 3;
const JAZZ_GENRE_ID = 7;

function mockGenres(
  genres: { id: number; genre_name: string }[] = [
    { id: GENRE_ID, genre_name: "Blues" },
    { id: JAZZ_GENRE_ID, genre_name: "Jazz" },
  ],
) {
  server.use(http.get(`${TEST_BACKEND_URL}/library/genres`, () => HttpResponse.json(genres)));
}

function mockPeekCode(next_code_number = 7) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () =>
      HttpResponse.json({ next_code_number }),
    ),
  );
}

/** Answers per genre_id, so a genre switch is distinguishable in the preview. */
function mockPeekCodeByGenre(answers: Record<number, number>) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, ({ request }) => {
      const genreId = Number(new URL(request.url).searchParams.get("genre_id"));
      return HttpResponse.json({ next_code_number: answers[genreId] ?? 0 });
    }),
  );
}

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
      code_letters: "MO",
      code_number: 12,
      genre_id: GENRE_ID,
      ...overrides,
    },
    { status: 201 },
  );
}

async function selectGenre(user: ReturnType<typeof renderWithProviders>["user"], name = "Blues") {
  await screen.findByRole("option", { name });
  await user.selectOptions(screen.getByLabelText(/genre/i), name);
}

describe("classic NewArtistForm — chooseLibraryCodeOrArtist.jsp's newArtistForm", () => {
  beforeEach(() => {
    mockGenres();
    mockPeekCode();
  });

  it("renders tubafrenzy's field order and labels", async () => {
    renderWithProviders(<NewArtistForm />);

    expect(
      await screen.findByText(/create a brand new artist with no specific library code information/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/artist presentation name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist alphabetical name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset values" })).toBeInTheDocument();
  });

  it("shows the JSP's exact validation message when the presentation name is empty", async () => {
    const { user } = renderWithProviders(<NewArtistForm />);
    await selectGenre(user);
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The presentation name cannot be empty.")).toBeInTheDocument();
  });

  it("shows the JSP's exact validation message when the alphabetical name is empty", async () => {
    const { user } = renderWithProviders(<NewArtistForm />);
    await selectGenre(user);
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The alphabetical name cannot be empty.")).toBeInTheDocument();
  });

  it("submits POST /library/artists end to end with the typed fields", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toEqual({
      artist_name: "Juana Molina",
      alphabetical_name: "Molina, Juana",
      code_letters: "MO",
      genre_id: GENRE_ID,
      code_number: 12,
    });
  });

  it("previews the next code number for the typed call letters/genre pair", async () => {
    mockPeekCode(7);
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/call letters/i), "MO");

    expect(await screen.findByText(/next code:\s*7/i)).toBeInTheDocument();
  });

  it("does not keep the previous genre's preview number standing across a genre change", async () => {
    mockPeekCodeByGenre({ [GENRE_ID]: 7, [JAZZ_GENRE_ID]: 3 });
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user, "Blues");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    expect(await screen.findByText(/next code:\s*7/i)).toBeInTheDocument();

    // Switching genres alone (letters untouched) must invalidate the stale
    // preview rather than keep showing Blues' number under Jazz.
    await selectGenre(user, "Jazz");
    expect(screen.queryByText(/next code:\s*7/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/next code:\s*3/i)).toBeInTheDocument();
  });

  it("confirms the assigned code from the server response after submit", async () => {
    mockAddArtist(() => created({ code_letters: "MO", code_number: 12 }));
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/Added as MO12/i)).toBeInTheDocument();
  });

  it("shows the code-conflict message on a 409 naming the artist_code_conflict reason", async () => {
    mockAddArtist(() =>
      HttpResponse.json(
        {
          message: "Artist code already exists for that genre and code letters.",
          reason: "artist_code_conflict",
          artist: { artist_id: 1, artist_name: "Stereolab", code_letters: "MO" },
        },
        { status: 409 },
      ),
    );
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Stereolab already holds that library code."),
    ).toBeInTheDocument();
  });

  it("shows a distinct name-conflict message, steering to the existing artist rather than the code, on a 409 naming the artist_name_conflict reason", async () => {
    mockAddArtist(() =>
      HttpResponse.json(
        {
          message: "Artist name already exists in that genre.",
          reason: "artist_name_conflict",
          artist: { artist_id: 2, artist_name: "Juana Molina", code_letters: "MO" },
        },
        { status: 409 },
      ),
    );
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText(
        "Juana Molina already exists in this genre. File under the existing artist instead of picking a different code.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/already holds that library code/i)).not.toBeInTheDocument();
  });

  it("falls back without crashing on a 409 body with no artist", async () => {
    mockAddArtist(() => HttpResponse.json({ message: "Conflict" }, { status: 409 }));
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Failed to add artist.")).toBeInTheDocument();
  });

  it("shows the generic fallback message on a 5xx", async () => {
    mockAddArtist(() => HttpResponse.json({ message: "Internal error" }, { status: 500 }));
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Failed to add artist.")).toBeInTheDocument();
  });

  describe("genre outage", () => {
    it("explains a genres outage and offers a retry instead of an empty dropdown", async () => {
      let genreCalls = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () => {
          genreCalls += 1;
          return genreCalls === 1
            ? HttpResponse.json({ message: "genres unavailable" }, { status: 500 })
            : HttpResponse.json([{ id: GENRE_ID, genre_name: "Blues" }]);
        }),
      );
      const { user } = renderWithProviders(<NewArtistForm />);

      // genre_id is required to submit, so an empty dropdown leaves the form
      // permanently un-submittable with nothing explaining why.
      expect(await screen.findByText(/genres are unavailable/i)).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Blues" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /try again/i }));

      await waitFor(() =>
        expect(screen.queryByText(/genres are unavailable/i)).not.toBeInTheDocument(),
      );
      expect(await screen.findByRole("option", { name: "Blues" })).toBeInTheDocument();
    });

    it("keeps filing against the last good genre list when a refetch fails", async () => {
      let genreCalls = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () => {
          genreCalls += 1;
          return genreCalls === 1
            ? HttpResponse.json([{ id: GENRE_ID, genre_name: "Blues" }])
            : HttpResponse.json({ message: "genres unavailable" }, { status: 500 });
        }),
      );
      const { getBodies } = mockAddArtist(() => created());
      const { user, store } = renderWithProviders(<NewArtistForm />);

      await selectGenre(user);

      // Adding a genre elsewhere invalidates this list; if that refetch
      // rejects, the cached list is still there and every one of its genres
      // is still fileable. Claiming an outage would show a "can't be filed
      // right now" message beside a submit that works.
      store.dispatch(
        catalogApi.util.invalidateTags([{ type: "GenreList", id: "LIST" }]),
      );
      // `genreCalls` reaching 2 only proves MSW entered the handler; the
      // rejection lands afterwards. Wait for it to settle in the cache so the
      // no-alert assertion observes the post-rejection render instead of
      // winning a race against it.
      await waitFor(() => expect(genreCalls).toBe(2));
      await waitFor(() =>
        expect(
          catalogApi.endpoints.getGenres.select()(store.getState()).isError,
        ).toBe(true),
      );

      expect(screen.queryByText(/genres are unavailable/i)).not.toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Blues" })).toBeInTheDocument();

      await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
      await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
      await user.type(screen.getByLabelText(/call letters/i), "MO");
      await user.type(screen.getByLabelText(/call numbers/i), "12");
      await user.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(getBodies()).toHaveLength(1));
      expect(getBodies()[0]).toMatchObject({ genre_id: GENRE_ID });
    });

    it("flips to unavailable when a non-JSON refetch replaces the cached list, refuses the submit, and recovers", async () => {
      let genreCalls = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () => {
          genreCalls += 1;
          // Call 2 is the refetch: an HTML error page, which the shared base
          // query soft-fails into a fulfilled `{ data: null }` that replaces
          // the cached list — unlike the JSON 500 above, which keeps it.
          if (genreCalls === 2) {
            return new HttpResponse(
              "<!DOCTYPE html><html><body>Bad Gateway</body></html>",
              { status: 502, headers: { "Content-Type": "text/html" } },
            );
          }
          return HttpResponse.json([{ id: GENRE_ID, genre_name: "Blues" }]);
        }),
      );
      const { getBodies } = mockAddArtist(() => created());
      const { user, store } = renderWithProviders(<NewArtistForm />);

      await selectGenre(user);
      await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
      await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
      await user.type(screen.getByLabelText(/call letters/i), "MO");
      await user.type(screen.getByLabelText(/call numbers/i), "12");

      store.dispatch(
        catalogApi.util.invalidateTags([{ type: "GenreList", id: "LIST" }]),
      );
      expect(await screen.findByText(/genres are unavailable/i)).toBeInTheDocument();

      // `genreId` still holds the vanished list's selection, so submitting
      // now would file under a genre the form has stopped displaying. The
      // refusal must not add a second copy of the sentence: the inline alert
      // is the one announcement, and it alone must clear on recovery.
      await user.click(screen.getByRole("button", { name: "Submit" }));
      expect(screen.getAllByText(/genres are unavailable/i)).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: /try again/i }));
      await waitFor(() =>
        expect(screen.queryByText(/genres are unavailable/i)).not.toBeInTheDocument(),
      );
      expect(await screen.findByRole("option", { name: "Blues" })).toBeInTheDocument();

      // Exactly one POST reaches the backend: the recovered submit. Had the
      // refused submit fired anyway, its body would have been recorded long
      // before this one.
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(getBodies()).toHaveLength(1));
      expect(getBodies()[0]).toMatchObject({ genre_id: GENRE_ID });
    });
  });

  it("resets every field back to empty on Reset values", async () => {
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");

    await user.click(screen.getByRole("button", { name: "Reset values" }));

    expect(screen.getByLabelText(/artist presentation name/i)).toHaveValue("");
    expect(screen.getByLabelText(/artist alphabetical name/i)).toHaveValue("");
    expect(screen.getByLabelText(/call letters/i)).toHaveValue("");
    expect(screen.getByLabelText(/call numbers/i)).toHaveValue("");
  });
});
