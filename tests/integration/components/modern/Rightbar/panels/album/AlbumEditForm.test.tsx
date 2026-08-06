import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import AlbumEditForm from "@/src/components/experiences/modern/Rightbar/panels/album/AlbumEditForm";

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
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;

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

const ROCK_GENRE_ID = 7;
const JAZZ_GENRE_ID = 9;
const CD_FORMAT_ID = 3;
const VINYL_FORMAT_ID = 4;
const JUANA_ARTIST_ID = 501;
const JUANA_JAZZ_ARTIST_ID = 777;

const juanaMolinaAlbum = (overrides: Parameters<typeof createTestAlbum>[0] = {}) =>
  createTestAlbum({
    id: 4242,
    title: "DOGA",
    artist: createTestArtist({
      name: "Juana Molina",
      lettercode: "MO",
      numbercode: 12,
      genre: "Rock",
    }),
    label: "Sonamos",
    artist_id: JUANA_ARTIST_ID,
    genre_id: ROCK_GENRE_ID,
    format_id: CD_FORMAT_ID,
    disc_quantity: 1,
    alternate_artist: "",
    ...overrides,
  });

function mockGenresAndFormats() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([
        { id: ROCK_GENRE_ID, genre_name: "Rock" },
        { id: JAZZ_GENRE_ID, genre_name: "Jazz" },
      ]),
    ),
    http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
      HttpResponse.json([
        { id: CD_FORMAT_ID, format_name: "CD" },
        { id: VINYL_FORMAT_ID, format_name: "Vinyl" },
      ]),
    ),
  );
}

function mockArtistSearch(artists: { id: number; artist_name: string; code_letters: string; code_number: number }[]) {
  const requests: URL[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ artists });
    }),
  );
  return requests;
}

function mockPatch() {
  let receivedBody: Record<string, unknown> | undefined;
  let callCount = 0;
  server.use(
    http.patch(`${TEST_BACKEND_URL}/library/:id`, async ({ request }) => {
      callCount++;
      receivedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 4242,
        album_title: receivedBody.album_title ?? "DOGA",
        artist_name: "Juana Molina",
        artist_id: receivedBody.artist_id ?? JUANA_ARTIST_ID,
        code_letters: "MO",
        code_number: 1,
        code_artist_number: 12,
        format_name: "CD",
        format_id: receivedBody.format_id ?? CD_FORMAT_ID,
        genre_name: receivedBody.genre_id === JAZZ_GENRE_ID ? "Jazz" : "Rock",
        genre_id: receivedBody.genre_id ?? ROCK_GENRE_ID,
        label: receivedBody.label ?? "Sonamos",
        disc_quantity: receivedBody.disc_quantity ?? 1,
        alternate_artist_name:
          "alternate_artist_name" in receivedBody ? receivedBody.alternate_artist_name : null,
      });
    }),
  );
  return {
    getReceivedBody: () => receivedBody,
    getCallCount: () => callCount,
  };
}

describe("AlbumEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenresAndFormats();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByLabelText("Title")).not.toBeInTheDocument(),
      );
    });

    it("renders the form for a Music Director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

      expect(await screen.findByLabelText("Title")).toBeInTheDocument();
    });
  });

  describe("as a Music Director", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    describe("initial state", () => {
      it("seeds every field from the album", async () => {
        renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        expect(await screen.findByLabelText("Title")).toHaveValue("DOGA");
        expect(screen.getByLabelText("Label")).toHaveValue("Sonamos");
        await waitFor(() =>
          expect(screen.getByRole("combobox", { name: "Genre" })).toHaveTextContent("Rock"),
        );
        await waitFor(() =>
          expect(screen.getByRole("combobox", { name: "Format" })).toHaveTextContent("CD"),
        );
        expect(screen.getByLabelText("Search artists")).toHaveValue("Juana Molina");
        expect(screen.getByLabelText("Disc Quantity")).toHaveValue(1);
      });

      it("renders album_artist read-only with an explanatory note", async () => {
        renderWithProviders(
          <AlbumEditForm album={juanaMolinaAlbum({ album_artist: "Various Artists" })} />,
        );

        const field = await screen.findByLabelText("Album Artist");
        expect(field).toHaveValue("Various Artists");
        expect(field).toBeDisabled();
        expect(screen.getByText(/isn't supported yet/)).toBeInTheDocument();
      });

      it("disables Save until a field changes", async () => {
        renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        await screen.findByLabelText("Title");
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      });
    });

    describe("saving", () => {
      it("sends exactly one PATCH containing only the changed fields", async () => {
        const { getReceivedBody, getCallCount } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "DOGA (Reissue)");

        const label = screen.getByLabelText("Label");
        await user.clear(label);
        await user.type(label, "Sonamos Discos");

        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(getCallCount()).toBe(1));
        expect(getReceivedBody()).toEqual({
          album_title: "DOGA (Reissue)",
          label: "Sonamos Discos",
        });
      });

      it("never includes album_artist in the outgoing body", async () => {
        const { getReceivedBody } = mockPatch();
        const { user } = renderWithProviders(
          <AlbumEditForm album={juanaMolinaAlbum({ album_artist: "Various Artists" })} />,
        );

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "New Title");
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(getReceivedBody()).toBeDefined());
        expect(getReceivedBody()).not.toHaveProperty("album_artist");
      });

      it("re-hides Save and resets the baseline after a successful save", async () => {
        mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "New Title");
        expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() =>
          expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(),
        );
      });
    });

    describe("clearing nullable fields", () => {
      it("sends alternate_artist_name: null when the field is cleared", async () => {
        const { getReceivedBody } = mockPatch();
        const { user } = renderWithProviders(
          <AlbumEditForm album={juanaMolinaAlbum({ alternate_artist: "Various" })} />,
        );

        const field = await screen.findByLabelText("Alternate Artist Name");
        await user.clear(field);
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() =>
          expect(getReceivedBody()).toEqual({ alternate_artist_name: null }),
        );
      });

      it("sends label_id: null when 'Clear linked label record' is toggled", async () => {
        const { getReceivedBody } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const clearSwitch = await screen.findByLabelText("Clear linked label record");
        await user.click(clearSwitch);
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(getReceivedBody()).toEqual({ label_id: null }));
      });
    });

    describe("genre change invalidates a seeded artist link", () => {
      it("drops the seeded artist_id and blocks Save until a fresh pick is made", async () => {
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const artistInput = await screen.findByLabelText("Search artists");
        expect(artistInput).toHaveValue("Juana Molina");

        const genreSelect = screen.getByRole("combobox", { name: "Genre" });
        await user.click(genreSelect);
        await user.click(await screen.findByRole("option", { name: "Jazz" }));

        // Text is left standing (the MD still needs it to re-pick under Jazz)
        // but the seeded id must no longer be submittable.
        expect(artistInput).toHaveValue("Juana Molina");
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
        expect(
          screen.getByText(/select an artist to continue/i),
        ).toBeInTheDocument();
      });

      it("never PATCHes a genre_id/artist_id pair resolved under different genres", async () => {
        const { getReceivedBody, getCallCount } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        await screen.findByLabelText("Title");
        const genreSelect = screen.getByRole("combobox", { name: "Genre" });
        await user.click(genreSelect);
        await user.click(await screen.findByRole("option", { name: "Jazz" }));

        // Save is disabled by the invalid artist link, so it cannot be
        // clicked at all (pointer-events are suppressed on disabled
        // controls) — the important assertion is that no PATCH ever fires.
        const saveButton = screen.getByRole("button", { name: "Save" });
        expect(saveButton).toBeDisabled();

        expect(getCallCount()).toBe(0);
        expect(getReceivedBody()).toBeUndefined();
      });

      it("re-enables Save once the artist is re-picked under the new genre", async () => {
        const { getReceivedBody } = mockPatch();
        mockArtistSearch([
          {
            id: JUANA_JAZZ_ARTIST_ID,
            artist_name: "Juana Molina",
            code_letters: "MO",
            code_number: 4,
          },
        ]);
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        await screen.findByLabelText("Title");
        await user.click(screen.getByRole("combobox", { name: "Genre" }));
        await user.click(await screen.findByRole("option", { name: "Jazz" }));

        const artistInput = screen.getByLabelText("Search artists");
        await user.click(artistInput);
        await user.click(await screen.findByText("Juana Molina"));

        const saveButton = screen.getByRole("button", { name: "Save" });
        await waitFor(() => expect(saveButton).toBeEnabled());
        await user.click(saveButton);

        await waitFor(() =>
          expect(getReceivedBody()).toEqual({
            genre_id: JAZZ_GENRE_ID,
            artist_id: JUANA_JAZZ_ARTIST_ID,
          }),
        );
      });
    });
  });
});
