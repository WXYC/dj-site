import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
} from "@/tests/helpers";
import { fakeRotationCardsEndpoints } from "@/tests/fakes/rotation";
import {
  fakeDiscogsPrefillEndpoint,
  MOLINA_DISCOGS_PREFILL,
} from "@/tests/fakes/discogsPrefill";
import {
  fakeLibraryFilingsEndpoint,
  filingConflictResponse,
  type FakeFilingArtistRow,
} from "@/tests/fakes/libraryFilings";

// Mock fonts before importing the modern theme (pulled in for the rotation palette).
vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

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

import { CssVarsProvider } from "@mui/joy/styles";
import modernTheme from "@/lib/features/experiences/modern/theme";
import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import RotationFilingBench from "@/src/components/experiences/modern/admin/rotation/RotationFilingBench";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;

const GENRE_ID = TEST_ENTITY_IDS.GENRE.ROCK;
const BY_CODE_URL = `${TEST_BACKEND_URL}/library/artists/by-code`;
const VA_CHECKBOX = "Various Artists compilation";

const PLAIN_BUCKET = {
  id: 8100,
  artist_name: "Various Artists",
  code_letters: "V/A",
  code_number: 0,
  genre_id: GENRE_ID,
};

const ROCK_BUCKETS = [
  { ...PLAIN_BUCKET, id: 8110, artist_name: "Various Artists - Rock - H" },
  { ...PLAIN_BUCKET, id: 8111, artist_name: "Various Artists - Rock - S" },
];

/** The same bucket in the filing endpoint's artist shape, for a refusal body. */
const PLAIN_BUCKET_ROW: FakeFilingArtistRow = {
  id: PLAIN_BUCKET.id,
  artist_name: PLAIN_BUCKET.artist_name,
  code_letters: PLAIN_BUCKET.code_letters,
  code_artist_number: 0,
  genre_id: GENRE_ID,
};

const CARDS = [
  { id: 31, bin: "H", number: 1, name: "Late Aug" },
  { id: 32, bin: "H", number: 2, name: null },
];

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

function mockCatalogLists() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([
        { id: GENRE_ID, genre_name: "Rock" },
        { id: TEST_ENTITY_IDS.GENRE.JAZZ, genre_name: "Jazz" },
      ]),
    ),
    http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
      HttpResponse.json([{ id: 1, format_name: "CD" }]),
    ),
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, () =>
      HttpResponse.json({ artists: [] }),
    ),
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () =>
      HttpResponse.json({ next_code_number: 7 }),
    ),
  );
}

type ShelfAnswer =
  | { owners: typeof ROCK_BUCKETS }
  | { status: 404; reason: "code_not_assigned" | "genre_not_found" }
  | { status: 500 };

/** The genre's shelf answers with these owners, or the named refusal. */
function mockShelf(answer: ShelfAnswer) {
  server.use(
    http.get(BY_CODE_URL, () => {
      if ("owners" in answer) return HttpResponse.json({ artists: answer.owners });
      if (answer.status === 500) return new HttpResponse(null, { status: 500 });
      return HttpResponse.json({ reason: answer.reason }, { status: 404 });
    }),
  );
}

function renderBench() {
  return renderWithProviders(
    <CssVarsProvider theme={modernTheme}>
      <RotationFilingBench />
    </CssVarsProvider>,
  );
}

type User = ReturnType<typeof renderWithProviders>["user"];

async function selectGenre(user: User, name = "Rock") {
  await user.click(await screen.findByRole("combobox", { name: "Genre" }));
  await user.click(await screen.findByRole("option", { name }));
}

async function fillRelease(user: User, { title = "Habibi Funk 007", label = "Habibi Funk" } = {}) {
  await user.type(screen.getByLabelText("Album title"), title);
  await user.type(screen.getByLabelText("Label"), label);
  await user.click(screen.getByRole("combobox", { name: "Format" }));
  await user.click(await screen.findByRole("option", { name: "CD" }));
}

async function awaitDefaultCard() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
}

function shelfPanel() {
  return screen.getByRole("region", { name: "Various Artists shelf" });
}

function ledger() {
  return screen.getByRole("region", { name: "Filed this session" });
}

describe("RotationFilingBench — Various Artists compilations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(sessionWithRole());
    mockCatalogLists();
    fakeRotationCardsEndpoints(CARDS);
  });

  describe("entering and leaving compilation state", () => {
    it("takes a genre before it can be checked, since the shelf is resolved per genre", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const { user } = renderBench();

      expect(await screen.findByLabelText(VA_CHECKBOX)).toBeDisabled();
      // The typeahead still stands in for the artist arm, so the section is
      // never left with neither control on screen.
      expect(screen.getByPlaceholderText("Search artists...")).toBeInTheDocument();

      await selectGenre(user);
      expect(screen.getByLabelText(VA_CHECKBOX)).toBeEnabled();
    });

    it("replaces the typeahead with the shelf, and restores the typed name on uncheck", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const { user } = renderBench();

      await selectGenre(user);
      await user.type(screen.getByPlaceholderText("Search artists..."), "Habibi Funk");

      await user.click(screen.getByLabelText(VA_CHECKBOX));

      expect(screen.queryByPlaceholderText("Search artists...")).not.toBeInTheDocument();
      expect(await screen.findByText(/Filing under Various Artists/)).toBeInTheDocument();
      expect(
        screen.getByText(/per-track credits are optional and can be added later/),
      ).toBeInTheDocument();
      // The superseded steer is gone, not reworded.
      expect(screen.queryByText(/Compilations stay out of the bench/)).not.toBeInTheDocument();

      await user.click(screen.getByLabelText(VA_CHECKBOX));
      expect(screen.getByPlaceholderText("Search artists...")).toHaveValue("Habibi Funk");
      expect(screen.queryByRole("region", { name: "Various Artists shelf" })).not.toBeInTheDocument();
    });

    it("does not block on an over-length name the compilation arm never sends", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const { user } = renderBench();

      await selectGenre(user);
      // Pasted, not typed: 129 keystrokes through the typeahead's search is
      // minutes of test time and proves nothing this test is about.
      await user.click(screen.getByPlaceholderText("Search artists..."));
      await user.paste("x".repeat(129));
      expect(screen.getByText(/At most 128 characters/)).toBeInTheDocument();

      await user.click(screen.getByLabelText(VA_CHECKBOX));

      // The retained text is no part of the filing, so it neither blocks the
      // submit nor pre-empts the compilation copy.
      expect(screen.queryByText(/At most 128 characters/)).not.toBeInTheDocument();
      await fillRelease(user);
      await awaitDefaultCard();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add to rotation" })).toBeEnabled(),
      );
    });

    it("never shows the dedup warnings or searches for the retained name while checked", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const searches: string[] = [];
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/search`, ({ request }) => {
          searches.push(new URL(request.url).searchParams.get("q") ?? "");
          return HttpResponse.json({ artists: [] });
        }),
      );
      const { user } = renderBench();

      await selectGenre(user);
      await user.type(screen.getByPlaceholderText("Search artists..."), "Habibi");
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      searches.length = 0;

      await delay(400);
      expect(searches).toEqual([]);
      expect(screen.queryByText(/already exists in this genre/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Re-check this name under the new genre/)).not.toBeInTheDocument();
    });

    it("drops a shelf pick on the way out, so the box does not come back armed", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      // A title the rule names no shelf for: whatever is selected below is the
      // librarian's pick and nothing else.
      await fillRelease(user, { title: "Zebra Records Sampler" });
      await awaitDefaultCard();
      const pickPanel = await screen.findByRole("region", { name: "Various Artists shelf" });
      await user.click(await within(pickPanel).findByLabelText("Various Artists - Rock - S"));

      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await user.click(screen.getByLabelText(VA_CHECKBOX));

      // The pick is keyed on genre, which never changed — so without clearing
      // it would still be standing here, arming the next record's filing onto
      // the previous record's shelf with no gesture.
      const panel = await screen.findByRole("region", { name: "Various Artists shelf" });
      expect(within(panel).getByLabelText("Various Artists - Rock - S")).not.toBeChecked();
      expect(within(panel).getByLabelText("Various Artists - Rock - H")).not.toBeChecked();
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();
    });

    it("gives back the half-filled create panel when the box is unchecked again", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const { user } = renderBench();

      await selectGenre(user);
      await user.type(screen.getByPlaceholderText("Search artists..."), "Habibi Funk");
      await user.click(await screen.findByRole("option", { name: /Create new artist/ }));
      await user.clear(await screen.findByLabelText("Call letters"));
      await user.type(screen.getByLabelText("Call letters"), "HABI");

      await user.click(screen.getByLabelText(VA_CHECKBOX));
      expect(screen.queryByLabelText("Call letters")).not.toBeInTheDocument();

      await user.click(screen.getByLabelText(VA_CHECKBOX));

      // Checking the box hides the panel; it must not throw away what was
      // typed into it, which re-entering by "Create new artist" would reseed.
      expect(screen.getByLabelText("Call letters")).toHaveValue("HABI");
    });

    it("keeps the Artist label and its error off the checkbox", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const { user } = renderBench();

      await selectGenre(user);
      // Exact accessible name: sharing the Artist FormControl would prepend
      // that label here, and hand the checkbox the field's error state too.
      expect(screen.getByRole("checkbox", { name: VA_CHECKBOX })).toBeInTheDocument();

      await user.click(screen.getByPlaceholderText("Search artists..."));
      await user.paste("x".repeat(129));

      expect(screen.getByText(/At most 128 characters/)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: VA_CHECKBOX })).toBeInTheDocument();
    });
  });

  describe("resolving the shelf", () => {
    it("files under the genre's only bucket with no further gesture", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user);
      await awaitDefaultCard();
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0].artist).toEqual({
        kind: "existing",
        artist_id: PLAIN_BUCKET.id,
      });
      // Sans tracklist: the composite carries no per-track member at all.
      expect(filings.bodies()[0]).not.toHaveProperty("tracks");
    });

    it("asks which shelf when the genre has several, and files the picked one", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      // A title starting with neither H nor S: the rule names no shelf this
      // genre has, so nothing is preselected and the librarian must choose.
      await fillRelease(user, { title: "Zebra Records Sampler" });
      await awaitDefaultCard();

      const panel = await screen.findByRole("region", { name: "Various Artists shelf" });
      expect(await within(panel).findByLabelText("Various Artists - Rock - H")).not.toBeChecked();
      expect(within(panel).getByLabelText("Various Artists - Rock - S")).not.toBeChecked();
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();

      await user.click(await within(panel).findByLabelText("Various Artists - Rock - S"));
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0].artist).toEqual({ kind: "existing", artist_id: 8111 });
    });

    it("suggests the shelf the title alphabetizes onto, and says so", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user, { title: "Hell Comes to Your House, vol. 2" });
      await awaitDefaultCard();

      const panel = await screen.findByRole("region", { name: "Various Artists shelf" });
      await waitFor(() =>
        expect(within(panel).getByLabelText("Various Artists - Rock - H")).toBeChecked(),
      );
      expect(
        within(panel).getByText(/Suggested from the title — change it if this files elsewhere/),
      ).toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));
      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0].artist).toEqual({ kind: "existing", artist_id: 8110 });
    });

    it("keeps an overruled shelf overruled while the title is still being edited", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user, { title: "Hell Comes to Your House" });
      await awaitDefaultCard();

      const panel = await screen.findByRole("region", { name: "Various Artists shelf" });
      await waitFor(() =>
        expect(within(panel).getByLabelText("Various Artists - Rock - H")).toBeChecked(),
      );

      // The librarian knows this one files by subject, not by title.
      await user.click(await within(panel).findByLabelText("Various Artists - Rock - S"));
      await user.type(screen.getByLabelText("Album title"), ", vol. 2");

      expect(within(panel).getByLabelText("Various Artists - Rock - S")).toBeChecked();
      expect(within(panel).queryByText(/Suggested from the title/)).not.toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));
      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0].artist).toEqual({ kind: "existing", artist_id: 8111 });
    });

    it("holds the suggested shelf once the librarian clicks it to confirm", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user, { title: "Hell Comes to Your House" });
      await awaitDefaultCard();

      const panel = await screen.findByRole("region", { name: "Various Artists shelf" });
      await waitFor(() =>
        expect(within(panel).getByLabelText("Various Artists - Rock - H")).toBeChecked(),
      );

      // Clicking the row that is already selected fires no change event, so
      // this gesture has to be read from the click or it records nothing.
      await user.click(await within(panel).findByLabelText("Various Artists - Rock - H"));

      await user.clear(screen.getByLabelText("Album title"));
      await user.type(screen.getByLabelText("Album title"), "Sonic Youth tribute");

      expect(within(panel).getByLabelText("Various Artists - Rock - H")).toBeChecked();
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));
      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0].artist).toEqual({ kind: "existing", artist_id: 8110 });
    });

    it("creates the shelf for a genre that has none, under the canonical code", async () => {
      mockShelf({ status: 404, reason: "code_not_assigned" });
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      expect(await screen.findByText(/First compilation in this genre/)).toBeInTheDocument();
      await fillRelease(user);
      await awaitDefaultCard();
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0].artist).toEqual({
        kind: "create",
        artist_name: "Various Artists",
        code_letters: "V/A",
        code_number: 0,
        genre_id: GENRE_ID,
      });
    });

    it("refuses to file on a genre the catalog does not have, without offering a retry", async () => {
      mockShelf({ status: 404, reason: "genre_not_found" });
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user);
      await awaitDefaultCard();

      // Named, not numbered: the librarian picked it from a list and has no
      // use for its id.
      expect(await within(shelfPanel()).findByRole("alert")).toHaveTextContent(
        /“Rock” is no longer in the catalog/,
      );
      // "Try the lookup again" can never work for a genre that does not exist.
      expect(within(shelfPanel()).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();
    });

    it.each<[string, ShelfAnswer]>([
      ["an outage", { status: 500 }],
      ["a fulfilled but empty shelf", { owners: [] }],
    ])("fails closed on %s rather than creating a duplicate shelf", async (_label, answer) => {
      mockShelf(answer);
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user);
      await awaitDefaultCard();

      expect(await within(shelfPanel()).findByRole("alert")).toHaveTextContent(
        /Couldn't check that library code right now/,
      );
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();
      expect(screen.queryByText(/First compilation in this genre/)).not.toBeInTheDocument();
    });

    it("re-resolves for the new genre, dropping the pick made under the old one", async () => {
      server.use(
        http.get(BY_CODE_URL, ({ request }) => {
          const genreId = Number(new URL(request.url).searchParams.get("genre_id"));
          return genreId === GENRE_ID
            ? HttpResponse.json({ artists: ROCK_BUCKETS })
            : HttpResponse.json({
                artists: [{ ...PLAIN_BUCKET, id: 8200, genre_id: genreId }],
              });
        }),
      );
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      const panel = await screen.findByRole("region", { name: "Various Artists shelf" });
      await user.click(await within(panel).findByLabelText("Various Artists - Rock - S"));

      await selectGenre(user, "Jazz");

      expect(await screen.findByText(/Filing under Various Artists/)).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Various Artists - Rock - S"),
      ).not.toBeInTheDocument();
    });
  });

  describe("batches and refusals", () => {
    it("keeps the mode but not the pick across a same-genre batch", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user);
      await awaitDefaultCard();
      const panel = await screen.findByRole("region", { name: "Various Artists shelf" });
      await user.click(await within(panel).findByLabelText("Various Artists - Rock - S"));
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));

      await waitFor(() =>
        expect(within(ledger()).queryByText("Nothing filed yet.")).not.toBeInTheDocument(),
      );

      // The mode persists like genre/label/format/bin, but the next record
      // chooses its own shelf rather than inheriting the last one's.
      expect(screen.getByLabelText(VA_CHECKBOX)).toBeChecked();
      await waitFor(() =>
        expect(
          within(shelfPanel()).getByLabelText("Various Artists - Rock - S"),
        ).not.toBeChecked(),
      );
    });

    it("re-resolves after creating a shelf, so the batch's next record joins it", async () => {
      let byCodeCalls = 0;
      server.use(
        http.get(BY_CODE_URL, () => {
          byCodeCalls += 1;
          return byCodeCalls === 1
            ? HttpResponse.json({ reason: "code_not_assigned" }, { status: 404 })
            : HttpResponse.json({ artists: [PLAIN_BUCKET] });
        }),
      );
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user);
      await awaitDefaultCard();
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(1));

      // Without the re-resolve the second record of the batch would submit a
      // second create for the shelf the first one just made.
      await waitFor(() => expect(screen.getByText(/Filing under Various Artists/)).toBeInTheDocument());
      await user.type(screen.getByLabelText("Album title"), "Habibi Funk 008");
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(2));
      expect(filings.bodies()[1].artist).toEqual({
        kind: "existing",
        artist_id: PLAIN_BUCKET.id,
      });
    });

    it("names the shelf that already holds the code when a create is refused", async () => {
      mockShelf({ status: 404, reason: "code_not_assigned" });
      fakeLibraryFilingsEndpoint({
        respond: () => filingConflictResponse("artist_code_conflict", PLAIN_BUCKET_ROW),
      });
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user);
      await awaitDefaultCard();
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));

      // The refusal is stated where the artist arm lives, not swallowed by the
      // create panel's banner (which is not mounted in compilation state).
      const alert = await within(shelfPanel()).findByRole("alert");
      expect(alert).toHaveTextContent(/Various Artists/);
      expect(within(ledger()).getByText("Nothing filed yet.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();

      // Looking again finds the shelf and reopens the submit.
      await user.click(within(shelfPanel()).getByRole("button", { name: "Look again" }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Add to rotation" })).toBeEnabled(),
      );
    });

    it("clears a standing artist refusal in both toggle directions", async () => {
      mockShelf({ status: 404, reason: "code_not_assigned" });
      fakeLibraryFilingsEndpoint({
        respond: () => filingConflictResponse("artist_code_conflict", PLAIN_BUCKET_ROW),
      });
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await fillRelease(user);
      await awaitDefaultCard();
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));
      await within(shelfPanel()).findByRole("alert");

      // Unchecking unmounts the panel that owns the banner; leaving the
      // conflict standing would lock the submit with nothing explaining why.
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("what Discogs says about the artist", () => {
    const DISCOGS_LINK = "https://www.discogs.com/release/28759";
    const VA_PREFILL = {
      ...MOLINA_DISCOGS_PREFILL,
      discogs_release_id: 28759,
      artist_name: "Various",
      album_title: "We Are Reasonable People",
      label: "Warp Records",
    };

    async function autopopulate(user: User, link = DISCOGS_LINK) {
      await user.type(screen.getByLabelText("Autopopulate with Discogs link"), link);
      await user.click(screen.getByRole("button", { name: "Autopopulate" }));
    }

    it("checks the box when Discogs credits the release to Various", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      fakeDiscogsPrefillEndpoint({ prefill: VA_PREFILL });
      const { user } = renderBench();

      await selectGenre(user);
      await autopopulate(user);

      await waitFor(() => expect(screen.getByLabelText(VA_CHECKBOX)).toBeChecked());
      expect(screen.getByLabelText("Album title")).toHaveValue("We Are Reasonable People");
      // The artist arm swapped over on the strength of the resolve alone.
      expect(screen.queryByPlaceholderText("Search artists...")).not.toBeInTheDocument();
      expect(
        await screen.findByRole("region", { name: "Various Artists shelf" }),
      ).toBeInTheDocument();
    });

    it("leaves the box alone for a release credited to one artist", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      fakeDiscogsPrefillEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await autopopulate(user);

      await waitFor(() =>
        expect(screen.getByPlaceholderText("Search artists...")).toHaveValue("Juana Molina"),
      );
      expect(screen.getByLabelText(VA_CHECKBOX)).not.toBeChecked();
    });

    it("states the mismatch and holds the submit rather than unchecking for you", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      fakeDiscogsPrefillEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      await autopopulate(user);

      expect(
        await screen.findByText(/Discogs credits this release to Juana Molina/),
      ).toBeInTheDocument();
      // The gesture stands: filing it to the V/A shelf is what is refused, not
      // the choice to file a compilation.
      expect(screen.getByLabelText(VA_CHECKBOX)).toBeChecked();
      await fillRelease(user);
      await awaitDefaultCard();
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();

      await user.click(screen.getByLabelText(VA_CHECKBOX));
      expect(screen.queryByText(/Discogs credits this release to/)).not.toBeInTheDocument();
    });

    it("says nothing about a name the librarian merely typed before checking", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const { user } = renderBench();

      await selectGenre(user);
      await user.type(screen.getByPlaceholderText("Search artists..."), "Habibi Funk");
      await user.click(screen.getByLabelText(VA_CHECKBOX));

      // Only a resolved Discogs credit contradicts the box. Reading the typed
      // field instead would block every librarian who typed before checking.
      expect(await screen.findByText(/Filing as a Various Artists compilation/)).toBeInTheDocument();
      expect(screen.queryByText(/Discogs credits this release to/)).not.toBeInTheDocument();
    });

    it("drops a shelf pick on every prefill, since each is a different record", async () => {
      mockShelf({ owners: ROCK_BUCKETS });
      fakeDiscogsPrefillEndpoint({
        prefill: { ...VA_PREFILL, album_title: "Hell Comes to Your House" },
      });
      const { user } = renderBench();

      await selectGenre(user);
      await user.click(screen.getByLabelText(VA_CHECKBOX));
      // A title the rule names no shelf for, so what follows is a pure pick.
      await fillRelease(user, { title: "Zebra Records Sampler" });
      const panel = await screen.findByRole("region", { name: "Various Artists shelf" });
      await user.click(await within(panel).findByLabelText("Various Artists - Rock - S"));

      await autopopulate(user);

      // The pick belonged to the previous record; the resolved title names H.
      await waitFor(() =>
        expect(within(panel).getByLabelText("Various Artists - Rock - H")).toBeChecked(),
      );
      expect(within(panel).getByLabelText("Various Artists - Rock - S")).not.toBeChecked();
    });
  });

  describe("the unchecked path", () => {
    it("points a typed compilation synonym at the checkbox instead of creating an artist", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const { user } = renderBench();

      await selectGenre(user);
      await user.type(screen.getByPlaceholderText("Search artists..."), "Various Artists");
      await user.click(await screen.findByRole("option", { name: /Create new artist/ }));

      expect(
        await screen.findByText(/file through the Various Artists compilation checkbox/),
      ).toBeInTheDocument();
      await fillRelease(user);
      await awaitDefaultCard();
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();
    });

    it("leaves a band name that merely embeds a keyword alone", async () => {
      mockShelf({ owners: [PLAIN_BUCKET] });
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await user.type(screen.getByPlaceholderText("Search artists..."), "Various Production");
      await user.click(await screen.findByRole("option", { name: /Create new artist/ }));

      expect(
        screen.queryByText(/file through the Various Artists compilation checkbox/),
      ).not.toBeInTheDocument();
      await fillRelease(user);
      await awaitDefaultCard();
      await user.click(await screen.findByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0].artist).toMatchObject({
        kind: "create",
        artist_name: "Various Production",
      });
    });
  });
});
