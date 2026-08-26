import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

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

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockOnMultiMatch = vi.fn();

import ArtistSearchForm from "@/src/components/experiences/classic/catalog/ArtistSearchForm";

const ROCK_GENRE_ID = 11;
const SOUNDTRACKS_GENRE_ID = 12;
const BLUES_GENRE_ID = 3;
const BY_CODE_URL = `${TEST_BACKEND_URL}/library/artists/by-code`;

function mockGenres() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([
        { id: BLUES_GENRE_ID, genre_name: "Blues" },
        { id: ROCK_GENRE_ID, genre_name: "Rock" },
        { id: SOUNDTRACKS_GENRE_ID, genre_name: "Soundtracks" },
      ]),
    ),
  );
}

async function selectGenre(user: ReturnType<typeof renderWithProviders>["user"], name: string) {
  await screen.findByRole("option", { name });
  await user.selectOptions(screen.getByLabelText(/^genre/i), name);
}

async function fillTextboxCode(
  user: ReturnType<typeof renderWithProviders>["user"],
  letters: string,
  numbers: string,
) {
  await user.click(screen.getByRole("radio", { name: /call letters:/i }));
  await user.type(screen.getByLabelText("Call letters:"), letters);
  await user.type(screen.getByLabelText(/call numbers:/i), numbers);
}

describe("classic ArtistSearchForm — chooseLibraryCodeOrArtist.jsp's artistSearchForm", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockOnMultiMatch.mockClear();
    mockGenres();
  });

  it("renders the JSP's copy, radio modes, and button labels", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    expect(
      await screen.findByText(/enter a library code below\. if the code exists/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/if the code does not exist, you will get the chance/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Call letters:")).toBeInTheDocument();
    expect(screen.getByLabelText(/call numbers:/i)).toBeInTheDocument();
    expect(screen.getByText(/various artists \(compilations\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset values" })).toBeInTheDocument();

    // The label is reproduced verbatim, including its incompleteness: it
    // names only Rock comps even though the validator also gates genre 12.
    // Only rendered once genre 11/12 is paired with the compilation radio,
    // matching the JSP's own `checkForRockComps()` gating.
    await selectGenre(user, "Rock");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    expect(screen.getByText(/\(rock comps require a call letter\)/i)).toBeInTheDocument();
  });

  it("disables the genre select until genres load, then defaults it to the first genre with no placeholder option", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    expect(screen.getByLabelText(/^genre/i)).toBeDisabled();

    await screen.findByRole("option", { name: "Blues" });

    await waitFor(() =>
      expect(screen.getByLabelText(/^genre/i)).toHaveValue(String(BLUES_GENRE_ID)),
    );
    expect(screen.getByLabelText(/^genre/i)).toBeEnabled();
    expect(screen.queryByRole("option", { name: /select genre/i })).not.toBeInTheDocument();

    // The <select>'s own displayed value above proves nothing about
    // `genreId` itself: a single-line <select> with no option explicitly
    // selected auto-selects its first option in the DOM regardless of React
    // state, and jsdom implements that. Prove the default reached state, not
    // just the rendered element, by submitting compilation mode without ever
    // touching the select — if `genreId` were still null, this would fail
    // with "You must select a genre." instead of passing clean.
    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(screen.queryByText("You must select a genre.")).not.toBeInTheDocument();
  });

  it("disables the letters/numbers textboxes until the textbox radio is chosen", async () => {
    renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    expect(screen.getByLabelText("Call letters:")).toBeDisabled();
    expect(screen.getByLabelText(/call numbers:/i)).toBeDisabled();
  });

  it("enables the letters/numbers textboxes once the textbox radio is chosen", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await user.click(screen.getByRole("radio", { name: /call letters:/i }));

    expect(screen.getByLabelText("Call letters:")).toBeEnabled();
    expect(screen.getByLabelText(/call numbers:/i)).toBeEnabled();
  });

  it("shows the rockCompLetters field only for genre 11 or 12 under the compilation radio", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Blues");

    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    expect(screen.queryByLabelText(/rock comp/i)).not.toBeInTheDocument();

    await selectGenre(user, "Rock");
    expect(screen.getByLabelText(/rock comp/i)).toBeInTheDocument();

    await selectGenre(user, "Soundtracks");
    expect(screen.getByLabelText(/rock comp/i)).toBeInTheDocument();
  });

  it("shows the exact validation message when no radio is selected on submit", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("You must select one of the choices for Call Letters/Numbers."),
    ).toBeInTheDocument();
  });

  it("shows the exact validation message for empty artist letters in textbox mode", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await user.click(screen.getByRole("radio", { name: /call letters:/i }));
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(await screen.findByText("You must enter artist letters.")).toBeInTheDocument();
  });

  it("shows the exact Rock message for genre 11 with an empty rockCompLetters field", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Rock");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));

    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("Rock compilations require an additional letter field."),
    ).toBeInTheDocument();
  });

  it("shows the exact Soundtracks message for genre 12 with an empty rockCompLetters field", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Soundtracks");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));

    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("Soundtracks require an additional letter field."),
    ).toBeInTheDocument();
  });

  it("passes validation for the compilation radio under a non Rock/Soundtracks genre with no rockCompLetters", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Blues");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));

    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      screen.queryByText("You must select one of the choices for Call Letters/Numbers."),
    ).not.toBeInTheDocument();
  });

  it("looks up a fully specified code and lands on the single owner's card", async () => {
    server.use(
      http.get(BY_CODE_URL, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("genre_id")).toBe(String(ROCK_GENRE_ID));
        expect(url.searchParams.get("code_letters")).toBe("MO");
        expect(url.searchParams.get("code_number")).toBe("12");
        return HttpResponse.json({
          artists: [
            { id: 99, artist_name: "Juana Molina", code_letters: "MO", code_number: 12, genre_id: ROCK_GENRE_ID },
          ],
        });
      }),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Rock");

    await fillTextboxCode(user, "MO", "12");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/library/artist/99"));
  });

  // 0 is a legitimate call number (the Various Artists filing, and no floor
  // above 0 for an ordinary code either) -- not an empty field.
  it("accepts a call number of 0 in textbox mode", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({
          artists: [{ id: 5, artist_name: "Unknown", code_letters: "UNK", code_number: 0, genre_id: BLUES_GENRE_ID }],
        }),
      ),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await fillTextboxCode(user, "UNK", "0");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/library/artist/5"));
  });

  it("routes a code_not_assigned miss to the creation flow, carrying the searched code", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json(
          { message: "Artist code not assigned in that genre", reason: "code_not_assigned" },
          { status: 404 },
        ),
      ),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Rock");

    await fillTextboxCode(user, "MO", "12");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        `/dashboard/library/artist/new?genre_id=${ROCK_GENRE_ID}&code_letters=MO&code_number=12`,
      ),
    );
  });

  // Every Various Artists bucket is filed at code_number 0 under the literal
  // code_letters "V/A" -- the rockCompLetters sub-bucket letter, still
  // collected and validated for JSP parity, plays no part in the composed
  // query (see composeLibraryCodeSearchArgs).
  it("searches the compilation radio as V/A, 0 for the selected genre", async () => {
    server.use(
      http.get(BY_CODE_URL, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("code_letters")).toBe("V/A");
        expect(url.searchParams.get("code_number")).toBe("0");
        return HttpResponse.json(
          { message: "Artist code not assigned in that genre", reason: "code_not_assigned" },
          { status: 404 },
        );
      }),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Soundtracks");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    await user.type(screen.getByLabelText(/rock comp/i), "K");

    await user.click(screen.getByRole("button", { name: "Search!" }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        `/dashboard/library/artist/new?genre_id=${SOUNDTRACKS_GENRE_ID}&code_letters=V%2FA&code_number=0`,
      ),
    );
  });

  it("hands a multi-owner match to onMultiMatch instead of navigating", async () => {
    const owners = [
      { id: 1, artist_name: "Various Artists - Rock - A", code_letters: "V/A", code_number: 0, genre_id: ROCK_GENRE_ID },
      { id: 2, artist_name: "Various Artists - Rock - B", code_letters: "V/A", code_number: 0, genre_id: ROCK_GENRE_ID },
    ];
    server.use(http.get(BY_CODE_URL, () => HttpResponse.json({ artists: owners })));
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Rock");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    await user.type(screen.getByLabelText(/rock comp/i), "A");

    await user.click(screen.getByRole("button", { name: "Search!" }));

    await waitFor(() =>
      expect(mockOnMultiMatch).toHaveBeenCalledWith({
        genreName: "Rock",
        codeLetters: "V/A",
        codeNumber: 0,
        artists: owners,
      }),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("distinguishes an unknown genre from an unassigned code, refusing to navigate", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({ message: "Genre not found", reason: "genre_not_found" }, { status: 404 }),
      ),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Rock");

    await fillTextboxCode(user, "MO", "12");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText(`No genre in the catalog has id ${ROCK_GENRE_ID}, so this code can't be looked up.`),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // A backend outage must never be reported as "unassigned" -- that would
  // walk the librarian into creating a duplicate of a code that already
  // exists.
  it.each([
    ["a structured 500", () => HttpResponse.json({ message: "boom" }, { status: 500 })],
    [
      "a non-JSON gateway error",
      () =>
        new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    ],
  ])("refuses to act on %s rather than treating it as unassigned", async (_name, respond) => {
    server.use(http.get(BY_CODE_URL, respond));
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Rock");

    await fillTextboxCode(user, "MO", "12");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("Couldn't check whether this code exists right now. Try again."),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // The contract makes an empty 200 impossible -- an unassigned code is a 404
  // carrying code_not_assigned. If one arrives anyway the answer cannot be
  // trusted, so it is refused: routing to the creation flow would file a
  // duplicate, and the disambiguation screen would claim the code exists with
  // nobody holding it.
  it.each([
    ["an empty owner list", { artists: [] }],
    ["a body missing the owner list", {}],
  ])("refuses %s rather than routing anywhere", async (_name, body) => {
    server.use(http.get(BY_CODE_URL, () => HttpResponse.json(body)));
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Rock");

    await fillTextboxCode(user, "MO", "12");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("Couldn't check whether this code exists right now. Try again."),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockOnMultiMatch).not.toHaveBeenCalled();
  });

  // A code the endpoint's charset rule would 400 on is refused here, naming
  // the field. Left to the backend it comes back as the unstructured-failure
  // branch, whose wording invites a retry that can never succeed.
  it("refuses call letters outside the code column's charset without calling the resolver", async () => {
    let byCodeCalls = 0;
    server.use(
      http.get(BY_CODE_URL, () => {
        byCodeCalls += 1;
        return HttpResponse.json({ artists: [] });
      }),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);
    await selectGenre(user, "Rock");

    await fillTextboxCode(user, "?!", "12");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("Call letters must be letters, digits, or a slash."),
    ).toBeInTheDocument();
    expect(byCodeCalls).toBe(0);
    expect(mockPush).not.toHaveBeenCalled();
  });

  // The JSP's own client validator never checks the call number field --
  // resolveArtistByCode requires one, so a blank value is refused only once
  // the JSP-parity rules above have already passed.
  it("asks for a call number when textbox mode is submitted with one blank", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await user.click(screen.getByRole("radio", { name: /call letters:/i }));
    await user.type(screen.getByLabelText("Call letters:"), "MO");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("You must enter a call number to look up this code."),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // The JSP's own client-side validator (library-code-form.js) reads only
  // artistLettersTextbox for the textbox branch, never genreID. A submit
  // landing inside the client-side genre fetch's window therefore passes that
  // JSP-parity validation with genreId still null; the guard against reaching
  // the resolver genre-less lives at the composition step
  // (composeLibraryCodeSearchArgs), not in the shared validator, so it fires
  // here too.
  it("refuses a textbox submit that lands before genres have loaded, without calling the resolver", async () => {
    let byCodeCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/genres`, async () => {
        await delay(50);
        return HttpResponse.json([{ id: BLUES_GENRE_ID, genre_name: "Blues" }]);
      }),
      http.get(BY_CODE_URL, () => {
        byCodeCalls += 1;
        return HttpResponse.json({ artists: [] });
      }),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await fillTextboxCode(user, "MO", "12");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(await screen.findByText("You must select a genre.")).toBeInTheDocument();
    expect(byCodeCalls).toBe(0);
    expect(mockPush).not.toHaveBeenCalled();
  });

  describe("genre outage", () => {
    // The outage owns the message. Neither the select's own JSP-parity rule
    // ("You must select a genre") nor a second copy of the banner may stand
    // in for it: one blames the librarian for a backend that is down, the
    // other says the same thing twice.
    it("disables the search and refuses the submit without blaming the librarian", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
          HttpResponse.json({ message: "genres unavailable" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

      expect(await screen.findByText(/genres are unavailable/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^genre/i)).toBeDisabled();
      expect(screen.getByRole("button", { name: "Search!" })).toBeDisabled();

      await user.click(screen.getByRole("radio", { name: /various artists/i }));
      await user.click(screen.getByRole("button", { name: "Search!" }));

      expect(screen.getAllByText(/genres are unavailable/i)).toHaveLength(1);
      expect(screen.queryByText("You must select a genre.")).not.toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("recovers via Try again once genres are reachable", async () => {
      let genreCalls = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () => {
          genreCalls += 1;
          return genreCalls === 1
            ? HttpResponse.json({ message: "genres unavailable" }, { status: 500 })
            : HttpResponse.json([{ id: BLUES_GENRE_ID, genre_name: "Blues" }]);
        }),
      );
      const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

      expect(await screen.findByText(/genres are unavailable/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /try again/i }));

      await waitFor(() =>
        expect(screen.queryByText(/genres are unavailable/i)).not.toBeInTheDocument(),
      );
      expect(screen.getByLabelText(/^genre/i)).toBeEnabled();
    });
  });

  it("resets the mode and fields, including the genre back to its default, on Reset values", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await selectGenre(user, "Rock");
    await user.click(screen.getByRole("radio", { name: /call letters:/i }));
    await user.type(screen.getByLabelText("Call letters:"), "MO");
    await user.type(screen.getByLabelText(/call numbers:/i), "12");

    await user.click(screen.getByRole("button", { name: "Reset values" }));

    expect(screen.getByRole("radio", { name: /call letters:/i })).not.toBeChecked();
    expect(screen.getByLabelText("Call letters:")).toHaveValue("");
    expect(screen.getByLabelText(/call numbers:/i)).toHaveValue("");
    // A native <input type=reset> restores a <select> to its default option
    // along with everything else — Rock must not survive the reset.
    expect(screen.getByLabelText(/^genre/i)).toHaveValue(String(BLUES_GENRE_ID));
  });
});
