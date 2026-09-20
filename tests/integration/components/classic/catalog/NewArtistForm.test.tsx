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

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import NewArtistForm from "@/src/components/experiences/classic/catalog/NewArtistForm";

const GENRE_ID = 3;
const JAZZ_GENRE_ID = 7;
/** What `mockPeekCode()` answers, and so what the form seeds the field with. */
const SEEDED_CODE = 7;

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

/**
 * Waits for the form to fill the call-numbers field from `peek-code`. A submit
 * before this point is a submit with no code number at all -- the field is the
 * only place the number lives, so the debounce-plus-fetch window has to close
 * before the form is complete.
 */
async function awaitSeededCodeNumber() {
  await waitFor(() =>
    expect(screen.getByLabelText(/call numbers/i)).toHaveValue(String(SEEDED_CODE)),
  );
}

/**
 * Overrides the number the form filled in, by the gesture a librarian actually
 * has: click into the field and type. The filled-in value is selected on
 * focus, so the typing replaces it.
 *
 * Deliberately NOT `user.clear()` first. An emptied field falls back to the
 * peeked number, so clearing is how he asks for the default back -- it is not
 * an override, and a helper that cleared would assert nothing about one.
 */
async function overwriteCodeNumber(
  user: ReturnType<typeof renderWithProviders>["user"],
  value: string,
) {
  await awaitSeededCodeNumber();
  // `type` already clicks before typing. Clicking separately first would issue
  // a second click, which collapses the selection the focus handler made and
  // turns the gesture into an append -- the very bug this guards.
  await user.type(screen.getByLabelText(/call numbers/i), value);
}

describe("classic NewArtistForm — chooseLibraryCodeOrArtist.jsp's newArtistForm", () => {
  beforeEach(() => {
    mockPush.mockClear();
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
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The presentation name cannot be empty.")).toBeInTheDocument();
  });

  it("shows the JSP's exact validation message when the alphabetical name is empty", async () => {
    const { user } = renderWithProviders(<NewArtistForm />);
    await selectGenre(user);
    await user.type(screen.getByLabelText(/call letters/i), "MO");
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
    await overwriteCodeNumber(user, "12");

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

  // Pasted, not typed: userEvent enforces an input's own `maxLength` on both
  // keystrokes and paste, so a paste this long is what would expose a
  // `maxLength` silently clipping the value back under the ceiling -- the
  // regression this pins. The field carries no such attribute any more.
  it("refuses call letters past the cap rather than silently truncating them", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    const field = screen.getByLabelText(/call letters/i);
    await user.click(field);
    await user.paste("molina");

    // Uppercased in full, not clipped to the column's four characters: a
    // `maxLength` attribute would have silently dropped the paste's last two
    // characters here and let the submit below write the wrong code.
    expect(field).toHaveValue("MOLINA");
    expect(screen.getByText("At most 4 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(getBodies()).toHaveLength(0);
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

  // `mode=addArtistLibraryCode` (`chooseLibraryCodeOrArtist.jsp:62`) is the
  // same handler `createLibraryCode.jsp` submits to, and it lands on the new
  // artist's card carrying the servlet's create confirmation
  // (`ArtistAdminServlet:188`) rather than confirming in place.
  it("lands on the new artist's card after submit", async () => {
    mockAddArtist(() => created({ id: 99, code_letters: "MO", code_number: 12 }));
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await awaitSeededCodeNumber();
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/library/artist/99?created=1"),
    );
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
    await awaitSeededCodeNumber();
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
    await awaitSeededCodeNumber();
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
    await awaitSeededCodeNumber();
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
    await awaitSeededCodeNumber();
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
      await awaitSeededCodeNumber();
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
      await awaitSeededCodeNumber();

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
    await overwriteCodeNumber(user, "12");

    await user.click(screen.getByRole("button", { name: "Reset values" }));

    expect(screen.getByLabelText(/artist presentation name/i)).toHaveValue("");
    expect(screen.getByLabelText(/artist alphabetical name/i)).toHaveValue("");
    expect(screen.getByLabelText(/call letters/i)).toHaveValue("");
    expect(screen.getByLabelText(/call numbers/i)).toHaveValue("");
  });
});

/**
 * The next free code number in a series is not something a librarian can
 * derive at the desk — it is a fact only the catalog holds — so a form that
 * knows it and shows it beside the field, while filing whatever the field
 * happens to contain, leaves him copying the number in by hand or reading it
 * off paper. The peeked number has to be the field's value, so that leaving
 * the field alone files the next free code.
 */
describe("classic NewArtistForm — the peeked next code fills the field", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGenres();
    mockPeekCode();
  });

  it("files the peeked number when the librarian leaves the field alone", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Jessica Pratt");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Pratt, Jessica");
    await user.type(screen.getByLabelText(/call letters/i), "PR");

    await waitFor(() =>
      expect(screen.getByLabelText(/call numbers/i)).toHaveValue(String(SEEDED_CODE)),
    );

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toMatchObject({ code_letters: "PR", code_number: SEEDED_CODE });
  });

  it("never displaces a hand-typed number with a later-arriving peek", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Jessica Pratt");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Pratt, Jessica");
    // Typed before the call letters arm the lookup at all, so the answer is
    // guaranteed to land after the typing rather than racing it.
    await user.type(screen.getByLabelText(/call numbers/i), "412");
    await user.type(screen.getByLabelText(/call letters/i), "PR");

    expect(await screen.findByText(/next code:\s*7/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/call numbers/i)).toHaveValue("412");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toMatchObject({ code_number: 412 });
  });

  it("re-seeds with the new series' number when the genre changes", async () => {
    mockPeekCodeByGenre({ [GENRE_ID]: 7, [JAZZ_GENRE_ID]: 3 });
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user, "Blues");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Jessica Pratt");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Pratt, Jessica");
    await user.type(screen.getByLabelText(/call letters/i), "PR");
    await waitFor(() => expect(screen.getByLabelText(/call numbers/i)).toHaveValue("7"));

    // A genre change selects a different code series, so Blues' number is not
    // merely stale here -- filing it under Jazz would take a code that series
    // has already issued.
    await selectGenre(user, "Jazz");
    await waitFor(() => expect(screen.getByLabelText(/call numbers/i)).toHaveValue("3"));

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toMatchObject({ genre_id: JAZZ_GENRE_ID, code_number: 3 });
  });

  it("empties the field rather than standing the previous series' number in it while the next answer is outstanding", async () => {
    let jazzRequests = 0;
    let releaseJazz!: () => void;
    const jazzAnswer = new Promise<void>((resolve) => {
      releaseJazz = resolve;
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, async ({ request }) => {
        const genreId = Number(new URL(request.url).searchParams.get("genre_id"));
        if (genreId !== JAZZ_GENRE_ID) {
          return HttpResponse.json({ next_code_number: 7 });
        }
        jazzRequests += 1;
        await jazzAnswer;
        return HttpResponse.json({ next_code_number: 3 });
      }),
    );
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user, "Blues");
    await user.type(screen.getByLabelText(/call letters/i), "PR");
    await waitFor(() => expect(screen.getByLabelText(/call numbers/i)).toHaveValue("7"));

    await selectGenre(user, "Jazz");
    await waitFor(() => expect(jazzRequests).toBe(1));

    // In flight: the field the submit reads must not carry a number belonging
    // to a series the form has stopped naming.
    expect(screen.getByLabelText(/call numbers/i)).toHaveValue("");

    releaseJazz();
    await waitFor(() => expect(screen.getByLabelText(/call numbers/i)).toHaveValue("3"));
  });

  it("leaves the field empty, and the existing validation standing, when peek-code answers with no number", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () => HttpResponse.json({})),
    );
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Jessica Pratt");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Pratt, Jessica");
    await user.type(screen.getByLabelText(/call letters/i), "PR");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("You must enter a code number.")).toBeInTheDocument();
    expect(screen.getByLabelText(/call numbers/i)).toHaveValue("");
    expect(getBodies()).toHaveLength(0);
  });
});

/**
 * A field the form fills in needs a working story for overriding it. The
 * gesture a librarian has is the one any pre-filled box invites: click in and
 * type. Nothing here is reachable by clearing first -- an emptied field asks
 * for the default back, which is the opposite of an override.
 */
describe("classic NewArtistForm — overriding the number the form filled in", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGenres();
    mockPeekCode();
  });

  it("replaces the filled-in number when he types over it, rather than appending to it", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Jessica Pratt");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Pratt, Jessica");
    await user.type(screen.getByLabelText(/call letters/i), "PR");
    await awaitSeededCodeNumber();

    await user.type(screen.getByLabelText(/call numbers/i), "12");

    // Appending would leave "712", which `size={3}` renders as a perfectly
    // plausible call number -- a wrong code filed with nothing looking wrong.
    expect(screen.getByLabelText(/call numbers/i)).toHaveValue("12");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toMatchObject({ code_number: 12 });
  });

  it("leaves a number he typed alone when he clicks back in to correct a digit", async () => {
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/call letters/i), "PR");
    await overwriteCodeNumber(user, "41");

    // Leave the field, then come back to it: re-entering a number he owns must
    // not select it, or amending one digit would wipe the lot.
    await user.click(screen.getByLabelText(/call letters/i));
    await user.type(screen.getByLabelText(/call numbers/i), "2");

    expect(screen.getByLabelText(/call numbers/i)).toHaveValue("412");
  });

  it("gives the next free number back when he empties the field", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Jessica Pratt");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Pratt, Jessica");
    await user.type(screen.getByLabelText(/call letters/i), "PR");
    await overwriteCodeNumber(user, "412");

    // Clear-and-retype is the other gesture a pre-filled box invites, and the
    // empty moment in the middle of it must not be read as his answer -- doing
    // so would leave the form unable to file anything until reloaded, which is
    // the defect the autofill exists to remove.
    await user.clear(screen.getByLabelText(/call numbers/i));
    await waitFor(() =>
      expect(screen.getByLabelText(/call numbers/i)).toHaveValue(String(SEEDED_CODE)),
    );

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toMatchObject({ code_number: SEEDED_CODE });
  });
});

describe("classic NewArtistForm — a submit that lands inside the lookup window", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGenres();
  });

  it("waits for the number it undertook to supply instead of reporting his omission", async () => {
    let peekRequests = 0;
    let answerPeek!: () => void;
    const peekAnswer = new Promise<void>((resolve) => {
      answerPeek = resolve;
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, async () => {
        peekRequests += 1;
        await peekAnswer;
        return HttpResponse.json({ next_code_number: SEEDED_CODE });
      }),
    );
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Jessica Pratt");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Pratt, Jessica");
    await user.type(screen.getByLabelText(/call letters/i), "PR");
    await waitFor(() => expect(peekRequests).toBe(1));

    await user.click(screen.getByRole("button", { name: "Submit" }));

    // The number is outstanding because the form went to fetch it, not because
    // he left the field blank; saying so blames him for the form's own work.
    expect(screen.queryByText("You must enter a code number.")).not.toBeInTheDocument();

    answerPeek();
    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toMatchObject({ code_letters: "PR", code_number: SEEDED_CODE });
  });

  it("retracts the missing-number message as soon as a number is in the field", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () => HttpResponse.json({})),
    );
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Jessica Pratt");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Pratt, Jessica");
    await user.type(screen.getByLabelText(/call letters/i), "PR");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("You must enter a code number.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/call numbers/i), "412");

    // Standing red over a number that is now correct, until the next submit
    // re-runs validation, tells him the field is still wrong when it is not.
    await waitFor(() =>
      expect(screen.queryByText("You must enter a code number.")).not.toBeInTheDocument(),
    );
  });
});
