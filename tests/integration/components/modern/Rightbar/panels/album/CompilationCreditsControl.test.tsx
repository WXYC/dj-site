import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  server,
  createTestAlbum,
  createTestArtist,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import CompilationCreditsControl from "@/src/components/experiences/modern/Rightbar/panels/album/CompilationCreditsControl";

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

const LIBRARY_ID = 8123;

function session() {
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

/** A real compilation shelf row: the bucket letter lives in the name, `V/A` in the code. */
function compilationAlbum(
  artistName = "Various Artists - Rock - S",
  overrides: Parameters<typeof createTestAlbum>[0] = {},
) {
  return createTestAlbum({
    id: LIBRARY_ID,
    title: "Even Cowgirls Get The Blues",
    artist: createTestArtist({ name: artistName, lettercode: "V/A", numbercode: 0 }),
    ...overrides,
  });
}

type StoredTrack = {
  id: number;
  artist_name: string;
  track_title: string | null;
  track_position: string | null;
};

function mockStored(tracks: StoredTrack[] | (() => Response)) {
  let calls = 0;
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`, () => {
      calls += 1;
      return typeof tracks === "function"
        ? tracks()
        : HttpResponse.json({ library_id: LIBRARY_ID, tracks });
    }),
  );
  return () => calls;
}

function mockSuggestions(respond: () => Response) {
  let calls = 0;
  server.use(
    http.get(
      `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks/discogs-suggestions`,
      () => {
        calls += 1;
        return respond();
      },
    ),
  );
  return () => calls;
}

const suggestionsPayload = (
  tracks: { artist_name: string; track_title: string | null; track_position: string | null }[],
  discogsReleaseId: number | null = 55501,
) =>
  HttpResponse.json({
    library_id: LIBRARY_ID,
    discogs_release_id: discogsReleaseId,
    tracks,
  });

const outage = () =>
  new HttpResponse("<!DOCTYPE html><html><body>502</body></html>", {
    status: 502,
    headers: { "Content-Type": "text/html" },
  });

describe("CompilationCreditsControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(session());
  });

  describe("which releases it offers itself to", () => {
    // The shelf holds `Various Artists`, `Various Artists - Rock - <A-Z>` and
    // `Soundtracks - <A-Z>`. The last carries no "various" keyword anywhere, so
    // a name-anchored gate misses it while the structural one does not — and it
    // is a compilation whose per-track credits have no other entry point.
    it.each([
      ["Various Artists", "V/A"],
      ["Various Artists - Rock - S", "V/A"],
      ["Soundtracks - K", "V/A"],
      ["Soundtracks - K", "Z-K"],
    ])("offers credit entry for the %s shelf filed under %s", async (name, lettercode) => {
      mockStored([]);
      const album = compilationAlbum(name, {
        artist: createTestArtist({ name, lettercode, numbercode: 0 }),
      });

      renderWithProviders(<CompilationCreditsControl album={album} />);

      expect(
        await screen.findByRole("button", { name: "Import from Discogs" }),
      ).toBeInTheDocument();
    });

    it("stays out of the way of a release that is not a compilation", async () => {
      const storedCalls = mockStored([]);
      const album = createTestAlbum({
        id: LIBRARY_ID,
        title: "Aluminum Tunes",
        artist: createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87 }),
      });

      renderWithProviders(<CompilationCreditsControl album={album} />);

      await waitFor(() => expect(mockFetchOrgRole).not.toHaveBeenCalled());
      expect(screen.queryByText("Per-track credits")).not.toBeInTheDocument();
      expect(storedCalls()).toBe(0);
    });

    // `synthesizeAlbumId` hands out negative ids to rows the library never
    // linked. Every compilation-track endpoint resolves its path param against
    // `library.id`, so a request built from one of those would address some
    // other, real release.
    it("declines a row that carries no library id to address", async () => {
      const storedCalls = mockStored([]);
      const album = compilationAlbum("Various Artists", { id: -4242 });

      renderWithProviders(<CompilationCreditsControl album={album} />);

      await waitFor(() => expect(mockFetchOrgRole).not.toHaveBeenCalled());
      expect(screen.queryByText("Per-track credits")).not.toBeInTheDocument();
      expect(storedCalls()).toBe(0);
    });

    it("shows a DJ nothing and asks the backend for nothing", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      const storedCalls = mockStored([]);

      renderWithProviders(<CompilationCreditsControl album={compilationAlbum()} />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText("Per-track credits")).not.toBeInTheDocument());
      expect(storedCalls()).toBe(0);
    });
  });

  describe("the credits already on file", () => {
    // Read on arrival, never skipped: this release is of unknown age and the
    // editor's whole safety property is that it knows what a write would be
    // adding to.
    it("lists them without waiting to be asked", async () => {
      mockStored([
        { id: 1, artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
        { id: 2, artist_name: "Juana Molina", track_title: "la paradoja", track_position: "A2" },
      ]);

      renderWithProviders(<CompilationCreditsControl album={compilationAlbum()} />);

      expect(await screen.findByText("Jessica Pratt")).toBeInTheDocument();
      expect(screen.getByText("Juana Molina")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add more credits" })).toBeInTheDocument();
    });

    // An unreadable backend reported as an empty tracklist is what sends a
    // librarian to re-file credits that are already there — through an endpoint
    // that cannot remove the duplicates.
    it("does not report an unreadable backend as an empty tracklist", async () => {
      mockStored(() => HttpResponse.json({ message: "boom" }, { status: 500 }));

      renderWithProviders(<CompilationCreditsControl album={compilationAlbum()} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Couldn't load the credits already on file/,
      );
      expect(screen.queryByText("No per-track credits on file yet.")).not.toBeInTheDocument();
    });

    it("says so plainly when there are none", async () => {
      mockStored([]);

      renderWithProviders(<CompilationCreditsControl album={compilationAlbum()} />);

      expect(await screen.findByText("No per-track credits on file yet.")).toBeInTheDocument();
    });
  });

  describe("entering credits", () => {
    // The suggestions read is upstream Discogs work, not a cache hit, so it is
    // held behind the click rather than fired for every compilation an MD
    // happens to open in the panel.
    it("asks Discogs only once the editor is opened, then fills the form from it", async () => {
      mockStored([]);
      const suggestionCalls = mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
          { artist_name: "Nilufer Yanya", track_title: "Stabilise", track_position: "A2" },
        ]),
      );
      const { user } = renderWithProviders(
        <CompilationCreditsControl album={compilationAlbum()} />,
      );

      await screen.findByText("No per-track credits on file yet.");
      expect(suggestionCalls()).toBe(0);

      await user.click(screen.getByRole("button", { name: "Import from Discogs" }));

      expect(await screen.findByLabelText("Artist for track 1")).toHaveValue("Jessica Pratt");
      expect(screen.getByLabelText("Artist for track 2")).toHaveValue("Nilufer Yanya");
      expect(screen.getByText(/Imported 2 tracks from Discogs/)).toBeInTheDocument();
    });

    // The write is additive-only: a corrected spelling of a credit already on
    // file is stored *beside* it, not in place of it. So a stored credit is
    // never offered back as an editable row.
    it("withholds the credits already on file rather than offering them for correction", async () => {
      mockStored([
        { id: 1, artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
      ]);
      mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
          { artist_name: "Chuquimamani-Condori", track_title: "Call Your Name", track_position: "A2" },
        ]),
      );
      const { user } = renderWithProviders(
        <CompilationCreditsControl album={compilationAlbum()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Add more credits" }));

      const first = await screen.findByLabelText("Artist for track 1");
      expect(first).toHaveValue("Chuquimamani-Condori");
      expect(screen.queryByLabelText("Artist for track 2")).not.toBeInTheDocument();
      expect(
        screen.getByText(/Imported 1 new track from Discogs.*1 was already on file/),
      ).toBeInTheDocument();
    });

    // Discogs matching a release whose every track is already filed is not
    // Discogs having no match, and reporting it as one would send the librarian
    // to type a tracklist that is already there.
    it("distinguishes 'Discogs matched nothing new' from 'Discogs matched nothing'", async () => {
      mockStored([
        { id: 1, artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
      ]);
      mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
        ]),
      );
      const { user } = renderWithProviders(
        <CompilationCreditsControl album={compilationAlbum()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Add more credits" }));

      expect(
        await screen.findByText(/every track it lists is already on file/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/No Discogs tracklist matched/)).not.toBeInTheDocument();
    });

    it("routes to hand entry when Discogs genuinely has no match", async () => {
      mockStored([]);
      mockSuggestions(() => suggestionsPayload([], null));
      const { user } = renderWithProviders(
        <CompilationCreditsControl album={compilationAlbum()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Import from Discogs" }));

      expect(await screen.findByText(/No Discogs tracklist matched/)).toBeInTheDocument();
      expect(await screen.findByLabelText("Artist for track 1")).toHaveValue("");
    });

    // The one confusion that costs a librarian a hand-typed tracklist for a
    // release Discogs would have supplied a minute later.
    it("never lets an unreachable Discogs pass itself off as 'no match'", async () => {
      mockStored([]);
      const suggestionCalls = mockSuggestions(outage);
      const { user } = renderWithProviders(
        <CompilationCreditsControl album={compilationAlbum()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Import from Discogs" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /couldn't be fetched.*isn't the same as Discogs having no match/s,
      );
      expect(screen.queryByText(/No Discogs tracklist matched/)).not.toBeInTheDocument();
      // No rows until hand entry is chosen: an empty row is what makes "type
      // them yourself" look like the expected outcome.
      expect(screen.queryByLabelText("Artist for track 1")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(suggestionCalls()).toBe(2));
    });

    // The stored read decides which suggestions are already filed, so its
    // failure blocks filling the form for the same reason it blocks saving.
    it("refuses to fill the form while it cannot say what is already on file", async () => {
      mockStored(() => HttpResponse.json({ message: "boom" }, { status: 500 }));
      const suggestionCalls = mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Jessica Pratt", track_title: "Back, Baby", track_position: "A1" },
        ]),
      );
      const { user } = renderWithProviders(
        <CompilationCreditsControl album={compilationAlbum()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Import from Discogs" }));

      await waitFor(() =>
        expect(
          screen.getByText(/offering a credit that is already on file would file it twice/),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByLabelText("Artist for track 1")).not.toBeInTheDocument();
      // Discogs answered; the refusal is about the other read, not this one.
      expect(suggestionCalls()).toBe(1);
    });
  });

  describe("saving", () => {
    it("files the confirmed credits and shows them back on the release", async () => {
      let filed: StoredTrack[] = [];
      let writeBody: unknown;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({ library_id: LIBRARY_ID, tracks: [...filed] }),
        ),
        http.post(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`,
          async ({ request }) => {
            writeBody = await request.json();
            filed = [
              { id: 9, artist_name: "Nilüfer Yanya", track_title: "Stabilise", track_position: "A1" },
            ];
            return HttpResponse.json({
              library_id: LIBRARY_ID,
              inserted: 1,
              skipped: 0,
              tracks: [],
            });
          },
        ),
      );
      mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Nilufer Yanya", track_title: "Stabilise", track_position: "A1" },
        ]),
      );
      const { user } = renderWithProviders(
        <CompilationCreditsControl album={compilationAlbum()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Import from Discogs" }));

      // Discogs is the seed, not the authority — the imported spelling is
      // exactly what the librarian is here to correct.
      const artist = await screen.findByLabelText("Artist for track 1");
      await user.clear(artist);
      await user.type(artist, "Nilüfer Yanya");
      await user.click(screen.getByRole("button", { name: "Save Tracks" }));

      await waitFor(() =>
        expect(writeBody).toEqual({
          tracks: [
            { artist_name: "Nilüfer Yanya", track_title: "Stabilise", track_position: "A1" },
          ],
        }),
      );

      const { toast } = await import("sonner");
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining("Added 1 per-track artist"),
        ),
      );
      // The listing reflects the write rather than the state it was rendered
      // from — the read is invalidated, not merely subscribed once.
      expect(await screen.findByText("Nilüfer Yanya")).toBeInTheDocument();
    });

    // A request can commit and then fail to deliver its response. Since
    // `artist_name` is part of the server's uniqueness key, a correction
    // resubmitted after that is filed beside the row it was meant to replace.
    it("keeps the entered rows and stops saving again after a failed write", async () => {
      let committed = false;
      let postCalls = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`, () =>
          HttpResponse.json({
            library_id: LIBRARY_ID,
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
        http.post(`${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`, () => {
          postCalls += 1;
          committed = true;
          return HttpResponse.json({ message: "gateway timeout" }, { status: 504 });
        }),
      );
      mockSuggestions(() =>
        suggestionsPayload([
          { artist_name: "Nilufer Yanya", track_title: "Stabilise", track_position: "A1" },
        ]),
      );
      const { user } = renderWithProviders(
        <CompilationCreditsControl album={compilationAlbum()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Import from Discogs" }));
      await user.click(await screen.findByRole("button", { name: "Save Tracks" }));

      // The row the server kept is beyond this panel's reach, and says so.
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          /already filed by an earlier attempt/,
        ),
      );
      expect(screen.getByLabelText(/^Artist for track 1/)).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save Tracks" })).toBeDisabled();
      expect(postCalls).toBe(1);
    });
  });
});
