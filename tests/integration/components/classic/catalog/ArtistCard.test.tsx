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

const ARTIST_ID = 42;
const GENRE_ID = 3;

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
    genre_id: GENRE_ID,
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
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([{ id: GENRE_ID, genre_name: "Rock" }]),
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
      expect(bodies[0]).toEqual({ alphabetical_name: "Molina, Juana C." });
    });

    // The backend rejects `artist_name` with a 400 rather than dropping it,
    // so an editable field here would be an edit that always fails.
    it("shows the presentation name without offering to edit it", async () => {
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const field = (await screen.findByLabelText(
        /Artist Presentation Name/i,
      )) as HTMLInputElement;
      expect(field.readOnly).toBe(true);
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
  });

  describe("the release table", () => {
    it("renders the whole shelf code, the format, the title, and the alternate artist name", async () => {
      mockReleases([
        release({ code_volume_letters: "a", alternate_artist_name: "Juana" }),
      ]);
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const table = await screen.findByTestId("artist-release-table");
      const row = within(table).getByText("DOGA").closest("tr")!;
      expect(within(row).getByText("Rock MO 12/5-A")).toBeDefined();
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
          "The release number must be a whole number between 1 and 32767.",
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
          "The release number must be a whole number between 1 and 32767.",
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
});
