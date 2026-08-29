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
      });
      expect(await screen.findByRole("status")).toHaveTextContent("Rock MO 12/6");
    });

    it("omits the blank-named format the JSP filters out of its dropdown", async () => {
      renderWithProviders(<ArtistCard artistId={ARTIST_ID} />);

      const select = await screen.findByLabelText(/Format/i);
      const values = within(select).getAllByRole("option").map((o) => o.getAttribute("value"));
      expect(values).toEqual(["1", "3"]);
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
