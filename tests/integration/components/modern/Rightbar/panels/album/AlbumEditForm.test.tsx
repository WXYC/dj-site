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
import {
  ALBUM_TEXT_MAX_LENGTH,
  DISC_QUANTITY_MAX,
  DISC_QUANTITY_MIN,
} from "@/lib/features/catalog/constants";
import AlbumEditForm from "@/src/components/experiences/modern/Rightbar/panels/album/AlbumEditForm";
import DiscogsUnavailableControl from "@/src/components/experiences/modern/Rightbar/panels/album/DiscogsUnavailableControl";

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
import { toast } from "sonner";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastInfo = toast.info as ReturnType<typeof vi.fn>;

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
const JESSICA_ARTIST_ID = 600;

const SAVE_BUTTON = { name: "Save Release" };

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

const GENRE_NAMES: Record<number, string> = {
  [ROCK_GENRE_ID]: "Rock",
  [JAZZ_GENRE_ID]: "Jazz",
};
const FORMAT_NAMES: Record<number, string> = {
  [CD_FORMAT_ID]: "CD",
  [VINYL_FORMAT_ID]: "Vinyl",
};
const ARTIST_NAMES: Record<number, string> = {
  [JUANA_ARTIST_ID]: "Juana Molina",
  [JUANA_JAZZ_ARTIST_ID]: "Juana Molina",
  [JESSICA_ARTIST_ID]: "Jessica Pratt",
};

/**
 * Answers with the row as the server would leave it: seeded from the album
 * under test, then the received partial applied on top. The response is what
 * reseeds the form, so a fake that echoed fixed defaults instead of the row's
 * own values would let a reseed bug pass unseen — and would answer a
 * `label_id: null` clear with the label still set, which the server never does.
 * Omitting a field is a no-op, matching true-partial-update semantics.
 *
 * `gate`, when supplied, holds the response open until it settles — the window
 * in which Backend-Service awaits its post-update enrichment (a streaming check
 * plus a metadata lookup) before answering, which is measured in seconds for
 * exactly the fields this form edits.
 */
function mockPatch({
  gate,
  album = juanaMolinaAlbum(),
}: { gate?: Promise<unknown>; album?: ReturnType<typeof juanaMolinaAlbum> } = {}) {
  let receivedBody: Record<string, unknown> | undefined;
  let callCount = 0;
  const row: Record<string, unknown> = {
    id: album.id,
    album_title: album.title,
    artist_name: album.artist.name,
    artist_id: album.artist_id,
    code_letters: album.artist.lettercode,
    code_number: album.entry,
    code_artist_number: album.artist.numbercode,
    format_name: album.format,
    format_id: album.format_id,
    genre_name: album.artist.genre,
    genre_id: album.genre_id,
    label: album.label,
    disc_quantity: album.disc_quantity,
    alternate_artist_name: album.alternate_artist || null,
    album_artist: album.album_artist,
  };

  server.use(
    http.patch(`${TEST_BACKEND_URL}/library/:id`, async ({ request }) => {
      callCount++;
      receivedBody = (await request.json()) as Record<string, unknown>;

      if ("album_title" in receivedBody) row.album_title = receivedBody.album_title;
      if ("label" in receivedBody) row.label = receivedBody.label;
      // The server treats label_id: null as clearing both columns together.
      if (receivedBody.label_id === null) row.label = null;
      if ("alternate_artist_name" in receivedBody)
        row.alternate_artist_name = receivedBody.alternate_artist_name;
      if ("disc_quantity" in receivedBody) row.disc_quantity = receivedBody.disc_quantity;
      if (typeof receivedBody.genre_id === "number") {
        row.genre_id = receivedBody.genre_id;
        row.genre_name = GENRE_NAMES[receivedBody.genre_id];
      }
      if (typeof receivedBody.format_id === "number") {
        row.format_id = receivedBody.format_id;
        row.format_name = FORMAT_NAMES[receivedBody.format_id];
      }
      if (typeof receivedBody.artist_id === "number") {
        row.artist_id = receivedBody.artist_id;
        row.artist_name = ARTIST_NAMES[receivedBody.artist_id];
      }

      if (gate) await gate;
      return HttpResponse.json({ ...row });
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
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
      });

      // Rows predating the write path's trimming can carry padding; comparing a
      // trimmed draft against an untrimmed baseline would arm Save with no user
      // edit, and a trim-only PATCH still moves the catalog watermark.
      it("treats whitespace-padded stored values as unchanged", async () => {
        renderWithProviders(
          <AlbumEditForm
            album={juanaMolinaAlbum({
              title: "DOGA ",
              label: " Sonamos",
              alternate_artist: " ",
            })}
          />,
        );

        expect(await screen.findByLabelText("Title")).toHaveValue("DOGA");
        expect(screen.getByLabelText("Label")).toHaveValue("Sonamos");
        expect(screen.getByLabelText("Alternate Artist Name")).toHaveValue("");
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
      });
    });

    describe("saving", () => {
      it("sends exactly one PATCH containing only the changed fields", async () => {
        const { getReceivedBody, getCallCount } = mockPatch();
        mockArtistSearch([
          {
            id: JUANA_JAZZ_ARTIST_ID,
            artist_name: "Juana Molina",
            code_letters: "MO",
            code_number: 4,
          },
        ]);
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "DOGA (Reissue)");

        const label = screen.getByLabelText("Label");
        await user.clear(label);
        await user.type(label, "Sonamos Discos");

        await user.click(screen.getByRole("combobox", { name: "Format" }));
        await user.click(await screen.findByRole("option", { name: "Vinyl" }));

        const discQuantity = screen.getByLabelText("Disc Quantity");
        await user.clear(discQuantity);
        await user.type(discQuantity, "2");

        await user.click(screen.getByRole("combobox", { name: "Genre" }));
        await user.click(await screen.findByRole("option", { name: "Jazz" }));

        const artistInput = screen.getByLabelText("Search artists");
        await user.click(artistInput);
        await user.click(await screen.findByText("Juana Molina"));

        const saveButton = screen.getByRole("button", SAVE_BUTTON);
        await waitFor(() => expect(saveButton).toBeEnabled());
        await user.click(saveButton);

        await waitFor(() => expect(getCallCount()).toBe(1));
        expect(getReceivedBody()).toEqual({
          album_title: "DOGA (Reissue)",
          label: "Sonamos Discos",
          genre_id: JAZZ_GENRE_ID,
          format_id: VINYL_FORMAT_ID,
          artist_id: JUANA_JAZZ_ARTIST_ID,
          disc_quantity: 2,
        });
      });

      it("never includes album_artist in the outgoing body", async () => {
        const album = juanaMolinaAlbum({ album_artist: "Various Artists" });
        const { getReceivedBody } = mockPatch({ album });
        const { user } = renderWithProviders(<AlbumEditForm album={album} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "New Title");
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        await waitFor(() => expect(getReceivedBody()).toBeDefined());
        expect(getReceivedBody()).not.toHaveProperty("album_artist");
      });

      // Save is disabled the instant the click dispatches (the button is in its
      // loading state), so asserting that alone would pass on the in-flight
      // render and never observe the response. The baseline reset is only
      // visible once the save has settled: the fields must hold the saved
      // values, and Save must be disabled because they now match the baseline,
      // not because a request is open.
      it("disables Save again and resets the baseline after a successful save", async () => {
        const { getReceivedBody } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "New Title");
        const label = screen.getByLabelText("Label");
        await user.clear(label);
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeEnabled();

        await user.click(screen.getByRole("button", SAVE_BUTTON));

        await waitFor(() =>
          expect(mockToastSuccess).toHaveBeenCalledWith("Album updated"),
        );
        expect(getReceivedBody()).toEqual({
          album_title: "New Title",
          label_id: null,
        });
        expect(title).toHaveValue("New Title");
        expect(label).toHaveValue("");
        expect(title).toBeEnabled();
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
      });

      // Every field is reseeded from the response, so a value the server
      // normalised or filled in on its own must land back in the form — and a
      // second save must then diff against that, not against what was typed.
      it("reseeds from the response and diffs the next save against it", async () => {
        const { getReceivedBody } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        await screen.findByLabelText("Title");
        await user.click(screen.getByRole("combobox", { name: "Format" }));
        await user.click(await screen.findByRole("option", { name: "Vinyl" }));
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        await waitFor(() =>
          expect(mockToastSuccess).toHaveBeenCalledWith("Album updated"),
        );
        await waitFor(() =>
          expect(screen.getByRole("combobox", { name: "Format" })).toHaveTextContent(
            "Vinyl",
          ),
        );

        const title = screen.getByLabelText("Title");
        await user.clear(title);
        await user.type(title, "DOGA (Reissue)");
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        // The format is no longer a change: the baseline moved with the save.
        await waitFor(() =>
          expect(getReceivedBody()).toEqual({ album_title: "DOGA (Reissue)" }),
        );
      });

      // The response reseeds every field, so a draft typed while the request is
      // open would be overwritten without a toast, a dirty marker, or any other
      // trace. Locking the fields for the duration is what makes that
      // unreachable.
      it("locks every field while the save is in flight so an edit can't be discarded", async () => {
        let releaseResponse: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
          releaseResponse = resolve;
        });
        mockPatch({ gate });
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "DOGA (Reissue)");
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        const label = screen.getByLabelText("Label");
        await waitFor(() => expect(label).toBeDisabled());
        expect(title).toBeDisabled();
        expect(screen.getByLabelText("Alternate Artist Name")).toBeDisabled();
        expect(screen.getByLabelText("Disc Quantity")).toBeDisabled();
        expect(screen.getByLabelText("Search artists")).toBeDisabled();
        // Genre is the field the artist-link invariant turns on: a genre moved
        // inside the request window would be reseeded away by the response
        // while the artist link it invalidated had no chance to be re-picked.
        expect(screen.getByRole("combobox", { name: "Genre" })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: "Format" })).toBeDisabled();

        await user.type(label, " Discos");
        expect(label).toHaveValue("Sonamos");

        releaseResponse?.();
        await waitFor(() => expect(title).toBeEnabled());
        expect(title).toHaveValue("DOGA (Reissue)");
        expect(label).toHaveValue("Sonamos");
      });

      // Backend-Service answers every rejection with a specific reason and the
      // global RTK Query error middleware toasts it; a second unconditional
      // toast from this form would bury it.
      it("lets the server's own rejection reason through instead of a generic toast", async () => {
        server.use(
          http.patch(`${TEST_BACKEND_URL}/library/:id`, () =>
            HttpResponse.json(
              { message: "Artist is not catalogued in the selected genre" },
              { status: 400 },
            ),
          ),
        );
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "New Title");
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        await waitFor(() =>
          expect(mockToastError).toHaveBeenCalledWith(
            "Artist is not catalogued in the selected genre",
          ),
        );
        expect(mockToastError).not.toHaveBeenCalledWith("Failed to update album");
      });

      it("falls back to a generic toast when the rejection carries no message", async () => {
        server.use(
          http.patch(`${TEST_BACKEND_URL}/library/:id`, () =>
            HttpResponse.json({}, { status: 500 }),
          ),
        );
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "New Title");
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        await waitFor(() =>
          expect(mockToastError).toHaveBeenCalledWith("Failed to update album"),
        );
      });
    });

    describe("clearing nullable fields", () => {
      it("sends the typed alternate_artist_name when the field is set", async () => {
        const { getReceivedBody } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const field = await screen.findByLabelText("Alternate Artist Name");
        await user.type(field, "Juana Molina y Los Hermanos");
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        await waitFor(() =>
          expect(getReceivedBody()).toEqual({
            alternate_artist_name: "Juana Molina y Los Hermanos",
          }),
        );
      });

      it("sends alternate_artist_name: null when the field is cleared", async () => {
        const album = juanaMolinaAlbum({ alternate_artist: "Various" });
        const { getReceivedBody } = mockPatch({ album });
        const { user } = renderWithProviders(<AlbumEditForm album={album} />);

        const field = await screen.findByLabelText("Alternate Artist Name");
        await user.clear(field);
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        await waitFor(() =>
          expect(getReceivedBody()).toEqual({ alternate_artist_name: null }),
        );
      });

      it("sends label_id: null (not an empty label string) when the Label field is cleared", async () => {
        const { getReceivedBody } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const field = await screen.findByLabelText("Label");
        await user.clear(field);
        await user.click(screen.getByRole("button", SAVE_BUTTON));

        await waitFor(() => expect(getReceivedBody()).toEqual({ label_id: null }));
      });
    });

    describe("required fields", () => {
      it("blocks Save and never sends an empty title", async () => {
        const { getCallCount } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);

        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
        expect(screen.getByText("Title can't be empty.")).toBeInTheDocument();
        expect(getCallCount()).toBe(0);
      });

      it("blocks Save when a previously-set disc quantity is cleared", async () => {
        const { getCallCount } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const discQuantity = await screen.findByLabelText("Disc Quantity");
        await user.clear(discQuantity);

        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
        expect(getCallCount()).toBe(0);
      });
    });

    // Backend-Service rejects each of these with its own 400; enforcing them
    // here keeps a round trip from being spent on a value the form can already
    // see is out of range.
    describe("server-side limits enforced before the request", () => {
      it.each([
        ["Title", "Title"],
        ["Label", "Label"],
        ["Alternate Artist Name", "Alternate artist name"],
      ])("blocks Save when %s exceeds the column length", async (fieldLabel, message) => {
        const { getCallCount } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const field = await screen.findByLabelText(fieldLabel);
        await user.clear(field);
        await user.paste("D".repeat(ALBUM_TEXT_MAX_LENGTH + 1));

        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
        expect(
          screen.getByText(
            `${message} must be ${ALBUM_TEXT_MAX_LENGTH} characters or fewer.`,
          ),
        ).toBeInTheDocument();
        expect(getCallCount()).toBe(0);
      });

      it.each([
        ["below the minimum", String(DISC_QUANTITY_MIN - 1)],
        ["above the maximum", String(DISC_QUANTITY_MAX + 1)],
      ])("blocks Save when disc quantity is %s", async (_case, value) => {
        const { getCallCount } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const discQuantity = await screen.findByLabelText("Disc Quantity");
        await user.clear(discQuantity);
        await user.type(discQuantity, value);

        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
        expect(
          screen.getByText(
            `Disc quantity must be a whole number between ${DISC_QUANTITY_MIN} and ${DISC_QUANTITY_MAX}.`,
          ),
        ).toBeInTheDocument();
        expect(getCallCount()).toBe(0);
      });
    });

    // `library.disc_quantity` is a plain smallint with no CHECK behind it, and
    // neither the API's insert path nor the tubafrenzy ETL bounds it, so rows
    // outside 1-99 are already on the shelf. The range is a rule about the
    // value being written, not about the row: holding an untouched stored value
    // to it would make the album permanently uneditable, since every unrelated
    // edit would be blocked until someone invented a disc count for it.
    describe("an album stored outside the disc-quantity range", () => {
      it.each([
        ["below the minimum", DISC_QUANTITY_MIN - 1],
        ["above the maximum", DISC_QUANTITY_MAX + 1],
      ])("still saves an unrelated edit when the stored value is %s", async (_case, stored) => {
        const album = juanaMolinaAlbum({ disc_quantity: stored });
        const { getReceivedBody, getCallCount } = mockPatch({ album });
        const { user } = renderWithProviders(<AlbumEditForm album={album} />);

        const title = await screen.findByLabelText("Title");
        expect(screen.getByLabelText("Disc Quantity")).toHaveValue(stored);
        await user.clear(title);
        await user.type(title, "DOGA (Reissue)");

        expect(
          screen.queryByText(
            `Disc quantity must be a whole number between ${DISC_QUANTITY_MIN} and ${DISC_QUANTITY_MAX}.`,
          ),
        ).not.toBeInTheDocument();

        const saveButton = screen.getByRole("button", SAVE_BUTTON);
        expect(saveButton).toBeEnabled();
        await user.click(saveButton);

        await waitFor(() => expect(getCallCount()).toBe(1));
        expect(getReceivedBody()).toEqual({ album_title: "DOGA (Reissue)" });
      });

      it("still blocks Save once the MD types a fresh out-of-range value", async () => {
        const album = juanaMolinaAlbum({ disc_quantity: DISC_QUANTITY_MIN - 1 });
        const { getCallCount } = mockPatch({ album });
        const { user } = renderWithProviders(<AlbumEditForm album={album} />);

        const discQuantity = await screen.findByLabelText("Disc Quantity");
        await user.clear(discQuantity);
        await user.type(discQuantity, String(DISC_QUANTITY_MAX + 1));

        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
        expect(
          screen.getByText(
            `Disc quantity must be a whole number between ${DISC_QUANTITY_MIN} and ${DISC_QUANTITY_MAX}.`,
          ),
        ).toBeInTheDocument();
        expect(getCallCount()).toBe(0);
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
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
        expect(
          screen.getByText(/the previous link no longer applies under this genre/i),
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
        const saveButton = screen.getByRole("button", SAVE_BUTTON);
        expect(saveButton).toBeDisabled();

        expect(getCallCount()).toBe(0);
        expect(getReceivedBody()).toBeUndefined();
      });

      it("re-enables Save once the artist is re-picked under the new genre", async () => {
        const { getReceivedBody } = mockPatch();
        const searchRequests = mockArtistSearch([
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

        // The rows offered must come from the genre now selected, not the one
        // the album arrived under — picking a Rock-only artist while filing
        // under Jazz is the 400 this whole invalidation design exists to avoid.
        expect(searchRequests.length).toBeGreaterThan(0);
        expect(searchRequests.at(-1)?.searchParams.get("genre_id")).toBe(
          String(JAZZ_GENRE_ID),
        );

        const saveButton = screen.getByRole("button", SAVE_BUTTON);
        await waitFor(() => expect(saveButton).toBeEnabled());
        await user.click(saveButton);

        await waitFor(() =>
          expect(getReceivedBody()).toEqual({
            genre_id: JAZZ_GENRE_ID,
            artist_id: JUANA_JAZZ_ARTIST_ID,
          }),
        );
      });

      // The invalidation is a comparison against the genre the link was
      // resolved under, not an erasure — otherwise returning the genre to where
      // it started leaves an album whose every field reads its original value
      // with Save permanently blocked and nothing explaining why.
      it("restores the seeded link when the genre returns to the one it was resolved under", async () => {
        const { getReceivedBody } = mockPatch();
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "DOGA (Reissue)");

        await user.click(screen.getByRole("combobox", { name: "Genre" }));
        await user.click(await screen.findByRole("option", { name: "Jazz" }));
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();

        await user.click(screen.getByRole("combobox", { name: "Genre" }));
        await user.click(await screen.findByRole("option", { name: "Rock" }));

        expect(
          screen.queryByText(/select an artist to continue/i),
        ).not.toBeInTheDocument();
        const saveButton = screen.getByRole("button", SAVE_BUTTON);
        await waitFor(() => expect(saveButton).toBeEnabled());
        await user.click(saveButton);

        await waitFor(() =>
          expect(getReceivedBody()).toEqual({ album_title: "DOGA (Reissue)" }),
        );
      });
    });

    // The typeahead always offers its create-new row. This form can't honour
    // it and has nowhere to send the MD, so the message must describe what is
    // actually possible instead of naming a flow that doesn't exist.
    it("explains that a new artist can't be created from here", async () => {
      const { getCallCount } = mockPatch();
      mockArtistSearch([]);
      const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

      const artistInput = await screen.findByLabelText("Search artists");
      await user.clear(artistInput);
      await user.type(artistInput, "Csillagrablók");
      await user.click(await screen.findByText(/Create new artist/));

      expect(mockToastInfo).toHaveBeenCalledWith(
        expect.stringContaining("Csillagrablók"),
      );
      expect(mockToastInfo.mock.calls[0][0]).not.toMatch(/artist-add flow/);
      expect(getCallCount()).toBe(0);
    });

    // The typeahead retracts only the selections it reported through its own
    // `onSelect`, and this form has to drop the id when it does — otherwise a
    // picked link outlives the text that produced it.
    describe("typeahead retraction of a picked artist", () => {
      it("blocks Save once the artist text is edited away from the picked artist", async () => {
        const { getCallCount } = mockPatch();
        mockArtistSearch([
          {
            id: JUANA_ARTIST_ID,
            artist_name: "Juana Molina",
            code_letters: "MO",
            code_number: 12,
          },
        ]);
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "DOGA (Reissue)");

        const artistInput = screen.getByLabelText("Search artists");
        await user.click(artistInput);
        await user.click(await screen.findByText("Juana Molina"));

        const saveButton = screen.getByRole("button", SAVE_BUTTON);
        await waitFor(() => expect(saveButton).toBeEnabled());

        await user.type(artistInput, " Trio");

        await waitFor(() => expect(saveButton).toBeDisabled());
        expect(
          screen.getByText("Search and select an artist to continue."),
        ).toBeInTheDocument();
        expect(getCallCount()).toBe(0);
      });

      // The typeahead reports a genre move through the same callback as a text
      // edit, but only the text edit unmakes the pick — so a picked link has to
      // survive a genre round trip exactly as a seeded one does, and say so.
      it("restores a picked link when the genre returns to the one it was picked under", async () => {
        const { getReceivedBody } = mockPatch();
        mockArtistSearch([
          {
            id: JUANA_ARTIST_ID,
            artist_name: "Juana Molina",
            code_letters: "MO",
            code_number: 12,
          },
        ]);
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const title = await screen.findByLabelText("Title");
        await user.clear(title);
        await user.type(title, "DOGA (Reissue)");

        const artistInput = screen.getByLabelText("Search artists");
        await user.click(artistInput);
        await user.click(await screen.findByText("Juana Molina"));

        await user.click(screen.getByRole("combobox", { name: "Genre" }));
        await user.click(await screen.findByRole("option", { name: "Jazz" }));
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
        expect(
          screen.getByText(/the previous link no longer applies under this genre/i),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("combobox", { name: "Genre" }));
        await user.click(await screen.findByRole("option", { name: "Rock" }));

        expect(
          screen.queryByText(/select an artist to continue/i),
        ).not.toBeInTheDocument();
        const saveButton = screen.getByRole("button", SAVE_BUTTON);
        await waitFor(() => expect(saveButton).toBeEnabled());
        await user.click(saveButton);

        await waitFor(() =>
          expect(getReceivedBody()).toEqual({ album_title: "DOGA (Reissue)" }),
        );
      });

      // The typeahead retracts at most once per selection and stops tracking
      // that selection afterwards, so a link restored by a genre round trip has
      // nothing left to announce a later text edit. The form has to judge the
      // link against the field itself — otherwise Save re-attributes the album
      // to an artist the field visibly does not name, and the server can burn a
      // fresh call number doing it.
      it("blocks Save when a restored link's artist text is edited without a fresh pick", async () => {
        const { getCallCount } = mockPatch();
        mockArtistSearch([
          {
            id: JESSICA_ARTIST_ID,
            artist_name: "Jessica Pratt",
            code_letters: "PR",
            code_number: 3,
          },
        ]);
        const { user } = renderWithProviders(<AlbumEditForm album={juanaMolinaAlbum()} />);

        const artistInput = await screen.findByLabelText("Search artists");
        await user.clear(artistInput);
        await user.type(artistInput, "Jessica");
        await user.click(await screen.findByText("Jessica Pratt"));

        const saveButton = screen.getByRole("button", SAVE_BUTTON);
        await waitFor(() => expect(saveButton).toBeEnabled());

        await user.click(screen.getByRole("combobox", { name: "Genre" }));
        await user.click(await screen.findByRole("option", { name: "Jazz" }));
        expect(saveButton).toBeDisabled();

        await user.click(screen.getByRole("combobox", { name: "Genre" }));
        await user.click(await screen.findByRole("option", { name: "Rock" }));
        await waitFor(() => expect(saveButton).toBeEnabled());

        // Retyping the album's original artist without picking a row: the field
        // reads "Juana Molina" while the held id is Jessica Pratt's.
        await user.clear(artistInput);
        await user.type(artistInput, "Juana Molina");

        await waitFor(() => expect(saveButton).toBeDisabled());
        expect(
          screen.getByText("Search and select an artist to continue."),
        ).toBeInTheDocument();
        expect(getCallCount()).toBe(0);
      });
    });

    describe("alongside the Discogs-unavailable toggle", () => {
      it("keeps both controls independently operable in the same panel", async () => {
        const album = juanaMolinaAlbum({ discogsUnavailable: true });
        const { getReceivedBody, getCallCount } = mockPatch({ album });
        const { user } = renderWithProviders(
          <>
            <DiscogsUnavailableControl album={album} />
            <AlbumEditForm album={album} />
          </>,
        );

        const title = await screen.findByLabelText("Title");
        await user.type(screen.getByLabelText("Reason (optional)"), "embargoed promo");

        // Two Save affordances share the panel; each must name its own scope.
        expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(getCallCount()).toBe(1));
        expect(getReceivedBody()).toEqual({
          discogsUnavailable: true,
          discogsUnavailableNote: "embargoed promo",
        });
        // The note save is scoped to the toggle: it leaves the edit form's
        // draft alone and does not arm its Save.
        expect(title).toHaveValue("DOGA");
        expect(screen.getByRole("button", SAVE_BUTTON)).toBeDisabled();
      });
    });
  });
});
