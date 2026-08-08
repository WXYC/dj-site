import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import AddReleasePanel from "@/src/components/experiences/modern/catalog/AddRelease/AddReleasePanel";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

// No <Toaster /> is mounted by renderWithProviders, so the panel's own
// validation toast and the store's rejected-query toast are both only
// observable through the mocked module.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import { toast } from "sonner";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;

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
const CD_FORMAT_ID = 2;

function mockLookups() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([{ id: ROCK_GENRE_ID, genre_name: "Rock" }]),
    ),
    http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
      HttpResponse.json([{ id: CD_FORMAT_ID, format_name: "CD" }]),
    ),
  );
}

function mockArtistSearch(artists: { id: number; artist_name: string; code_letters: string; code_number: number }[]) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, () =>
      HttpResponse.json({ artists }),
    ),
  );
}

function mockLabelSearch(labels: { id: number; label_name: string }[]) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/labels/search`, () => HttpResponse.json(labels)),
  );
}

/**
 * Installs the label-search handler and returns the list of requests it has
 * served, so a test can tell a cache hit (no new request) apart from a
 * refetch forced by invalidation.
 */
function mockLabelSearchTracking(
  respond: (url: URL) => Response | Promise<Response>,
): URL[] {
  const requests: URL[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/labels/search`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      return respond(url);
    }),
  );
  return requests;
}

function mockAddAlbum(
  respond: (body: unknown) => Response | Promise<Response> = () =>
    HttpResponse.json({ id: 999 }),
) {
  let receivedBody: unknown;
  server.use(
    http.post(`${TEST_BACKEND_URL}/library/`, async ({ request }) => {
      receivedBody = await request.json();
      return respond(receivedBody);
    }),
  );
  return () => receivedBody;
}

async function openPanel(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Add Release" }));
}

async function pickGenre(user: ReturnType<typeof renderWithProviders>["user"], name = "Rock") {
  await user.click(await screen.findByRole("combobox", { name: "Genre" }));
  await user.click(await screen.findByRole("option", { name }));
}

async function pickFormat(user: ReturnType<typeof renderWithProviders>["user"], name = "CD") {
  await user.click(await screen.findByRole("combobox", { name: "Format" }));
  await user.click(await screen.findByRole("option", { name }));
}

const SUGGESTION_FIELDS = [
  { name: "artist", placeholder: "Search artists...", term: "Juana" },
  { name: "label", placeholder: "Search labels...", term: "Sona" },
] as const;

/** The three fields backed by a real form control, which the browser's own constraint validation can refuse. */
const TEXT_FIELDS = ["album title", "artist", "label"] as const;
/**
 * Joy renders these two as buttons, which no constraint validation applies to,
 * so the submit handler's guard is the only thing that refuses them. Leaving
 * the genre unchosen also leaves the artist blank — the artist field does not
 * render without a genre — so that case pins the guard's refusal, not which of
 * its two clauses did the refusing.
 */
const SELECT_FIELDS = ["genre", "format"] as const;

type TextField = (typeof TEXT_FIELDS)[number];
type RequiredField = TextField | (typeof SELECT_FIELDS)[number];

const REQUIRED_FIELDS_MESSAGE =
  "Album title, genre, format, artist, and label are all required";

/** Non-empty, so it satisfies `required` and reaches the guard, which trims. */
const WHITESPACE_ONLY = "   ";

const textControl: Record<TextField, () => HTMLElement> = {
  "album title": () => screen.getByLabelText(/Album title/),
  artist: () => screen.getByPlaceholderText("Search artists..."),
  label: () => screen.getByPlaceholderText("Search labels..."),
};

/**
 * Fills every required field, leaving `blank` either untouched or holding only
 * whitespace. Leaving the genre untouched necessarily leaves the artist blank
 * too — the artist field does not render until a genre is chosen — so `blank`
 * is only ever a select in the untouched mode.
 */
async function fillForm(
  user: ReturnType<typeof renderWithProviders>["user"],
  blank: RequiredField,
  mode: "untouched" | "whitespace" = "untouched",
) {
  const textFor = (field: TextField, value: string) =>
    field !== blank ? value : mode === "whitespace" ? WHITESPACE_ONLY : "";

  const albumTitle = textFor("album title", "DOGA");
  if (albumTitle) {
    await user.type(screen.getByLabelText(/Album title/), albumTitle);
  }
  if (blank !== "genre") {
    await pickGenre(user);
  }
  if (blank !== "format") {
    await pickFormat(user);
  }
  const artist = textFor("artist", "Juana Molina");
  if (blank !== "genre" && artist) {
    await user.type(await screen.findByPlaceholderText("Search artists..."), artist);
  }
  const label = textFor("label", "Sonamos");
  if (label) {
    await user.type(await screen.findByPlaceholderText("Search labels..."), label);
  }
}

describe("AddReleasePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookups();
    mockArtistSearch([]);
    mockLabelSearch([]);
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<AddReleasePanel />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Add Release" })).not.toBeInTheDocument(),
      );
    });

    it("renders the trigger for a Music Director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<AddReleasePanel />);

      expect(await screen.findByRole("button", { name: "Add Release" })).toBeInTheDocument();
    });
  });

  describe("as a Music Director", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("disables the artist field until a genre is chosen", async () => {
      const { user } = renderWithProviders(<AddReleasePanel />);
      await openPanel(user);

      expect(screen.queryByPlaceholderText("Search artists...")).not.toBeInTheDocument();

      await pickGenre(user);

      expect(await screen.findByPlaceholderText("Search artists...")).toBeEnabled();
    });

    it("sends the resolved artist_id alongside artist_name and label_id when the MD picks existing rows, and never sends album_artist or code_number", async () => {
      mockArtistSearch([
        { id: 12, artist_name: "Juana Molina", code_letters: "MO", code_number: 3 },
      ]);
      mockLabelSearch([{ id: 5, label_name: "Sonamos" }]);
      const getReceivedBody = mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "DOGA");
      await pickGenre(user);
      await pickFormat(user);

      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Juana");
      await user.click(await screen.findByText("Juana Molina"));

      const labelInput = await screen.findByPlaceholderText("Search labels...");
      await user.type(labelInput, "Sona");
      await user.click(await screen.findByText("Sonamos"));

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      // artist_id and artist_name are both required on this path: the id
      // short-circuits genre-scoped resolution, and the name is what the
      // backend's post-insert metadata enrichment looks the release up by.
      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          album_title: "DOGA",
          genre_id: ROCK_GENRE_ID,
          format_id: CD_FORMAT_ID,
          artist_id: 12,
          artist_name: "Juana Molina",
          label: "Sonamos",
          label_id: 5,
        }),
      );
    });

    it("sends the label_id of a row the MD reached with the keyboard alone", async () => {
      mockLabelSearch([
        { id: 5, label_name: "Sonamos" },
        { id: 9, label_name: "Sonar" },
      ]);
      const getReceivedBody = mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "DOGA");
      await pickGenre(user);
      await pickFormat(user);
      await user.type(
        await screen.findByPlaceholderText("Search artists..."),
        "Juana Molina",
      );

      // A near-duplicate is only prevented if the existing row is reachable
      // without a pointer: a keyboard-only MD who can only submit their own
      // typing creates exactly the second label row the picker exists to stop.
      await user.type(await screen.findByPlaceholderText("Search labels..."), "Sona");
      await screen.findByText("Sonamos");
      await user.keyboard("{ArrowDown}{Enter}");

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          album_title: "DOGA",
          genre_id: ROCK_GENRE_ID,
          format_id: CD_FORMAT_ID,
          artist_name: "Juana Molina",
          label: "Sonamos",
          label_id: 5,
        }),
      );
    });

    it("sends free-typed artist_name and label when the MD does not pick a suggestion", async () => {
      const getReceivedBody = mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "On Your Own Love Again");
      await pickGenre(user);
      await pickFormat(user);

      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Jessica Pratt");

      const labelInput = await screen.findByPlaceholderText("Search labels...");
      await user.type(labelInput, "Drag City");

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          album_title: "On Your Own Love Again",
          genre_id: ROCK_GENRE_ID,
          format_id: CD_FORMAT_ID,
          artist_name: "Jessica Pratt",
          label: "Drag City",
        }),
      );
    });

    it("sends artist_name instead of a stale artist_id once the picked artist's text is edited", async () => {
      mockArtistSearch([
        { id: 12, artist_name: "Juana Molina", code_letters: "MO", code_number: 3 },
      ]);
      const getReceivedBody = mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "DOGA");
      await pickGenre(user);
      await pickFormat(user);

      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Juana");
      await user.click(await screen.findByText("Juana Molina"));

      // Edited away from the picked artist's name: the id no longer names
      // this text, so the retraction must drop it before submit.
      await user.type(artistInput, " Solo");

      const labelInput = await screen.findByPlaceholderText("Search labels...");
      await user.type(labelInput, "Sonamos");

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          album_title: "DOGA",
          genre_id: ROCK_GENRE_ID,
          format_id: CD_FORMAT_ID,
          artist_name: "Juana Molina Solo",
          label: "Sonamos",
        }),
      );
    });

    it("sends artist_name instead of a stale artist_id once the genre changes after a pick", async () => {
      const JAZZ_GENRE_ID = 11;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
          HttpResponse.json([
            { id: ROCK_GENRE_ID, genre_name: "Rock" },
            { id: JAZZ_GENRE_ID, genre_name: "Jazz" },
          ]),
        ),
      );
      mockArtistSearch([
        { id: 12, artist_name: "Juana Molina", code_letters: "MO", code_number: 3 },
      ]);
      const getReceivedBody = mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "DOGA");
      await pickGenre(user, "Rock");
      await pickFormat(user);

      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Juana");
      await user.click(await screen.findByText("Juana Molina"));

      // Artist rows are genre-scoped: the id picked under Rock names no row
      // under Jazz, so the resolved id must not survive the genre swap even
      // though the typed text is left standing.
      await pickGenre(user, "Jazz");

      const labelInput = await screen.findByPlaceholderText("Search labels...");
      await user.type(labelInput, "Sonamos");

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          album_title: "DOGA",
          genre_id: JAZZ_GENRE_ID,
          format_id: CD_FORMAT_ID,
          artist_name: "Juana Molina",
          label: "Sonamos",
        }),
      );
    });

    // An artist is mandatory to the backend but optional on the request type,
    // so nothing in the types stops a form that omits one. Two mechanisms hold
    // the line — native constraint validation and the submit handler's guard —
    // and each case pins whichever one applies. Asserting only that no body was
    // received cannot pin either: the interceptor assigns that body
    // asynchronously, so it reads as unset whether or not a request went out.
    it.each(TEXT_FIELDS)(
      "marks the %s required so an empty one never reaches the server",
      async (blank) => {
        const getReceivedBody = mockAddAlbum();
        const { user } = renderWithProviders(<AddReleasePanel />);

        await openPanel(user);
        await fillForm(user, blank);

        await user.click(screen.getByRole("button", { name: "Save Release" }));

        expect(textControl[blank]()).toBeInvalid();
        expect(getReceivedBody()).toBeUndefined();
      },
    );

    it.each(SELECT_FIELDS)(
      "reports the requirement and sends nothing when no %s is chosen",
      async (blank) => {
        const getReceivedBody = mockAddAlbum();
        const { user } = renderWithProviders(<AddReleasePanel />);

        await openPanel(user);
        await fillForm(user, blank);

        await user.click(screen.getByRole("button", { name: "Save Release" }));

        await waitFor(() =>
          expect(mockToastError).toHaveBeenCalledWith(REQUIRED_FIELDS_MESSAGE),
        );
        expect(getReceivedBody()).toBeUndefined();
      },
    );

    // `required` accepts a space, so whitespace is the one path on which a text
    // field reaches the submit handler blank — the case that pins the guard's
    // own trim, and with it the mandatory-artist contract the request type
    // leaves optional.
    it.each(TEXT_FIELDS)(
      "reports the requirement and sends nothing when the %s is only whitespace",
      async (blank) => {
        const getReceivedBody = mockAddAlbum();
        const { user } = renderWithProviders(<AddReleasePanel />);

        await openPanel(user);
        await fillForm(user, blank, "whitespace");

        await user.click(screen.getByRole("button", { name: "Save Release" }));

        await waitFor(() =>
          expect(mockToastError).toHaveBeenCalledWith(REQUIRED_FIELDS_MESSAGE),
        );
        expect(getReceivedBody()).toBeUndefined();
      },
    );

    it("routes the MD toward adding the artist instead of a generic error on a genre-scoped miss", async () => {
      mockAddAlbum(() =>
        HttpResponse.json(
          {
            message:
              "Artist doesn't exist or hasn't released an album in this genre before. Add a new artist entry to the library",
          },
          { status: 400 },
        ),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "Edits");
      await pickGenre(user);
      await pickFormat(user);

      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Chuquimamani-Condori");

      const labelInput = await screen.findByPlaceholderText("Search labels...");
      await user.type(labelInput, "self-released");

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      expect(
        await screen.findByText(/Chuquimamani-Condori.*isn't filed under Rock/i),
      ).toBeInTheDocument();
    });

    it("does not show guidance for the submitted term once the artist field is edited while the rejection is still in flight", async () => {
      let resolveResponse: (response: Response) => void;
      const responsePromise = new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      });
      const getReceivedBody = mockAddAlbum(() => responsePromise);
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "Edits");
      await pickGenre(user);
      await pickFormat(user);

      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Chuquimamani-Condori");

      const labelInput = await screen.findByPlaceholderText("Search labels...");
      await user.type(labelInput, "self-released");

      await user.click(screen.getByRole("button", { name: "Save Release" }));
      await waitFor(() => expect(getReceivedBody()).toBeDefined());

      // The field is never disabled while the mutation is in flight, so the
      // MD can correct it before the rejection they are still waiting on
      // arrives.
      await user.clear(artistInput);
      await user.type(artistInput, "DJ E");

      resolveResponse!(
        HttpResponse.json(
          {
            message:
              "Artist doesn't exist or hasn't released an album in this genre before. Add a new artist entry to the library",
          },
          { status: 400 },
        ),
      );

      await waitFor(() => expect(mockToastError).toHaveBeenCalled());

      // Guidance naming the submitted term would now describe text the field
      // no longer holds.
      expect(screen.queryByText(/isn't filed under/i)).not.toBeInTheDocument();
      expect(artistInput).toHaveValue("DJ E");
    });

    it("leaves a 400 that is not the genre-scoped miss to the generic error path", async () => {
      const BLANK_TITLE_MESSAGE = "album_title must be a non-empty string";
      mockAddAlbum(() =>
        HttpResponse.json({ message: BLANK_TITLE_MESSAGE }, { status: 400 }),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "Edits");
      await pickGenre(user);
      await pickFormat(user);
      await user.type(
        await screen.findByPlaceholderText("Search artists..."),
        "Chuquimamani-Condori",
      );
      await user.type(
        await screen.findByPlaceholderText("Search labels..."),
        "self-released",
      );

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      // The server's own message reaching the toast is the settle signal: the
      // rejection has been all the way through the store by then, so the
      // guidance's absence is a decision the panel made rather than a render
      // that has not happened yet. Routing every 400 to the artist-add form
      // would send the MD off to fix an artist that was never the problem.
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(BLANK_TITLE_MESSAGE),
      );
      expect(screen.queryByText(/isn't filed under/i)).not.toBeInTheDocument();
    });

    // The dialog's own Escape handler closes it and discards everything typed
    // so far, and it does not consult defaultPrevented — so a suggestion list
    // that merely prevents the default still loses the MD their work.
    it.each(SUGGESTION_FIELDS)(
      "dismisses the $name suggestions on Escape without discarding the form",
      async ({ placeholder, term }) => {
        mockArtistSearch([
          { id: 12, artist_name: "Juana Molina", code_letters: "MO", code_number: 3 },
        ]);
        mockLabelSearch([{ id: 5, label_name: "Sonamos" }]);
        const { user } = renderWithProviders(<AddReleasePanel />);

        await openPanel(user);
        await user.type(screen.getByLabelText(/Album title/), "DOGA");
        await pickGenre(user);
        await user.type(await screen.findByPlaceholderText(placeholder), term);
        await screen.findByRole("listbox");

        await user.keyboard("{Escape}");

        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save Release" })).toBeInTheDocument();
        expect(screen.getByLabelText(/Album title/)).toHaveValue("DOGA");
        expect(screen.getByPlaceholderText(placeholder)).toHaveValue(term);
      },
    );

    it("retires a resolved artist_id when the MD chooses to create the artist instead", async () => {
      mockArtistSearch([
        { id: 12, artist_name: "Juana Molina", code_letters: "MO", code_number: 3 },
      ]);
      const getReceivedBody = mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "DOGA");
      await pickGenre(user);
      await pickFormat(user);

      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Juana");
      await user.click(await screen.findByText("Juana Molina"));

      // Reopening over the cached rows and taking the create row instead never
      // edits the text, so the typeahead's own retraction never fires: the
      // panel has to drop the id itself, or it files the release against the
      // very artist it is telling the MD does not exist yet.
      await user.click(artistInput);
      await user.click(await screen.findByText(/Create new artist/i));
      await user.type(
        await screen.findByPlaceholderText("Search labels..."),
        "Sonamos",
      );

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          album_title: "DOGA",
          genre_id: ROCK_GENRE_ID,
          format_id: CD_FORMAT_ID,
          artist_name: "Juana Molina",
          label: "Sonamos",
        }),
      );
    });

    it("drops the artist-add guidance once the artist text moves off the term that missed", async () => {
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await pickGenre(user);

      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Chuquimamani-Condori");
      await user.click(await screen.findByText(/Create new artist/i));
      await screen.findByText(/Chuquimamani-Condori.*isn't filed under Rock/i);

      await user.type(artistInput, " II");

      expect(screen.queryByText(/isn't filed under/i)).not.toBeInTheDocument();
    });

    // The backend upserts labels on the exact name, so a stale empty result
    // served from cache after this panel files a new one sends the next MD
    // who searches for it back through the free-type path, filing a second,
    // near-duplicate row beside the one just created.
    it("invalidates the label search cache after a release is added with a free-typed label", async () => {
      const labelRequests = mockLabelSearchTracking(() => HttpResponse.json([]));
      const getReceivedBody = mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "Edits");
      await pickGenre(user);
      await pickFormat(user);
      await user.type(
        await screen.findByPlaceholderText("Search artists..."),
        "Chuquimamani-Condori",
      );
      const labelInput = await screen.findByPlaceholderText("Search labels...");
      await user.type(labelInput, "Duophonic");
      await screen.findByText(/will be created as a new label/i);

      await user.click(screen.getByRole("button", { name: "Save Release" }));
      await waitFor(() => expect(getReceivedBody()).toBeDefined());
      expect(labelRequests).toHaveLength(1);

      // Reopening and searching the exact term the panel just filed — a
      // stale cache would serve the earlier empty result without a new
      // request, hiding the label the backend just created.
      await openPanel(user);
      await user.type(
        await screen.findByPlaceholderText("Search labels..."),
        "Duophonic",
      );

      await waitFor(() => expect(labelRequests.length).toBeGreaterThan(1));
    });

    it("closes and resets the form after a successful add", async () => {
      mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "DOGA");
      await pickGenre(user);
      await pickFormat(user);
      const artistInput = await screen.findByPlaceholderText("Search artists...");
      await user.type(artistInput, "Juana Molina");
      const labelInput = await screen.findByPlaceholderText("Search labels...");
      await user.type(labelInput, "Sonamos");

      await user.click(screen.getByRole("button", { name: "Save Release" }));

      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Save Release" })).not.toBeInTheDocument(),
      );
      // A silent close on success is indistinguishable from an accidental
      // dismissal, which invites a duplicate re-add of the same release.
      expect(mockToastSuccess).toHaveBeenCalledWith('Added "DOGA" to the catalog');

      await openPanel(user);

      // Every field, not just the title: a partial reset is how the next
      // release silently inherits the previous one's artist and label, and the
      // ids behind those two carry over invisibly because the text they belong
      // to is the only thing on screen.
      expect(screen.getByLabelText(/Album title/)).toHaveValue("");
      expect(screen.getByRole("combobox", { name: "Genre" })).toHaveTextContent(
        "Choose a genre...",
      );
      expect(screen.getByRole("combobox", { name: "Format" })).toHaveTextContent(
        "Choose a format...",
      );
      // No genre means no artist typeahead, so the artist text is gone with it.
      expect(screen.queryByPlaceholderText("Search artists...")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search labels...")).toHaveValue("");
    });

    // Two complete form fills, each driving both typeaheads through their
    // 300ms debounce, run close enough to the default 5s test timeout that a
    // loaded full-suite run can miss it — an explicit longer budget keeps
    // that a timing margin rather than a flake.
    it("carries no resolved artist_id or label_id into the next release", async () => {
      mockArtistSearch([
        { id: 12, artist_name: "Juana Molina", code_letters: "MO", code_number: 3 },
      ]);
      mockLabelSearch([{ id: 5, label_name: "Sonamos" }]);
      const getReceivedBody = mockAddAlbum();
      const { user } = renderWithProviders(<AddReleasePanel />);

      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "DOGA");
      await pickGenre(user);
      await pickFormat(user);
      await user.type(await screen.findByPlaceholderText("Search artists..."), "Juana");
      await user.click(await screen.findByText("Juana Molina"));
      await user.type(await screen.findByPlaceholderText("Search labels..."), "Sona");
      await user.click(await screen.findByText("Sonamos"));
      await user.click(screen.getByRole("button", { name: "Save Release" }));
      await waitFor(() => expect(getReceivedBody()).toBeDefined());

      // Both ids live in state the reopened form still holds unless the reset
      // clears them, and neither is visible in the UI once their text is gone.
      mockArtistSearch([]);
      mockLabelSearch([]);
      await openPanel(user);
      await user.type(screen.getByLabelText(/Album title/), "On Your Own Love Again");
      await pickGenre(user);
      await pickFormat(user);
      await user.type(
        await screen.findByPlaceholderText("Search artists..."),
        "Jessica Pratt",
      );
      await user.type(
        await screen.findByPlaceholderText("Search labels..."),
        "Drag City",
      );
      await user.click(screen.getByRole("button", { name: "Save Release" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          album_title: "On Your Own Love Again",
          genre_id: ROCK_GENRE_ID,
          format_id: CD_FORMAT_ID,
          artist_name: "Jessica Pratt",
          label: "Drag City",
        }),
      );
    }, 10000);

    // Modal's onClose fires alike for the close button, a backdrop click,
    // and an Escape that reaches the dialog — all three would otherwise wipe
    // a part-filled form with no undo.
    describe("dismissing with unsaved input", () => {
      const closeButton = () => screen.getByTestId("CloseIcon");

      it("asks for confirmation and leaves the form standing when declined", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        const { user } = renderWithProviders(<AddReleasePanel />);

        await openPanel(user);
        await user.type(screen.getByLabelText(/Album title/), "DOGA");

        await user.click(closeButton());

        expect(confirmSpy).toHaveBeenCalled();
        expect(screen.getByLabelText(/Album title/)).toHaveValue("DOGA");
        confirmSpy.mockRestore();
      });

      it("discards the form once the confirmation is accepted", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        const { user } = renderWithProviders(<AddReleasePanel />);

        await openPanel(user);
        await user.type(screen.getByLabelText(/Album title/), "DOGA");

        await user.click(closeButton());

        expect(
          screen.queryByRole("button", { name: "Save Release" }),
        ).not.toBeInTheDocument();
        confirmSpy.mockRestore();
      });

      it("closes without asking when nothing has been entered", async () => {
        const confirmSpy = vi.spyOn(window, "confirm");
        const { user } = renderWithProviders(<AddReleasePanel />);

        await openPanel(user);
        await user.click(closeButton());

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(
          screen.queryByRole("button", { name: "Save Release" }),
        ).not.toBeInTheDocument();
        confirmSpy.mockRestore();
      });
    });
  });
});
