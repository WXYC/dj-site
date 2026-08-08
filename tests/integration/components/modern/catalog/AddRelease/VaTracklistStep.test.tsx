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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;

const ROCK_GENRE_ID = 7;
const CD_FORMAT_ID = 2;
const NEW_LIBRARY_ID = 4242;

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

function mockLookups() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([{ id: ROCK_GENRE_ID, genre_name: "Rock" }]),
    ),
    http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
      HttpResponse.json([{ id: CD_FORMAT_ID, format_name: "CD" }]),
    ),
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, () =>
      HttpResponse.json({ artists: [] }),
    ),
    http.get(`${TEST_BACKEND_URL}/labels/search`, () => HttpResponse.json([])),
    http.post(`${TEST_BACKEND_URL}/library/`, () =>
      HttpResponse.json({ id: NEW_LIBRARY_ID }),
    ),
  );
}

function mockSuggestions(respond: () => Response) {
  let calls = 0;
  server.use(
    http.get(
      `${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks/discogs-suggestions`,
      () => {
        calls += 1;
        return respond();
      },
    ),
  );
  return () => calls;
}

function mockTrackWrite(
  respond: () => Response = () =>
    HttpResponse.json({
      library_id: NEW_LIBRARY_ID,
      inserted: 2,
      skipped: 0,
      tracks: [],
    }),
) {
  let receivedBody: unknown;
  server.use(
    http.post(
      `${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`,
      async ({ request }) => {
        receivedBody = await request.json();
        return respond();
      },
    ),
  );
  return () => receivedBody;
}

const suggestionsPayload = (
  tracks: { artist_name: string; track_title: string | null; track_position: string | null }[],
  discogsReleaseId: number | null = 55501,
) =>
  HttpResponse.json({
    library_id: NEW_LIBRARY_ID,
    discogs_release_id: discogsReleaseId,
    tracks,
  });

type User = ReturnType<typeof renderWithProviders>["user"];

/** Fills and submits the release form, leaving the panel wherever submit takes it. */
async function submitRelease(user: User, artistName: string) {
  await user.click(await screen.findByRole("button", { name: "Add Release" }));
  await user.type(screen.getByLabelText(/Album title/), "Even Cowgirls Get The Blues");
  await user.click(await screen.findByRole("combobox", { name: "Genre" }));
  await user.click(await screen.findByRole("option", { name: "Rock" }));
  await user.click(await screen.findByRole("combobox", { name: "Format" }));
  await user.click(await screen.findByRole("option", { name: "CD" }));
  await user.type(await screen.findByPlaceholderText("Search artists..."), artistName);
  await user.type(await screen.findByPlaceholderText("Search labels..."), "Sonamos");
  await user.click(screen.getByRole("button", { name: "Save Release" }));
}

describe("V/A tracklist-confirm step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookups();
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(sessionWithRole());
  });

  it("presents the imported tracklist for confirmation and persists the librarian's edit", async () => {
    mockSuggestions(() =>
      suggestionsPayload([
        { artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
        { artist_name: "Nilufer Yanya", track_title: "Stabilise", track_position: "A2" },
      ]),
    );
    const getWriteBody = mockTrackWrite();
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "Various Artists");

    const secondArtist = await screen.findByLabelText("Artist for track 2");
    expect(await screen.findByLabelText("Artist for track 1")).toHaveValue("Jessica Pratt");
    expect(secondArtist).toHaveValue("Nilufer Yanya");

    // The imported spelling is exactly what a librarian is here to correct —
    // Discogs is the seed, not the authority.
    await user.clear(secondArtist);
    await user.type(secondArtist, "Nilüfer Yanya");

    await user.click(screen.getByRole("button", { name: "Save Tracks" }));

    await waitFor(() =>
      expect(getWriteBody()).toEqual({
        tracks: [
          { artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
          { artist_name: "Nilüfer Yanya", track_title: "Stabilise", track_position: "A2" },
        ],
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save Tracks" })).not.toBeInTheDocument(),
    );
  });

  it("falls back to manual entry when no Discogs release matches", async () => {
    mockSuggestions(() => suggestionsPayload([], null));
    const getWriteBody = mockTrackWrite(() =>
      HttpResponse.json({ library_id: NEW_LIBRARY_ID, inserted: 1, skipped: 0, tracks: [] }),
    );
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "V/A");

    expect(await screen.findByText(/No Discogs tracklist matched/)).toBeInTheDocument();

    await user.type(await screen.findByLabelText("Artist for track 1"), "Chuquimamani-Condori");
    await user.type(screen.getByLabelText("Title for track 1"), "Call Your Name");
    await user.click(screen.getByRole("button", { name: "Save Tracks" }));

    // A blank position is stored as NULL rather than as an empty string, which
    // would otherwise read as a real sleeve position of zero characters.
    await waitFor(() =>
      expect(getWriteBody()).toEqual({
        tracks: [
          {
            artist_name: "Chuquimamani-Condori",
            track_title: "Call Your Name",
            track_position: null,
          },
        ],
      }),
    );
  });

  it("lets the librarian add and remove rows before saving", async () => {
    mockSuggestions(() =>
      suggestionsPayload([
        { artist_name: "Stereolab", track_title: "Peng!", track_position: "A1" },
      ]),
    );
    const getWriteBody = mockTrackWrite();
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "Various");

    await user.click(await screen.findByRole("button", { name: "Add track" }));
    await user.type(await screen.findByLabelText("Artist for track 2"), "Cat Power");
    await user.click(screen.getByRole("button", { name: "Remove track 1" }));

    await user.click(screen.getByRole("button", { name: "Save Tracks" }));

    await waitFor(() =>
      expect(getWriteBody()).toEqual({
        tracks: [
          { artist_name: "Cat Power", track_title: null, track_position: null },
        ],
      }),
    );
  });

  // The whole reason this endpoint opts out of the shared non-JSON soft-fail:
  // soft-failed, an outage would arrive as `discogs_release_id: null` with no
  // tracks, and the panel would tell the librarian Discogs had no match — a
  // claim it has no basis for, whose cost is a hand-typed tracklist.
  it("does not let an unreachable backend pass itself off as 'no Discogs match'", async () => {
    const suggestionCalls = mockSuggestions(
      () =>
        new HttpResponse("<!DOCTYPE html><html><body>502</body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    );
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "Various Artists");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't be fetched.*isn't the same as Discogs having no match/s,
    );
    expect(screen.queryByText(/No Discogs tracklist matched/)).not.toBeInTheDocument();
    // No rows are offered until the librarian chooses manual entry: the empty
    // row is what makes "type them yourself" look like the expected outcome.
    expect(screen.queryByLabelText("Artist for track 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(suggestionCalls()).toBe(2));
  });

  it("offers manual entry from the error state as an explicit choice", async () => {
    mockSuggestions(
      () =>
        new HttpResponse("<!DOCTYPE html><html><body>502</body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    );
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "Various Artists");
    await user.click(await screen.findByRole("button", { name: "Enter tracks manually" }));

    expect(await screen.findByLabelText("Artist for track 1")).toHaveValue("");
  });

  // The strict whole-name predicate, not the lenient substring one: a band
  // whose name merely contains a keyword is not a compilation, and sending its
  // release through a per-track capture step would be nonsense.
  it.each([
    ["Various Artists", true],
    ["V/A", true],
    ["Original Motion Picture Soundtrack", true],
    ["Jessica Pratt", false],
    ["Various Production", false],
    ["Soundtrack Of Our Lives", false],
  ])("routes %s to the tracklist step: %s", async (artistName, expectsStep) => {
    mockSuggestions(() => suggestionsPayload([]));
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, artistName);

    if (expectsStep) {
      expect(await screen.findByText("Per-Track Artists")).toBeInTheDocument();
    } else {
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Save Release" })).not.toBeInTheDocument(),
      );
      expect(screen.queryByText("Per-Track Artists")).not.toBeInTheDocument();
    }
  });

  describe("dismissing the step", () => {
    const closeButton = () => screen.getByTestId("CloseIcon");

    // The release is already in the catalog by this point, so the form's own
    // "nothing has been saved yet" would be false — and what is at stake is
    // different in kind.
    it("warns that the release is already saved and only its tracks are at risk", async () => {
      mockSuggestions(() => suggestionsPayload([]));
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await screen.findByText("Per-Track Artists");

      await user.click(closeButton());

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("is already saved"),
      );
      expect(confirmSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Nothing has been saved yet"),
      );
      expect(screen.getByText("Per-Track Artists")).toBeInTheDocument();
      confirmSpy.mockRestore();
    });

    it("closes when the warning is accepted", async () => {
      mockSuggestions(() => suggestionsPayload([]));
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await screen.findByText("Per-Track Artists");

      await user.click(closeButton());

      await waitFor(() =>
        expect(screen.queryByText("Per-Track Artists")).not.toBeInTheDocument(),
      );
      confirmSpy.mockRestore();
    });

    it("treats an all-blank tracklist as a skip rather than posting an empty write", async () => {
      mockSuggestions(() => suggestionsPayload([]));
      let writeCalls = 0;
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () => {
          writeCalls += 1;
          return HttpResponse.json({
            library_id: NEW_LIBRARY_ID,
            inserted: 0,
            skipped: 0,
            tracks: [],
          });
        }),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await screen.findByLabelText("Artist for track 1");

      await user.click(screen.getByRole("button", { name: "Save Tracks" }));

      await waitFor(() =>
        expect(screen.queryByText("Per-Track Artists")).not.toBeInTheDocument(),
      );
      expect(writeCalls).toBe(0);
    });

    // The rows are the only copy of anything hand-entered; closing on a failed
    // write would destroy them with nothing to re-derive them from.
    it("keeps the rows standing when the write fails", async () => {
      mockSuggestions(() => suggestionsPayload([]));
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({ message: "boom" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await user.type(await screen.findByLabelText("Artist for track 1"), "Duke Ellington");
      await user.click(screen.getByRole("button", { name: "Save Tracks" }));

      await waitFor(() =>
        expect(screen.getByLabelText("Artist for track 1")).toHaveValue("Duke Ellington"),
      );
      expect(screen.getByText("Per-Track Artists")).toBeInTheDocument();
    });
  });
});
