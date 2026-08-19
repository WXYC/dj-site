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

import CreateLibraryCodeForm from "@/src/components/experiences/classic/catalog/CreateLibraryCodeForm";

const GENRE_ID = 3;

function mockGenres(
  genres: { id: number; genre_name: string }[] = [{ id: GENRE_ID, genre_name: "Blues" }],
) {
  server.use(http.get(`${TEST_BACKEND_URL}/library/genres`, () => HttpResponse.json(genres)));
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

const defaultProps = {
  genreIdRaw: String(GENRE_ID),
  codeLetters: "mo",
  codeNumberRaw: "12",
};

describe("classic CreateLibraryCodeForm — createLibraryCode.jsp", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGenres();
  });

  it("renders tubafrenzy's field order and labels, read-only except the two name fields", async () => {
    renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

    expect(
      await screen.findByText(/does not currently exist in the database/i),
    ).toBeInTheDocument();
    expect(await screen.findByText("Blues")).toBeInTheDocument();
    expect(screen.getByText("MO")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByLabelText(/artist presentation name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist alphabetical name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  // ArtistAdminServlet picks the heading off the call letters: a `Z-` code is
  // a Various Artists shelf bucket and gets its own shorter wording, so a
  // librarian filing a compilation is not told to associate a named artist.
  it("shows the Various Artists heading for a Z- code and the artist heading otherwise", async () => {
    const { unmount } = renderWithProviders(
      <CreateLibraryCodeForm {...defaultProps} codeLetters="z-ro" />,
    );

    expect(
      await screen.findByText(
        "This 'Various Artists' library code does not currently exist in the database. To create it, click 'Add!'",
      ),
    ).toBeInTheDocument();
    unmount();

    renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);
    expect(
      await screen.findByText(
        "This library code does not currently exist in the database. To create it, you need to associate it with an artist (new or existing) and click 'Add!'.",
      ),
    ).toBeInTheDocument();
  });

  it("uppercases the carried call letters on the wire, not just in the display", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

    await screen.findByText("MO");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.click(screen.getByRole("button", { name: "Add!" }));

    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toMatchObject({ code_letters: "MO" });
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/library/artist/99?created=1"),
    );
  });

  // The carried code is displayed verbatim, so every refusal has to name the
  // part that is wrong: a message about something "missing" beside a row
  // showing that very value reads as a broken screen, not a bad link.
  it.each([
    [{ genreIdRaw: "" }, "This link carries no genre."],
    [{ genreIdRaw: "abc" }, "This link's genre (abc) is not a genre id."],
    [{ codeLetters: "" }, "This link carries no call letters."],
    [{ codeNumberRaw: "" }, "This link carries no call number."],
    [
      { codeNumberRaw: "012" },
      "This link's call number (012) is not a whole number above zero.",
    ],
  ])("names the unusable part of the carried code (%o)", async (override, message) => {
    const { user } = renderWithProviders(
      <CreateLibraryCodeForm {...defaultProps} {...override} />,
    );

    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.click(screen.getByRole("button", { name: "Add!" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  // The pending window must not borrow the missing-value rendering: "no genre
  // arrived" and "the genre hasn't loaded yet" have opposite outcomes.
  it("shows the genre as pending while the list is in flight, not as absent", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/genres`, async () => {
        await delay(50);
        return HttpResponse.json([{ id: GENRE_ID, genre_name: "Blues" }]);
      }),
    );
    renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(await screen.findByText("Blues")).toBeInTheDocument();
  });

  // A genre id that parses but names nothing in the catalog is not the same
  // screen as a missing param or an outage: filing anyway would put the
  // release under a genre the librarian was never shown, and library codes
  // carry no unique constraint to catch it afterwards.
  it("refuses to file when the carried genre id is absent from the catalog", async () => {
    mockGenres([{ id: 999, genre_name: "Jazz" }]);
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

    expect(
      await screen.findByText(`No genre in the catalog has id ${GENRE_ID}, so this code can't be filed.`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add!" })).toBeDisabled();

    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.click(screen.getByRole("button", { name: "Add!" }));

    expect(getBodies()).toHaveLength(0);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the JSP's exact validation message when the presentation name is empty", async () => {
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);
    await screen.findByText("Blues");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");

    await user.click(screen.getByRole("button", { name: "Add!" }));

    expect(await screen.findByText("The presentation name cannot be empty.")).toBeInTheDocument();
  });

  it("shows the JSP's exact validation message when the alphabetical name is empty", async () => {
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);
    await screen.findByText("Blues");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");

    await user.click(screen.getByRole("button", { name: "Add!" }));

    expect(await screen.findByText("The alphabetical name cannot be empty.")).toBeInTheDocument();
  });

  // `processAddArtistLibraryCode` (`ArtistAdminServlet:188`) lands on the new
  // artist's card carrying the servlet's create confirmation.
  it("submits POST /library/artists with the carried code and typed names, then lands on the new artist's card", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

    await screen.findByText("Blues");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.click(screen.getByRole("button", { name: "Add!" }));

    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toEqual({
      artist_name: "Juana Molina",
      alphabetical_name: "Molina, Juana",
      code_letters: "MO",
      genre_id: GENRE_ID,
      code_number: 12,
    });
    expect(mockPush).toHaveBeenCalledWith("/dashboard/library/artist/99?created=1");
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
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

    await screen.findByText("Blues");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.click(screen.getByRole("button", { name: "Add!" }));

    expect(
      await screen.findByText("Stereolab already holds that library code."),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
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
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

    await screen.findByText("Blues");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.click(screen.getByRole("button", { name: "Add!" }));

    expect(
      await screen.findByText(
        "Juana Molina already exists in this genre. File under the existing artist instead of picking a different code.",
      ),
    ).toBeInTheDocument();
  });

  it("falls back without crashing on a 409 body with no artist", async () => {
    mockAddArtist(() => HttpResponse.json({ message: "Conflict" }, { status: 409 }));
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

    await screen.findByText("Blues");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.click(screen.getByRole("button", { name: "Add!" }));

    expect(await screen.findByText("Failed to add artist.")).toBeInTheDocument();
  });

  it("resets the two name fields back to empty on Reset", async () => {
    const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);
    await screen.findByText("Blues");

    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByLabelText(/artist presentation name/i)).toHaveValue("");
    expect(screen.getByLabelText(/artist alphabetical name/i)).toHaveValue("");
  });

  describe("genre outage", () => {
    it("explains a genres outage instead of guessing or blanking the read-only genre name", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
          HttpResponse.json({ message: "genres unavailable" }, { status: 500 }),
        ),
      );
      renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

      expect(await screen.findByText(/genres are unavailable/i)).toBeInTheDocument();
      expect(screen.queryByText("Blues")).not.toBeInTheDocument();
    });

    it("recovers via Try again once genres are reachable", async () => {
      let genreCalls = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () => {
          genreCalls += 1;
          return genreCalls === 1
            ? HttpResponse.json({ message: "genres unavailable" }, { status: 500 })
            : HttpResponse.json([{ id: GENRE_ID, genre_name: "Blues" }]);
        }),
      );
      const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

      expect(await screen.findByText(/genres are unavailable/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /try again/i }));

      await waitFor(() =>
        expect(screen.queryByText(/genres are unavailable/i)).not.toBeInTheDocument(),
      );
      expect(await screen.findByText("Blues")).toBeInTheDocument();
    });

    it("refuses the submit while genres are unavailable, without duplicating the outage sentence", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
          HttpResponse.json({ message: "genres unavailable" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(<CreateLibraryCodeForm {...defaultProps} />);

      await screen.findByText(/genres are unavailable/i);
      await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
      await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
      await user.click(screen.getByRole("button", { name: "Add!" }));

      expect(screen.getAllByText(/genres are unavailable/i)).toHaveLength(1);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
