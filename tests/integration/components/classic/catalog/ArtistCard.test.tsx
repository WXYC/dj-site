import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
}));

import ArtistCard from "@/src/components/experiences/classic/catalog/ArtistCard";
import { parseImportedReleaseParams } from "@/lib/features/rotation/importedConfirmation";

const ARTIST_ID = 42;
const GENRE_ID = 3;
// Deliberately NOT `GENRE_ID`. The peek must carry the ARTIST's genre, and the
// card has three same-shaped genres in reach -- the artist's, each release
// row's, and the first entry of the genres list. If all three held one value,
// an assertion that the peek sent `GENRE_ID` would pass just as happily for an
// implementation that sourced the parameter from a release row or the dropdown,
// so it would establish nothing. Giving the other two their own value is what
// makes that assertion discriminating.
const OTHER_GENRE_ID = 7;

const artist = {
  artist_id: ARTIST_ID,
  artist_name: "Juana Molina",
  alphabetical_name: "Molina, Juana",
  genre_id: GENRE_ID,
  code_letters: "MO",
  code_artist_number: 12,
};

function release(overrides: Record<string, unknown> = {}) {
  return {
    id: 900,
    last_modified: "2024-06-15T19:04:05.000Z",
    format_name: "CD",
    genre_id: OTHER_GENRE_ID,
    code_letters: "MO",
    code_artist_number: 12,
    code_number: 5,
    code_volume_letters: null,
    album_title: "DOGA",
    alternate_artist_name: null,
    ...overrides,
  };
}

function mockCard(body: unknown = artist, status = 200) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
      HttpResponse.json(body as object, { status }),
    ),
  );
}

function mockReleases(releases: unknown[] = [release()], total = releases.length) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}/releases`, () =>
      HttpResponse.json({
        artist_id: ARTIST_ID,
        releases,
        total,
        page: 0,
        totalPages: Math.max(1, Math.ceil(total / 50)),
      }),
    ),
  );
}

function mockGenres() {
  server.use(
    // `OTHER_GENRE_ID` first, so `genres[0].id` is not the artist's genre --
    // see `OTHER_GENRE_ID`'s comment for why that matters to the peek test.
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([
        { id: OTHER_GENRE_ID, genre_name: "Jazz" },
        { id: GENRE_ID, genre_name: "Rock" },
      ]),
    ),
  );
}

function mockNextReleaseNumber(next_code_number: number | "error" = 6) {
  server.use(
    http.get(
      `${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}/next-release-number`,
      () =>
        next_code_number === "error"
          ? HttpResponse.error()
          : HttpResponse.json({ next_code_number }),
    ),
  );
}

function mockFormats() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
      HttpResponse.json([
        { id: 1, format_name: "CD" },
        { id: 2, format_name: "  " },
        { id: 3, format_name: "Vinyl" },
      ]),
    ),
  );
}

function mockAll() {
  mockCard();
  mockReleases();
  mockGenres();
  mockFormats();
  mockNextReleaseNumber();
}

describe("classic ArtistCard — artistCardModify.jsp", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockAll();
  });

  // `/wxycdb` picks the card from the row. A compilation bucket reaching this
  // URL would otherwise be offered a name edit for a shelf section and shown
  // none of its per-track credits.
  it("sends a compilation bucket on to the bucket card", async () => {
    mockCard({ ...artist, artist_name: "Soundtracks - L", code_letters: "V/A" });
    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(`/dashboard/library/various/${ARTIST_ID}`),
    );
    expect(screen.queryByTestId("modify-artist-form")).toBeNull();
  });

  it("leaves an ordinary artist on this card", async () => {
    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    await screen.findByTestId("modify-artist-form");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("heads the card with the artist's presentation name", async () => {
    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    expect(
      await screen.findByRole("heading", { name: /ARTIST:\s*Juana Molina/i }),
    ).toBeDefined();
  });

  it("shows the artist's genre, call letters, and call number", async () => {
    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    const modify = await screen.findByTestId("modify-artist-form");
    expect(within(modify).getByText("Rock")).toBeDefined();
    expect(within(modify).getByText("MO")).toBeDefined();
    expect(within(modify).getByText("12")).toBeDefined();
  });

  it("reports the release count from the server's total, not the rows on this page", async () => {
    mockReleases([release()], 137);
    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    const modify = await screen.findByTestId("modify-artist-form");
    expect(within(modify).getByText("137")).toBeDefined();
  });

  const NOTHING_FILED = {
    release_count: 0,
    cross_reference_source_count: 0,
    cross_reference_target_count: 0,
    library_cross_reference_count: 0,
  };

  it("offers 'Delete The Artist', beside the release table, when nothing is filed under the artist", async () => {
    mockCard({ ...artist, ...NOTHING_FILED });
    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    const link = await screen.findByRole("link", { name: "Delete The Artist" });
    expect(link.getAttribute("href")).toBe(`/dashboard/library/artist/${ARTIST_ID}/delete`);
    // Not in the modify table, where the JSP kept it -- see the component docblock.
    const modify = screen.getByTestId("modify-artist-form");
    expect(within(modify).queryByRole("link", { name: "Delete The Artist" })).toBeNull();
  });

  // `artistCardModify.jsp:75` gates the link on `totalSizeOfQueryResults <= 0
  // and empty libraryCodeCrossReferences and empty libraryReleaseCrossReferences`,
  // and this card matches that pre-check -- one gate per dependent count,
  // parameterized rather than four near-identical blocks.
  it.each([
    ["release_count", 3],
    ["cross_reference_source_count", 2],
    ["cross_reference_target_count", 1],
    ["library_cross_reference_count", 4],
  ] as const)("withholds the delete link when %s is non-zero", async (key, value) => {
    mockCard({ ...artist, ...NOTHING_FILED, [key]: value });
    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    await screen.findByTestId("modify-artist-form");
    expect(screen.queryByRole("link", { name: "Delete The Artist" })).toBeNull();
  });

  // Fail-closed: a card served by a Backend build predating these counts
  // yields `undefined` for all four (the base `artist` fixture carries
  // none of them), and the link must stay hidden rather than offer a
  // delete that would then 409.
  it("withholds the delete link when the gating counts are undefined", async () => {
    mockCard(artist);
    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    await screen.findByTestId("modify-artist-form");
    expect(screen.queryByRole("link", { name: "Delete The Artist" })).toBeNull();
  });

  describe("modifyArtist", () => {
    it("saves an edited alphabetical name", async () => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      server.use(
        http.patch(
          `${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`,
          async ({ request }) => {
            bodies.push(await request.json());
            return HttpResponse.json({
              id: ARTIST_ID,
              artist_name: artist.artist_name,
              alphabetical_name: "Molina, Juana C.",
            });
          },
        ),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = await screen.findByLabelText(/Artist Alphabetical Name/i);
      await user.clear(field);
      await user.type(field, "Molina, Juana C.");
      await user.click(screen.getByRole("button", { name: "Modify This Artist" }));

      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toEqual({
        artist_name: artist.artist_name,
        alphabetical_name: "Molina, Juana C.",
      });
    });

    it("saves an edited presentation name", async () => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      server.use(
        http.patch(
          `${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`,
          async ({ request }) => {
            bodies.push(await request.json());
            return HttpResponse.json({
              id: ARTIST_ID,
              artist_name: "Juana Molina C.",
              alphabetical_name: artist.alphabetical_name,
            });
          },
        ),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = await screen.findByLabelText(/Artist Presentation Name/i);
      await user.clear(field);
      await user.type(field, "Juana Molina C.");
      await user.click(screen.getByRole("button", { name: "Modify This Artist" }));

      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toEqual({
        artist_name: "Juana Molina C.",
        alphabetical_name: artist.alphabetical_name,
      });
    });

    it("names the conflicting artist inline when a rename collides", async () => {
      const user = userEvent.setup();
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
          HttpResponse.json(
            { artist: { artist_id: 99, artist_name: "Jessica Pratt", code_letters: "PR" } },
            { status: 409 },
          ),
        ),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = await screen.findByLabelText(/Artist Presentation Name/i);
      await user.clear(field);
      await user.type(field, "Jessica Pratt");
      await user.click(screen.getByRole("button", { name: "Modify This Artist" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Jessica Pratt");
    });

    it("refuses to save an empty presentation name rather than sending it", async () => {
      const user = userEvent.setup();
      let patched = false;
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => {
          patched = true;
          return HttpResponse.json({});
        }),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = await screen.findByLabelText(/Artist Presentation Name/i);
      await user.clear(field);
      await user.click(screen.getByRole("button", { name: "Modify This Artist" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "The presentation name cannot be empty.",
      );
      expect(patched).toBe(false);
    });

    it("refuses to save an empty alphabetical name rather than sending it", async () => {
      const user = userEvent.setup();
      let patched = false;
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => {
          patched = true;
          return HttpResponse.json({});
        }),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = await screen.findByLabelText(/Artist Alphabetical Name/i);
      await user.clear(field);
      await user.click(screen.getByRole("button", { name: "Modify This Artist" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "The alphabetical name cannot be empty.",
      );
      expect(patched).toBe(false);
    });

    // Pasted, not typed: userEvent enforces an input's own `maxLength` on
    // both keystrokes and paste, so a paste this long is what would expose a
    // `maxLength` silently clipping the value back under the ceiling -- the
    // regression this pins. `varchar(128)` is a 128-*character* ceiling, so
    // 129 plain ASCII characters (129 code points) is one past it.
    it("refuses an over-long presentation name rather than sending it", async () => {
      const user = userEvent.setup();
      let patched = false;
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => {
          patched = true;
          return HttpResponse.json({});
        }),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = await screen.findByLabelText(/Artist Presentation Name/i);
      await user.clear(field);
      await user.paste("x".repeat(129));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "At most 128 characters",
      );
      expect(
        screen.getByRole("button", { name: "Modify This Artist" }),
      ).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Modify This Artist" }));
      expect(patched).toBe(false);
    });

    it("refuses an over-long alphabetical name rather than sending it", async () => {
      const user = userEvent.setup();
      let patched = false;
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => {
          patched = true;
          return HttpResponse.json({});
        }),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = await screen.findByLabelText(/Artist Alphabetical Name/i);
      await user.clear(field);
      await user.paste("y".repeat(129));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "At most 128 characters",
      );
      expect(
        screen.getByRole("button", { name: "Modify This Artist" }),
      ).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Modify This Artist" }));
      expect(patched).toBe(false);
    });

    // The column and Backend's own check (`codePointLength(...) <= 128`) both
    // count code points, not UTF-16 units -- each of these characters is a
    // surrogate pair (mathematical bold capital A), so this name is 70 code
    // points but 140 UTF-16 units. A `String#length`- or `maxLength`-based
    // check would clip it at 64 characters and refuse a name the column can
    // hold and the server would store; this pins that it is accepted instead.
    it("accepts an astral-character presentation name within the code-point ceiling", async () => {
      const user = userEvent.setup();
      const longName = "𝐀".repeat(70);
      const bodies: unknown[] = [];
      server.use(
        http.patch(
          `${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`,
          async ({ request }) => {
            bodies.push(await request.json());
            return HttpResponse.json({
              id: ARTIST_ID,
              artist_name: longName,
              alphabetical_name: artist.alphabetical_name,
            });
          },
        ),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = await screen.findByLabelText(/Artist Presentation Name/i);
      await user.clear(field);
      await user.paste(longName);

      expect(screen.queryByText(/At most 128 characters/)).toBeNull();
      const submitButton = screen.getByRole("button", { name: "Modify This Artist" });
      expect(submitButton).toBeEnabled();

      await user.click(submitButton);

      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toEqual({
        artist_name: longName,
        alphabetical_name: artist.alphabetical_name,
      });
    });
  });

  describe("the release table", () => {
    it("renders the whole shelf code, the format, the title, and the alternate artist name", async () => {
      mockReleases([
        release({ code_volume_letters: "a", alternate_artist_name: "Juana" }),
      ]);
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const table = await screen.findByTestId("artist-release-table");
      const row = within(table).getByText("DOGA").closest("tr")!;
      // "Jazz", not "Rock": the row renders the RELEASE's own genre, and the
      // fixture files this release under a different genre from the artist's
      // card genre on purpose (see `OTHER_GENRE_ID`). That the two differ is
      // what makes this assertion prove the row reads the release rather than
      // inheriting the card.
      expect(within(row).getByText("Jazz MO 12/5-A")).toBeDefined();
      expect(within(row).getByText("CD")).toBeDefined();
      expect(within(row).getByText("Juana")).toBeDefined();
    });

    it("prints the station-local time the release was last modified", async () => {
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const table = await screen.findByTestId("artist-release-table");
      expect(
        within(table).getByText("3:04:05 PM, Saturday, June 15, 2024"),
      ).toBeDefined();
    });

    // The JSP links each title to `libraryReleaseModify.jsp`, and this
    // experience has that screen: both cards reach the release editor from
    // the title, so a librarian scanning a shelf section can open any row.
    it("opens the release editor from the title, as the JSP does", async () => {
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const table = await screen.findByTestId("artist-release-table");
      expect(
        within(table).getByRole("link", { name: "DOGA" }).getAttribute("href"),
      ).toBe("/dashboard/library/release/900");
    });

    it("says so when the artist has no releases", async () => {
      mockReleases([], 0);
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      expect(
        await screen.findByText("The artist does not have any library releases"),
      ).toBeDefined();
    });

    // Soft-failing an unreadable response into an empty list would render the
    // line above — a positive claim that the shelf is empty, which is what
    // makes a librarian file a duplicate.
    it("does not claim an empty shelf when the release list could not be read", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}/releases`, () =>
          HttpResponse.error(),
        ),
      );
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      await screen.findByTestId("modify-artist-form");
      await waitFor(() =>
        expect(
          screen.queryByText("The artist does not have any library releases"),
        ).toBeNull(),
      );
      expect(await screen.findByTestId("release-table-error")).toBeDefined();
    });
  });

  describe("addRelease", () => {
    it("files a release under this artist and names the code it was assigned", async () => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(
            { id: 901, code_number: 6, code_volume_letters: null },
            { status: 201 },
          );
        }),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      // The call-number field prepopulates from the peek; leaving it untouched
      // sends that authoritative next number as the release's code_number.
      const codeField = (await screen.findByLabelText(
        /Release call number/i,
      )) as HTMLInputElement;
      await waitFor(() => expect(codeField.value).toBe("6"));

      await user.type(await screen.findByLabelText(/Title of Release/i), "Halo");
      await user.type(screen.getByLabelText(/Alternate Artist Name/i), "J. Molina");
      await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
      await user.selectOptions(screen.getByLabelText(/Format/i), "3");
      await user.click(
        screen.getByRole("button", { name: "Add a new Library Release" }),
      );

      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toEqual({
        artist_id: ARTIST_ID,
        genre_id: GENRE_ID,
        album_title: "Halo",
        alternate_artist_name: "J. Molina",
        label: "Crammed Discs",
        format_id: 3,
        code_number: 6,
      });
      expect(await screen.findByRole("status")).toHaveTextContent("Rock MO 12/6");
    });

    it("omits the blank-named format the JSP filters out of its dropdown", async () => {
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const select = await screen.findByLabelText(/Format/i);
      const values = within(select).getAllByRole("option").map((o) => o.getAttribute("value"));
      expect(values).toEqual(["1", "3"]);
    });

    // A browser <select> with no matching option value displays the first
    // <option> regardless of what state thinks is selected -- the dropdown
    // shows "CD" before the librarian ever touches it, so the submitted
    // format has to agree with that display rather than demanding a
    // redundant click on the format the form is already showing.
    it("files a release under the first format when the dropdown is never touched", async () => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(
            { id: 902, code_number: 7, code_volume_letters: null },
            { status: 201 },
          );
        }),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      await user.type(await screen.findByLabelText(/Title of Release/i), "Halo");
      await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
      await user.click(
        screen.getByRole("button", { name: "Add a new Library Release" }),
      );

      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toMatchObject({ format_id: 1 });
      expect(
        screen.queryByText("You must select a format before adding this release."),
      ).toBeNull();
    });

    // The backstop guard is only reachable when there is nothing to default
    // to -- formats failed to load, or every one of them is blank-named.
    it("still guards on an empty format list, since there is nothing to default to", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
      );
      const user = userEvent.setup();
      let posted = false;
      server.use(
        http.post(`${TEST_BACKEND_URL}/library`, () => {
          posted = true;
          return HttpResponse.json({ id: 901 }, { status: 201 });
        }),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      await user.type(await screen.findByLabelText(/Title of Release/i), "Halo");
      await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
      await user.click(
        screen.getByRole("button", { name: "Add a new Library Release" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "You must select a format before adding this release.",
      );
      expect(posted).toBe(false);
    });

    it("refuses a release with no title rather than sending it", async () => {
      const user = userEvent.setup();
      let posted = false;
      server.use(
        http.post(`${TEST_BACKEND_URL}/library`, () => {
          posted = true;
          return HttpResponse.json({ id: 901 }, { status: 201 });
        }),
      );

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      await user.type(await screen.findByLabelText(/^Label/i), "Crammed Discs");
      await user.click(
        screen.getByRole("button", { name: "Add a new Library Release" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please enter a title before adding this release.",
      );
      expect(posted).toBe(false);
    });

    describe("the prepopulated call number", () => {
      it("prepopulates the field with the peek's next number instead of a placeholder", async () => {
        mockNextReleaseNumber(9);
        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release call number/i,
        )) as HTMLInputElement;
        await waitFor(() => expect(field.value).toBe("9"));
        expect(
          screen.queryByText(/the release number is assigned when you save/i),
        ).toBeNull();
      });

      // The peek must carry the card's own genre so it reads that genre's
      // shelf, and the prefill must still appear once the artist resolves --
      // otherwise a soft-failed peek (the skip guard never releasing, a wrong
      // genre_id 400ing) would hide behind "no error was thrown" rather than
      // showing up as a regression to "never prefills."
      it("sends the artist's own genre and prepopulates the field once the card resolves", async () => {
        const receivedGenreIds: (string | null)[] = [];
        server.use(
          http.get(
            `${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}/next-release-number`,
            ({ request }) => {
              receivedGenreIds.push(new URL(request.url).searchParams.get("genre_id"));
              return HttpResponse.json({ next_code_number: 9 });
            },
          ),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release call number/i,
        )) as HTMLInputElement;
        await waitFor(() => expect(field.value).toBe("9"));
        expect(receivedGenreIds).toEqual([String(GENRE_ID)]);
      });

      // The peek is genre-scoped and the genre only exists once the card
      // resolves, so a request sent before then carries no usable genre. Once
      // the server requires the parameter that is a 400, and because this query
      // soft-fails the 400 surfaces as "the field never prefills" rather than
      // as an error -- so the regression is invisible unless a test observes
      // the request itself.
      //
      // Asserted as an ORDERING invariant, not a deadline. An earlier version
      // slept 50 ms and then asserted no call had been made, which passes
      // vacuously on any runner where the token fetch, the fetchBaseQuery hop
      // and msw interception together take longer than that -- reporting green
      // for a guard that is broken. Here the peek handler itself records
      // whether the artist was still unresolved when it ran, and the test waits
      // for the peek to genuinely happen before judging: no sleep, and a broken
      // guard fails regardless of how slow the machine is.
      it("does not fire the next-release-number peek before the artist resolves", async () => {
        let peekCalls = 0;
        let peekedWhileArtistUnresolved = 0;
        let artistResolved = false;
        let releaseArtist: (() => void) | undefined;
        const artistReady = new Promise<void>((resolve) => {
          releaseArtist = resolve;
        });
        server.use(
          http.get(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, async () => {
            await artistReady;
            return HttpResponse.json(artist);
          }),
          http.get(
            `${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}/next-release-number`,
            () => {
              peekCalls += 1;
              if (!artistResolved) peekedWhileArtistUnresolved += 1;
              return HttpResponse.json({ next_code_number: 9 });
            },
          ),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        expect(await screen.findByText("Loading…")).toBeDefined();

        artistResolved = true;
        releaseArtist?.();

        await waitFor(() => expect(peekCalls).toBe(1));
        expect(peekedWhileArtistUnresolved).toBe(0);
      });

      it("sends the librarian's edited call number as code_number", async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];
        mockNextReleaseNumber(9);
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
            bodies.push(await request.json());
            return HttpResponse.json(
              { id: 903, code_number: 42, code_volume_letters: null },
              { status: 201 },
            );
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release call number/i,
        )) as HTMLInputElement;
        await waitFor(() => expect(field.value).toBe("9"));
        await user.clear(field);
        await user.type(field, "42");
        await user.type(screen.getByLabelText(/Title of Release/i), "Segundo");
        await user.type(screen.getByLabelText(/^Label/i), "Domino");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ code_number: 42 });
        expect(await screen.findByRole("status")).toHaveTextContent("Rock MO 12/42");
      });

      it("sends no code_number when the field is cleared, letting the server assign", async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];
        mockNextReleaseNumber(9);
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
            bodies.push((await request.json()) as Record<string, unknown>);
            return HttpResponse.json(
              { id: 904, code_number: 10, code_volume_letters: null },
              { status: 201 },
            );
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release call number/i,
        )) as HTMLInputElement;
        await waitFor(() => expect(field.value).toBe("9"));
        await user.clear(field);
        await user.type(screen.getByLabelText(/Title of Release/i), "Un Dia");
        await user.type(screen.getByLabelText(/^Label/i), "Domino");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty("code_number");
      });

      // Prepopulating with an authoritative number is the point, but an
      // unreachable peek must not block filing: the field falls back to empty
      // and the release still saves under the server's own MAX+1.
      it("degrades to server-assign when the peek is unreachable", async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];
        mockNextReleaseNumber("error");
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
            bodies.push((await request.json()) as Record<string, unknown>);
            return HttpResponse.json(
              { id: 905, code_number: 3, code_volume_letters: null },
              { status: 201 },
            );
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release call number/i,
        )) as HTMLInputElement;
        expect(
          await screen.findByText(
            /the release number is assigned when you save/i,
          ),
        ).toBeDefined();
        expect(field.value).toBe("");

        await user.type(screen.getByLabelText(/Title of Release/i), "Halo");
        await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty("code_number");
        expect(await screen.findByRole("status")).toHaveTextContent("Rock MO 12/3");
      });

      it("refuses a release number over the smallint ceiling", async () => {
        const user = userEvent.setup();
        let posted = false;
        mockNextReleaseNumber(9);
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, () => {
            posted = true;
            return HttpResponse.json({ id: 906 }, { status: 201 });
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release call number/i,
        )) as HTMLInputElement;
        await waitFor(() => expect(field.value).toBe("9"));
        await user.clear(field);
        await user.type(field, "32768");
        await user.type(screen.getByLabelText(/Title of Release/i), "Halo");
        await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "The release call number must be a whole number between 1 and 32767.",
        );
        expect(posted).toBe(false);
      });

      it("refuses a non-numeric call number rather than sending it", async () => {
        const user = userEvent.setup();
        let posted = false;
        mockNextReleaseNumber(9);
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, () => {
            posted = true;
            return HttpResponse.json({ id: 906 }, { status: 201 });
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release call number/i,
        )) as HTMLInputElement;
        await waitFor(() => expect(field.value).toBe("9"));
        await user.clear(field);
        await user.type(field, "abc");
        await user.type(screen.getByLabelText(/Title of Release/i), "Halo");
        await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "The release call number must be a whole number between 1 and 32767.",
        );
        expect(posted).toBe(false);
      });

      // A save consumes the prepopulated number and triggers a peek refetch.
      // Until it settles `nextRelease` still holds the just-consumed number;
      // the field — which the submit handler reads — must not reoffer it, or a
      // second save would file a duplicate.
      it("does not reoffer the just-filed number while the peek refetch is in flight", async () => {
        const user = userEvent.setup();
        let nextCalls = 0;
        let releaseSecondPeek: (() => void) | undefined;
        const secondPeekReady = new Promise<void>((resolve) => {
          releaseSecondPeek = resolve;
        });
        server.use(
          http.get(
            `${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}/next-release-number`,
            async () => {
              nextCalls += 1;
              if (nextCalls >= 2) {
                await secondPeekReady;
                return HttpResponse.json({ next_code_number: 7 });
              }
              return HttpResponse.json({ next_code_number: 6 });
            },
          ),
          http.post(`${TEST_BACKEND_URL}/library`, () =>
            HttpResponse.json(
              { id: 907, code_number: 6, code_volume_letters: null },
              { status: 201 },
            ),
          ),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release call number/i,
        )) as HTMLInputElement;
        await waitFor(() => expect(field.value).toBe("6"));

        await user.type(screen.getByLabelText(/Title of Release/i), "Halo");
        await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        // The refetch is in flight and gated open: the field shows the settled
        // fallback (empty), never the consumed 6.
        await waitFor(() => expect(nextCalls).toBe(2));
        await waitFor(() => expect(field.value).toBe(""));
        expect(field.value).not.toBe("6");

        // Once the refetch resolves, the field shows the fresh next number.
        releaseSecondPeek?.();
        await waitFor(() => expect(field.value).toBe("7"));
      });
    });

    describe("the volume letters field", () => {
      // Volume letters subdivide a single code_number ("R 7", "R 7A", "R 7B"
      // are volumes of one set); the call number the peek prepopulates is the
      // *next* number, so seeding letters from an existing release would pair
      // a new set with a volume of a set that doesn't exist. The field starts
      // blank even when the artist's loaded releases carry letters.
      it("starts blank, even when loaded releases carry volume letters", async () => {
        mockNextReleaseNumber(6);
        mockReleases([
          release({ id: 1, code_number: 3, code_volume_letters: "A" }),
          release({ id: 2, code_number: 5, code_volume_letters: "B" }),
        ]);

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release volume letters/i,
        )) as HTMLInputElement;
        await waitFor(() => expect(field.value).toBe(""));
      });

      it("normalizes typed letters to uppercase, matching how the catalog renders and compares them", async () => {
        const user = userEvent.setup();
        mockNextReleaseNumber(6);

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release volume letters/i,
        )) as HTMLInputElement;
        await user.type(field, "b");
        expect(field.value).toBe("B");
      });

      it("sends typed volume letters as code_volume_letters", async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];
        mockNextReleaseNumber(6);
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
            bodies.push((await request.json()) as Record<string, unknown>);
            return HttpResponse.json(
              { id: 908, code_number: 6, code_volume_letters: "B" },
              { status: 201 },
            );
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release volume letters/i,
        )) as HTMLInputElement;
        await user.type(field, "b");
        await user.type(screen.getByLabelText(/Title of Release/i), "Halo");
        await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ code_volume_letters: "B" });
      });

      it("sends no code_volume_letters when the field is cleared", async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];
        mockNextReleaseNumber(6);
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
            bodies.push((await request.json()) as Record<string, unknown>);
            return HttpResponse.json(
              { id: 909, code_number: 6, code_volume_letters: null },
              { status: 201 },
            );
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release volume letters/i,
        )) as HTMLInputElement;
        await user.type(field, "B");
        await user.clear(field);
        await user.type(screen.getByLabelText(/Title of Release/i), "Halo");
        await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty("code_volume_letters");
      });

      // The override resets after a save (setVolumeLettersEdit(null)) so a
      // second filing left untouched cannot silently resend the first
      // release's letters -- the same stale-carry-forward class the call
      // number's post-save reset guards against.
      it("does not carry the previous release's volume letters into a second filing", async () => {
        const user = userEvent.setup();
        const bodies: Record<string, unknown>[] = [];
        mockNextReleaseNumber(6);
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
            bodies.push((await request.json()) as Record<string, unknown>);
            return HttpResponse.json(
              { id: 911, code_number: 6, code_volume_letters: null },
              { status: 201 },
            );
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release volume letters/i,
        )) as HTMLInputElement;
        await user.type(field, "B");
        await user.type(screen.getByLabelText(/Title of Release/i), "Halo");
        await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );
        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ code_volume_letters: "B" });
        await waitFor(() => expect(field.value).toBe(""));

        await user.type(screen.getByLabelText(/Title of Release/i), "Un Dia");
        await user.type(screen.getByLabelText(/^Label/i), "Domino");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        await waitFor(() => expect(bodies).toHaveLength(2));
        expect(bodies[1]).not.toHaveProperty("code_volume_letters");
      });

      it("refuses volume letters longer than the varchar(4) column", async () => {
        const user = userEvent.setup();
        let posted = false;
        mockNextReleaseNumber(9);
        server.use(
          http.post(`${TEST_BACKEND_URL}/library`, () => {
            posted = true;
            return HttpResponse.json({ id: 910 }, { status: 201 });
          }),
        );

        renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

        const field = (await screen.findByLabelText(
          /Release volume letters/i,
        )) as HTMLInputElement;
        await user.type(field, "ABCDE");
        await user.type(screen.getByLabelText(/Title of Release/i), "Halo");
        await user.type(screen.getByLabelText(/^Label/i), "Crammed Discs");
        await user.selectOptions(screen.getByLabelText(/Format/i), "1");
        await user.click(
          screen.getByRole("button", { name: "Add a new Library Release" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "The release volume letters must be at most 4 characters.",
        );
        expect(posted).toBe(false);
      });
    });
  });

  it("reports an unreachable card rather than rendering blank fields", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.error(),
      ),
    );

    renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

    expect(await screen.findByTestId("artist-card-error")).toBeDefined();
    expect(screen.queryByTestId("modify-artist-form")).toBeNull();
  });

  describe("import confirmation", () => {
    // The raw `imported` / `code` / `vol` triple, shaped exactly as
    // `ClassicArtistCardPage` reads it off the URL's search params -- so the
    // parse itself runs as part of the test, not just the render.
    it("names the volume letters in full, even when they are not purely alphabetic", async () => {
      renderWithProviders(
        <ArtistCard
          artistId={ARTIST_ID}
          imported={parseImportedReleaseParams("7", "5", "A/B")}
        />,
      );

      await screen.findByTestId("modify-artist-form");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Filed as Rock MO 12/5-A/B, and linked to rotation release #7.",
      );
    });

    it("does not assert a partial shelf code when the volume letters could not be read", async () => {
      renderWithProviders(
        <ArtistCard
          artistId={ARTIST_ID}
          imported={parseImportedReleaseParams("7", "5", "abcde")}
        />,
      );

      await screen.findByTestId("modify-artist-form");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Catalogued and linked to rotation release #7.",
      );
    });
  });

  // `genre_artist_crossreference` is unique on `(artist_id, genre_id)`, so one
  // artist row can be two unrelated bands: the catalog's `Isis` is a hip-hop
  // act filed `IS 1` under Hiphop and a metal band filed `IS 13` under Rock.
  // Unscoped, the server collapses onto the lowest genre, so the card asserts
  // one shelf's code over both shelves' releases.
  //
  // Asserted on the REQUEST, not just the render: the scope only works if the
  // parameter reaches the wire, and a card that dropped it would still render
  // plausibly — with the other band's releases on it.
  describe("genre scope", () => {
    const ISIS_ID = 431;
    const HIPHOP = { id: 6, genre_name: "Hiphop" };
    const ROCK = { id: 11, genre_name: "Rock" };

    /**
     * The value cell of one of the modify card's labelled fields. The card
     * prints genre, call letters and call number separately rather than as one
     * composed code, so the identity is asserted field by field.
     */
    const cardField = (label: string) =>
      screen.getByText(label).closest("tr")?.querySelectorAll("td")[1]?.textContent;

    /**
     * Serves whichever membership the request asks for, and records the
     * `genre_id` both reads sent. Unscoped, answers the lowest membership, the
     * way the server's own collapse does.
     */
    function mockIsis() {
      const sent: { card: (string | null)[]; releases: (string | null)[] } = {
        card: [],
        releases: [],
      };
      const memberships = {
        [HIPHOP.id]: { genre_id: HIPHOP.id, code_artist_number: 1, album_title: "Rebel Soul", releaseId: 833 },
        [ROCK.id]: { genre_id: ROCK.id, code_artist_number: 13, album_title: "Panopticon", releaseId: 36792 },
      };
      const asked = (request: Request) => {
        const raw = new URL(request.url).searchParams.get("genre_id");
        return { raw, membership: memberships[raw == null ? HIPHOP.id : Number(raw)] };
      };

      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/${ISIS_ID}`, ({ request }) => {
          const { raw, membership } = asked(request);
          sent.card.push(raw);
          return HttpResponse.json({
            artist_id: ISIS_ID,
            artist_name: "Isis",
            alphabetical_name: "Isis",
            genre_id: membership.genre_id,
            code_letters: "IS",
            code_artist_number: membership.code_artist_number,
          });
        }),
        http.get(`${TEST_BACKEND_URL}/library/artists/${ISIS_ID}/releases`, ({ request }) => {
          const { raw, membership } = asked(request);
          sent.releases.push(raw);
          // Unscoped is the reported defect: both bands' records on one page.
          const releases =
            raw == null
              ? Object.values(memberships).map((m) =>
                  release({ id: m.releaseId, album_title: m.album_title, genre_id: m.genre_id }),
                )
              : [release({ id: membership.releaseId, album_title: membership.album_title, genre_id: membership.genre_id })];
          return HttpResponse.json({
            artist_id: ISIS_ID,
            releases,
            total: releases.length,
            page: 0,
            totalPages: 1,
          });
        }),
        http.get(`${TEST_BACKEND_URL}/library/genres`, () => HttpResponse.json([HIPHOP, ROCK])),
        http.get(`${TEST_BACKEND_URL}/library/artists/${ISIS_ID}/next-release-number`, () =>
          HttpResponse.json({ next_code_number: 3 }),
        ),
      );
      return sent;
    }

    it.each([
      ["Rock", ROCK, 13, "Panopticon", "Rebel Soul"],
      ["Hiphop", HIPHOP, 1, "Rebel Soul", "Panopticon"],
    ])(
      "shows only the %s membership's code and releases",
      async (_label, genre, codeNumber, ownTitle, otherTitle) => {
        const sent = mockIsis();

        renderWithProviders(<ArtistCard artistId={ISIS_ID} genreId={genre.id} />);

        await screen.findByTestId("modify-artist-form");
        await screen.findByText(ownTitle);
        expect(screen.queryByText(otherTitle)).toBeNull();
        expect(cardField("Genre:")).toBe(genre.genre_name);
        expect(cardField("Artist Call Letters:")).toBe("IS");
        expect(cardField("Artist Call Number:")).toBe(String(codeNumber));
        expect(sent.card).toEqual([String(genre.id)]);
        expect(sent.releases).toEqual([String(genre.id)]);
      },
    );

    // The add-release peek keys on the CARD's genre, so a scoped card also
    // previews the call number for the shelf on screen rather than for the
    // artist's lowest-numbered genre. Unscoped that number came off the wrong
    // shelf, which a librarian would have written onto a physical card.
    it("previews the next call number for the shelf the card is showing", async () => {
      const peeked: (string | null)[] = [];
      mockIsis();
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/library/artists/${ISIS_ID}/next-release-number`,
          ({ request }) => {
            peeked.push(new URL(request.url).searchParams.get("genre_id"));
            return HttpResponse.json({ next_code_number: 3 });
          },
        ),
      );

      renderWithProviders(<ArtistCard artistId={ISIS_ID} genreId={ROCK.id} />);

      await screen.findByTestId("modify-artist-form");
      await waitFor(() => expect(peeked).toEqual([String(ROCK.id)]));
    });

    // Every link built before the parameter existed omits it. That card must
    // still load — the server's collapse — rather than failing or sending an
    // empty `genre_id`.
    it("sends no genre at all when the card is not scoped", async () => {
      const sent = mockIsis();

      renderWithProviders(<ArtistCard artistId={ISIS_ID} />);

      await screen.findByTestId("modify-artist-form");
      await screen.findByText("Rebel Soul");
      expect(sent.card).toEqual([null]);
      expect(sent.releases).toEqual([null]);
    });

    // An artist with one membership is the overwhelming majority of the
    // catalog, and a scope naming that membership must change nothing about
    // what it shows.
    it("leaves a single-membership artist's card unchanged when scoped to its own genre", async () => {
      mockAll();

      renderWithProviders(<ArtistCard artistId={ARTIST_ID} genreId={GENRE_ID} />);

      await screen.findByTestId("modify-artist-form");
      expect(cardField("Genre:")).toBe("Rock");
      expect(cardField("Artist Call Letters:")).toBe("MO");
      expect(cardField("Artist Call Number:")).toBe("12");
      await screen.findByText("DOGA");
    });

    // The delete screen names the genre-prefixed code and its Cancel returns
    // here, so both would read the collapse for an artist reached on another
    // shelf — on the confirmation for an irreversible write.
    it("carries the membership onto the delete link", async () => {
      // Only the two handlers that must differ are overridden: the link is
      // offered solely when every dependent count reads zero, which the shared
      // fixture's card deliberately omits. A later `server.use` wins.
      mockIsis();
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/${ISIS_ID}`, () =>
          HttpResponse.json({
            artist_id: ISIS_ID,
            artist_name: "Isis",
            alphabetical_name: "Isis",
            genre_id: ROCK.id,
            code_letters: "IS",
            code_artist_number: 13,
            release_count: 0,
            cross_reference_source_count: 0,
            cross_reference_target_count: 0,
            library_cross_reference_count: 0,
            compilation_credit_count: 0,
          }),
        ),
        http.get(`${TEST_BACKEND_URL}/library/artists/${ISIS_ID}/releases`, () =>
          HttpResponse.json({ artist_id: ISIS_ID, releases: [], total: 0, page: 0, totalPages: 1 }),
        ),
      );

      renderWithProviders(<ArtistCard artistId={ISIS_ID} genreId={ROCK.id} />);

      const link = await screen.findByRole("link", { name: /Delete The Artist/i });
      expect(link.getAttribute("href")).toBe(
        `/dashboard/library/artist/${ISIS_ID}/delete?genre_id=${ROCK.id}`,
      );
    });
  });
});
