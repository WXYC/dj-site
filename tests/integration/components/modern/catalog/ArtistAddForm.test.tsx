import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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
const { MOLINA } = TEST_SEARCH_STRINGS.CODE_LETTERS;

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

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

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

function mockGenres() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([{ id: GENRE_ID, genre_name: "Rock" }]),
    ),
  );
}

function mockArtistSearch(artists: unknown[] = []) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, () =>
      HttpResponse.json({ artists }),
    ),
  );
}

function mockPeekCode(next_code_number = 7) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () =>
      HttpResponse.json({ next_code_number }),
    ),
  );
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

async function fillCoreFields(user: ReturnType<typeof renderWithProviders>["user"]) {
  const genreSelect = await screen.findByRole("combobox", { name: /genre/i });
  await user.click(genreSelect);
  await user.click(await screen.findByRole("option", { name: "Rock" }));

  const nameInput = await screen.findByPlaceholderText("Search artists...");
  await user.type(nameInput, "Juana Molina");

  await user.type(screen.getByLabelText(/call letters/i), MOLINA);
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
        HttpResponse.json(
          { id: 99, artist_name: (body as { artist_name: string }).artist_name, code_number: 12, genre_id: GENRE_ID },
          { status: 201 },
        ),
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

    it("shows the assigned code number from the 201 response", async () => {
      mockAddArtist(() =>
        HttpResponse.json(
          { id: 99, artist_name: "Juana Molina", code_number: 12, genre_id: GENRE_ID },
          { status: 201 },
        ),
      );
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));

      expect(
        await screen.findByText(new RegExp(`${MOLINA}12`)),
      ).toBeInTheDocument();
    });

    it("renders the conflicting artist by name on a 409 response instead of a generic failure", async () => {
      mockAddArtist(() =>
        HttpResponse.json(
          {
            message: "Artist code already exists for that genre and code letters.",
            artist: { artist_id: 5, artist_name: "Stereolab", code_letters: MOLINA },
          },
          { status: 409 },
        ),
      );
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/Stereolab/);
    });

    it("clears the stale conflict banner once the rejected code is edited", async () => {
      mockAddArtist(() =>
        HttpResponse.json(
          {
            message: "Artist code already exists for that genre and code letters.",
            artist: { artist_id: 5, artist_name: "Stereolab", code_letters: MOLINA },
          },
          { status: 409 },
        ),
      );
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));
      expect(await screen.findByRole("alert")).toHaveTextContent(`${MOLINA}12`);

      // Editing the field the server actually rejected must drop the banner
      // rather than have it keep reporting the new, unsubmitted value as taken.
      await user.type(screen.getByLabelText("Code number"), "3");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("clears the stale conflict banner when the genre changes", async () => {
      const JAZZ_GENRE_ID = TEST_ENTITY_IDS.GENRE.ROCK + 1;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
          HttpResponse.json([
            { id: GENRE_ID, genre_name: "Rock" },
            { id: JAZZ_GENRE_ID, genre_name: "Jazz" },
          ]),
        ),
      );
      mockAddArtist(() =>
        HttpResponse.json(
          {
            message: "Artist code already exists for that genre and code letters.",
            artist: { artist_id: 5, artist_name: "Stereolab", code_letters: MOLINA },
          },
          { status: 409 },
        ),
      );
      const { user } = renderWithProviders(<ArtistAddForm />);

      await fillCoreFields(user);
      await user.click(screen.getByRole("button", { name: /add artist/i }));
      expect(await screen.findByRole("alert")).toHaveTextContent(`${MOLINA}12`);

      // (code_letters, genre_id, code_number) is the uniqueness triple — a
      // code rejected under one genre may be free under another, so moving
      // genres must not leave the prior genre's rejection standing.
      const genreSelect = screen.getByRole("combobox", { name: /genre/i });
      await user.click(genreSelect);
      await user.click(await screen.findByRole("option", { name: "Jazz" }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("blocks submission and surfaces a duplicate when an existing artist is picked from the typeahead", async () => {
      mockArtistSearch([
        { id: 12, artist_name: "Juana Molina", code_letters: MOLINA, code_number: 3 },
      ]);
      const { getBodies } = mockAddArtist(() =>
        HttpResponse.json({ id: 1 }, { status: 201 }),
      );
      const { user } = renderWithProviders(<ArtistAddForm />);

      const genreSelect = await screen.findByRole("combobox", { name: /genre/i });
      await user.click(genreSelect);
      await user.click(await screen.findByRole("option", { name: "Rock" }));

      const nameInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(nameInput, "Juana Molina");
      await user.click(await screen.findByText("Juana Molina"));

      await user.type(screen.getByLabelText(/call letters/i), MOLINA);
      await user.type(screen.getByLabelText("Code number"), "12");

      expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      expect(getBodies()).toHaveLength(0);
    });

    it("reuses parseRequiredPositiveInt to reject a non-numeric code number", async () => {
      mockAddArtist(() => HttpResponse.json({ id: 1 }, { status: 201 }));
      const { user } = renderWithProviders(<ArtistAddForm />);

      const genreSelect = await screen.findByRole("combobox", { name: /genre/i });
      await user.click(genreSelect);
      await user.click(await screen.findByRole("option", { name: "Rock" }));

      const nameInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(nameInput, "Juana Molina");
      await user.type(screen.getByLabelText(/call letters/i), MOLINA);
      await user.type(screen.getByLabelText("Code number"), "abc");

      expect(screen.getByRole("button", { name: /add artist/i })).toBeDisabled();
    });
  });
});
