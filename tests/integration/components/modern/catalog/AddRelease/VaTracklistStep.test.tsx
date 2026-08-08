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

  // The heading describes the rows below it, so it is fixed at the moment they
  // are seeded rather than read live from the query. Read live, it would start
  // describing a response whose tracks were never adopted — announcing an
  // import above rows that came from somewhere else.
  it("keeps the heading describing the rows actually on screen across a retry", async () => {
    let releaseRetry: () => void = () => {};
    const retryInFlight = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    let suggestionCalls = 0;
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks/discogs-suggestions`,
        async () => {
          suggestionCalls += 1;
          if (suggestionCalls === 1) {
            return new HttpResponse("<!DOCTYPE html><html><body>502</body></html>", {
              status: 502,
              headers: { "Content-Type": "text/html" },
            });
          }
          // Held so the in-flight window is observable rather than raced past.
          await retryInFlight;
          return suggestionsPayload([
            { artist_name: "Stereolab", track_title: "Peng!", track_position: "A1" },
            { artist_name: "Cat Power", track_title: "Nude As The News", track_position: "A2" },
          ]);
        },
      ),
    );
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "Various Artists");
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    // Mid-retry the panel commits to neither reading. Withholding the manual
    // -entry affordance here is what makes a late response unable to contradict
    // a choice the librarian has already made.
    await screen.findByText("Checking Discogs for a tracklist…");
    expect(screen.queryByText(/No Discogs tracklist matched/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Imported/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enter tracks manually" }),
    ).not.toBeInTheDocument();

    releaseRetry();

    // Once it lands, the heading and the rows agree — two imported tracks, two rows.
    expect(await screen.findByText(/Imported 2 tracks from Discogs/)).toBeInTheDocument();
    expect(screen.getByLabelText("Artist for track 1")).toHaveValue("Stereolab");
    expect(screen.getByLabelText("Artist for track 2")).toHaveValue("Cat Power");
    expect(screen.queryByLabelText("Artist for track 3")).not.toBeInTheDocument();
  });

  // A response adopted once is never re-adopted: a later arrival for the same
  // release must not relabel or replace rows the librarian has since edited.
  it("does not re-seed rows the librarian has already edited", async () => {
    mockSuggestions(() =>
      suggestionsPayload([
        { artist_name: "Stereolab", track_title: "Peng!", track_position: "A1" },
      ]),
    );
    const getWriteBody = mockTrackWrite();
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "Various Artists");

    const artist = await screen.findByLabelText("Artist for track 1");
    await user.clear(artist);
    await user.type(artist, "Jessica Pratt");
    await user.click(screen.getByRole("button", { name: "Save Tracks" }));

    await waitFor(() =>
      expect(getWriteBody()).toEqual({
        tracks: [{ artist_name: "Jessica Pratt", track_title: "Peng!", track_position: "A1" }],
      }),
    );
  });

  it("reports the retry as busy so it does not read as having done nothing", async () => {
    let releaseRetry: () => void = () => {};
    const retryInFlight = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    let calls = 0;
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks/discogs-suggestions`,
        async () => {
          calls += 1;
          // The second response is held open deliberately: the busy state only
          // exists while the request is in flight, so a handler that answers
          // immediately leaves nothing to observe.
          if (calls > 1) await retryInFlight;
          return new HttpResponse("<!DOCTYPE html><html><body>502</body></html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          });
        },
      ),
    );
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "Various Artists");
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Try again" }));

    // A refetch moves the query to pending, so `isError` goes false while
    // nothing has been adopted yet. Branching on the query flags rather than on
    // whether rows exist drops through to the tracklist view, whose heading
    // announces "No Discogs tracklist matched" — a claim an in-flight request
    // has no standing to make, and precisely the false negative the endpoint's
    // soft-fail opt-out exists to prevent.
    expect(await screen.findByText("Checking Discogs for a tracklist…")).toBeInTheDocument();
    expect(screen.queryByText(/No Discogs tracklist matched/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enter tracks manually" }),
    ).not.toBeInTheDocument();
    releaseRetry();
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

  // These credits have no other entry point in the product, so degrading to
  // "never offered" has to be audible — a silent close reads as though this
  // compilation needed none.
  it("says so when a created V/A release comes back without an id to address", async () => {
    mockSuggestions(() => suggestionsPayload([]));
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/`, () => HttpResponse.json({ ok: true })),
    );
    const { user } = renderWithProviders(<AddReleasePanel />);

    await submitRelease(user, "Various Artists");

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("per-track artists couldn't be requested"),
      ),
    );
    expect(screen.queryByText("Per-Track Artists")).not.toBeInTheDocument();
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

    it("refuses to save an all-blank tracklist rather than closing as if it had", async () => {
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

      // Closing on an empty save would be indistinguishable from a real one —
      // and "Skip for now", which means exactly this, asks for confirmation
      // first. The affordance that files nothing must not be the quieter one.
      expect(screen.getByRole("button", { name: "Save Tracks" })).toBeDisabled();
      expect(screen.getByText("Per-Track Artists")).toBeInTheDocument();
      expect(writeCalls).toBe(0);
    });

    // A request can commit and still fail to deliver its response. Since
    // `artist_name` is part of the server's uniqueness key, a correction
    // re-submitted after that is filed *beside* the row it was meant to
    // replace — both permanent, with no edit path in the product. So a retry
    // reads what actually landed and locks it rather than trusting the write
    // to de-duplicate.
    it("locks credits an earlier attempt already filed instead of re-filing corrected copies", async () => {
      mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Nilufer Yanya", track_title: "Stabilise", track_position: "A1" },
        ]),
      );
      const postedBodies: unknown[] = [];
      let postCalls = 0;
      let committed = false;
      server.use(
        // Commits, then fails to answer — the case the reconciliation exists for.
        http.post(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, async ({ request }) => {
          postedBodies.push(await request.json());
          postCalls += 1;
          committed = true;
          return postCalls === 1
            ? HttpResponse.json({ message: "gateway timeout" }, { status: 504 })
            : HttpResponse.json({
                library_id: NEW_LIBRARY_ID,
                inserted: 1,
                skipped: 0,
                tracks: [],
              });
        }),
        // Reflects commit ordering rather than answering the same way forever:
        // a read issued before the write committed must come back empty. Left
        // unconditional, the lock could come from the read the step fires on
        // mount and the test would pass with the invalidation deleted.
        http.get(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({
            library_id: NEW_LIBRARY_ID,
            tracks: committed
              ? [
                  {
                    id: 71,
                    artist_name: "Nilufer Yanya",
                    track_title: "Stabilise",
                    track_position: "A1",
                  },
                ]
              : [],
          }),
        ),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await user.click(await screen.findByRole("button", { name: "Save Tracks" }));

      // The row the server kept is now beyond this panel's reach, and says so.
      // Waited on the banner rather than on the input being disabled: every
      // input is disabled for the duration of the write too, so that alone
      // would pass before the reconciliation had happened.
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          /already filed by an earlier attempt/,
        ),
      );
      expect(screen.getByLabelText(/^Artist for track 1/)).toBeDisabled();
      // With every row locked there is nothing left to submit, so the correction
      // the librarian would otherwise attempt is refused at the button.
      expect(screen.getByRole("button", { name: "Save Tracks" })).toBeDisabled();

      // A genuinely new credit still saves, and carries only itself.
      await user.click(screen.getByRole("button", { name: "Add track" }));
      await user.type(await screen.findByLabelText("Artist for track 2"), "Jessica Pratt");
      await user.click(screen.getByRole("button", { name: "Save Tracks" }));

      await waitFor(() => expect(postedBodies).toHaveLength(2));
      expect(postedBodies[1]).toEqual({
        tracks: [{ artist_name: "Jessica Pratt", track_title: null, track_position: null }],
      });
    });

    // The backend that just failed a write is the same one being asked what it
    // kept. When that read fails too, the panel knows nothing about what is
    // stored — and guessing is exactly how a corrected duplicate gets filed.
    it("refuses to save again when it cannot confirm what the failed attempt stored", async () => {
      mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Nilufer Yanya", track_title: "Stabilise", track_position: "A1" },
        ]),
      );
      let postCalls = 0;
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () => {
          postCalls += 1;
          return HttpResponse.json({ message: "gateway timeout" }, { status: 504 });
        }),
        http.get(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({ message: "boom" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await user.click(await screen.findByRole("button", { name: "Save Tracks" }));

      await waitFor(() =>
        expect(screen.getByText(/Couldn't check which credits the last attempt saved/)).toBeInTheDocument(),
      );
      // Nothing locked, because nothing is known — so the write is refused at
      // the button rather than left live over an unknown stored state.
      expect(screen.getByRole("button", { name: "Save Tracks" })).toBeDisabled();

      // The correction a librarian would reach for cannot be filed.
      const artist = screen.getByLabelText(/^Artist for track 1/);
      await user.clear(artist);
      await user.type(artist, "Nilüfer Yanya");
      expect(screen.getByRole("button", { name: "Save Tracks" })).toBeDisabled();
      expect(postCalls).toBe(1);
    });

    // The first reconciliation rides the query's skip-to-unskip transition. A
    // second one has no such trigger — the read is already subscribed — so from
    // the second attempt onward the write's cache invalidation is the only
    // thing that refreshes the account of what is stored.
    it("re-reads what landed after every failed attempt, not just the first", async () => {
      mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Stereolab", track_title: "Peng!", track_position: "A1" },
        ]),
      );
      const landed: { id: number; artist_name: string; track_title: string | null; track_position: string | null }[] = [];
      server.use(
        // Every attempt commits and then fails to answer.
        http.post(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, async ({ request }) => {
          const body = (await request.json()) as { tracks: { artist_name: string; track_title: string | null; track_position: string | null }[] };
          body.tracks.forEach((t, i) =>
            landed.push({ id: 900 + landed.length + i, ...t }),
          );
          return HttpResponse.json({ message: "gateway timeout" }, { status: 504 });
        }),
        http.get(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({ library_id: NEW_LIBRARY_ID, tracks: [...landed] }),
        ),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await user.click(await screen.findByRole("button", { name: "Save Tracks" }));
      await waitFor(() =>
        expect(screen.getByLabelText(/^Artist for track 1/)).toBeDisabled(),
      );

      // Second attempt: a new credit, which also commits and also fails.
      await user.click(screen.getByRole("button", { name: "Add track" }));
      await user.type(await screen.findByLabelText(/^Artist for track 2/), "Cat Power");
      await user.click(screen.getByRole("button", { name: "Save Tracks" }));

      // Without the refetch this row stays editable and a third attempt would
      // file a corrected copy beside it.
      await waitFor(() =>
        expect(screen.getByLabelText(/^Artist for track 2/)).toBeDisabled(),
      );
      expect(screen.getByRole("status")).toHaveTextContent(/2 credits were already filed/);
    });

    // Locking is captured against the rows that existed when the read landed,
    // not recomputed from live input. Recomputed, a row would freeze the moment
    // its half-typed contents happened to match a stored credit — which is
    // ordinary typing when the stored credit has no title.
    it("does not freeze a row being typed that transiently matches a stored credit", async () => {
      mockSuggestions(() => suggestionsPayload([]));
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({ message: "gateway timeout" }, { status: 504 }),
        ),
        http.get(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({
            library_id: NEW_LIBRARY_ID,
            tracks: [{ id: 80, artist_name: "Juana Molina", track_title: null, track_position: null }],
          }),
        ),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await user.type(await screen.findByLabelText(/^Artist for track 1/), "Juana Molina");
      await user.click(screen.getByRole("button", { name: "Save Tracks" }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(/already filed by an earlier attempt/),
      );

      // A fresh row for that artist's second track: the artist is typed before
      // the title, so mid-entry its identity equals the stored title-less credit.
      await user.click(screen.getByRole("button", { name: "Add track" }));
      const newArtist = await screen.findByLabelText(/^Artist for track 2/);
      await user.type(newArtist, "Juana Molina");

      expect(newArtist).toBeEnabled();
      await user.type(screen.getByLabelText("Title for track 2"), "la paradoja");
      expect(screen.getByLabelText("Title for track 2")).toHaveValue("la paradoja");
    });

    // Locking withholds the ability to file a competing correction, not the
    // ability to clear a row off the screen. A row that could neither be edited
    // nor removed would have no exit but discarding the whole tracklist.
    it("still allows a locked row to be removed", async () => {
      mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Stereolab", track_title: "Peng!", track_position: "A1" },
        ]),
      );
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({ message: "gateway timeout" }, { status: 504 }),
        ),
        http.get(`${TEST_BACKEND_URL}/library/${NEW_LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({
            library_id: NEW_LIBRARY_ID,
            tracks: [{ id: 81, artist_name: "Stereolab", track_title: "Peng!", track_position: "A1" }],
          }),
        ),
      );
      const { user } = renderWithProviders(<AddReleasePanel />);

      await submitRelease(user, "Various Artists");
      await user.click(await screen.findByRole("button", { name: "Save Tracks" }));

      await waitFor(() =>
        expect(screen.getByLabelText(/^Artist for track 1/)).toBeDisabled(),
      );
      await user.click(screen.getByRole("button", { name: "Remove track 1" }));

      expect(screen.queryByLabelText(/^Artist for track 1/)).not.toBeInTheDocument();
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
