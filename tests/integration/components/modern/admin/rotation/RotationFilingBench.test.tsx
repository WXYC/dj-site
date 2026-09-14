import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
} from "@/tests/helpers";
import { fakeRotationCardsEndpoints } from "@/tests/fakes/rotation";
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

// No organization configured (the real production shape): the WXYC tier
// resolves via fetchOrganizationRoleForUserClient's JWT decode, not the raw
// session role, so every test drives that mock and awaits resolution.
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
const ARTIST_ID = TEST_ENTITY_IDS.ARTIST.ROCK_ARTIST;

const MOLINA_ROW: FakeFilingArtistRow = {
  id: ARTIST_ID,
  artist_name: "Juana Molina",
  code_letters: "JM",
  code_artist_number: 1,
  genre_id: GENRE_ID,
};

/** Heavy holds cards 1 and 2, so the bin's newest (2, id 32) is the default. */
const CARDS = [
  { id: 31, bin: "H", number: 1, name: "Late Aug" },
  { id: 32, bin: "H", number: 2, name: null },
  { id: 41, bin: "M", number: 1, name: null },
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
      HttpResponse.json([{ id: GENRE_ID, genre_name: "Rock" }]),
    ),
    http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
      HttpResponse.json([
        { id: 1, format_name: "CD" },
        { id: 2, format_name: "LP" },
      ]),
    ),
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, () =>
      HttpResponse.json({
        artists: [
          {
            id: ARTIST_ID,
            artist_name: "Juana Molina",
            code_letters: "JM",
            code_number: 1,
          },
        ],
      }),
    ),
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () =>
      HttpResponse.json({ next_code_number: 7 }),
    ),
  );
}

/** The create path starts from a name the catalog does not have. */
function mockEmptyArtistSearch() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, () =>
      HttpResponse.json({ artists: [] }),
    ),
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

async function pickExistingArtist(user: User) {
  const input = await screen.findByPlaceholderText("Search artists...");
  await user.type(input, "Juana");
  await user.click(await screen.findByRole("option", { name: "Juana Molina" }));
}

async function fillRelease(user: User, { title = "DOGA", label = "Sonamos" } = {}) {
  await user.type(screen.getByLabelText("Album title"), title);
  if (label) await user.type(screen.getByLabelText("Label"), label);
  await user.click(screen.getByRole("combobox", { name: "Format" }));
  await user.click(await screen.findByRole("option", { name: "CD" }));
}

/** The card default lands asynchronously; a submit before it would file cardless. */
async function awaitDefaultCard() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
}

function ledger() {
  return screen.getByRole("region", { name: "Filed this session" });
}

describe("RotationFilingBench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(sessionWithRole());
    mockCatalogLists();
    fakeRotationCardsEndpoints(CARDS);
  });

  it("files an existing artist's release to the default Heavy bin's newest card in one submit", async () => {
    const filings = fakeLibraryFilingsEndpoint({ existingArtists: [MOLINA_ROW] });
    const { user } = renderBench();

    await selectGenre(user);
    await pickExistingArtist(user);
    await fillRelease(user);
    await awaitDefaultCard();
    await user.type(screen.getByLabelText("Release link URL 1"), "juanamolina.bandcamp.com");

    await user.click(screen.getByRole("button", { name: "Add to rotation" }));

    await waitFor(() => expect(filings.bodies()).toHaveLength(1));
    expect(filings.bodies()[0]).toEqual({
      artist: { kind: "existing", artist_id: ARTIST_ID },
      release: {
        album_title: "DOGA",
        genre_id: GENRE_ID,
        format_id: 1,
        label: "Sonamos",
      },
      rotation: {
        rotation_bin: "H",
        card_id: 32,
        urls: ["juanamolina.bandcamp.com"],
      },
    });

    const receipt = ledger();
    expect(await within(receipt).findByText("Juana Molina — DOGA")).toBeInTheDocument();
    expect(within(receipt).getByText(/JM 1\/1/)).toBeInTheDocument();
    expect(within(receipt).getByText(/Heavy/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View in rotation list" }),
    ).toHaveAttribute("href", "/dashboard/admin/rotation");

    // The batch flow: artist and title clear for the next record, while
    // label, format, bin and card persist.
    expect(screen.getByPlaceholderText("Search artists...")).toHaveValue("");
    expect(screen.getByLabelText("Album title")).toHaveValue("");
    expect(screen.getByLabelText("Label")).toHaveValue("Sonamos");
  });

  it("omits rotation entirely when Heavy is deselected for a library-only filing", async () => {
    const filings = fakeLibraryFilingsEndpoint({ existingArtists: [MOLINA_ROW] });
    const { user } = renderBench();

    await selectGenre(user);
    await pickExistingArtist(user);
    await fillRelease(user);
    await user.click(screen.getByLabelText("Heavy rotation"));
    expect(screen.getByText(/Library-only filing/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "File to library" }));

    await waitFor(() => expect(filings.bodies()).toHaveLength(1));
    expect(filings.bodies()[0]).not.toHaveProperty("rotation");
    expect(await within(ledger()).findByText(/Library only/)).toBeInTheDocument();
  });

  it("names a rotation_card_bin_mismatch at the card row and files nothing", async () => {
    fakeLibraryFilingsEndpoint({
      respond: () => filingConflictResponse("rotation_card_bin_mismatch"),
    });
    const { user } = renderBench();

    await selectGenre(user);
    await pickExistingArtist(user);
    await fillRelease(user);
    await awaitDefaultCard();
    await user.click(screen.getByRole("button", { name: "Add to rotation" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That card belongs to a different bin");
    // Refusal left no partial client state: nothing in the receipt, and the
    // form still holds exactly what was typed.
    expect(within(ledger()).getByText("Nothing filed yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Album title")).toHaveValue("DOGA");
    // Resubmitting unchanged could only hit the same 409; picking a card in
    // this bin is the edit that reopens it.
    expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /1 · Late Aug/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to rotation" })).toBeEnabled();
  });

  it("keeps every field and says the filing was all-or-nothing on a non-conflict failure", async () => {
    fakeLibraryFilingsEndpoint({
      respond: () => HttpResponse.json({ message: "boom" }, { status: 500 }),
    });
    const { user } = renderBench();

    await selectGenre(user);
    await pickExistingArtist(user);
    await fillRelease(user);
    await awaitDefaultCard();
    await user.click(screen.getByRole("button", { name: "Add to rotation" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Filing failed — nothing was saved.");
    expect(screen.getByLabelText("Album title")).toHaveValue("DOGA");
    expect(within(ledger()).getByText("Nothing filed yet.")).toBeInTheDocument();
  });

  describe("inline create", () => {
    async function openCreatePanel(user: User, name = "Chuquimamani-Condori") {
      const input = await screen.findByPlaceholderText("Search artists...");
      await user.type(input, name);
      await user.click(
        await screen.findByRole("option", { name: `Create new artist "${name}"` }),
      );
    }

    it("expands the create row into the inline panel and files the new artist without a code number", async () => {
      mockEmptyArtistSearch();
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await openCreatePanel(user);

      // The panel seeds the catalog's two-letter suggestion and auto-fills
      // the code number from the live peek; both stay fully editable.
      expect(await screen.findByLabelText("Call letters")).toHaveValue("CH");
      await waitFor(() =>
        expect(screen.getByLabelText("Code number")).toHaveValue("7"),
      );

      await fillRelease(user, { title: "Edits", label: "" });
      await awaitDefaultCard();
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      // The clean field's number is the server's to assign: kind is set
      // explicitly and code_number is omitted, never copied from the peek.
      expect(filings.bodies()[0]).toEqual({
        artist: {
          kind: "create",
          artist_name: "Chuquimamani-Condori",
          code_letters: "CH",
          genre_id: GENRE_ID,
        },
        release: { album_title: "Edits", genre_id: GENRE_ID, format_id: 1 },
        rotation: { rotation_bin: "H", card_id: 32 },
      });
      expect(
        await within(ledger()).findByText("Chuquimamani-Condori — Edits"),
      ).toBeInTheDocument();
      // The panel closed with the successful filing's reset.
      expect(screen.queryByLabelText("Call letters")).not.toBeInTheDocument();
    });

    it("sends the MD's dirty code number as typed", async () => {
      mockEmptyArtistSearch();
      const filings = fakeLibraryFilingsEndpoint();
      const { user } = renderBench();

      await selectGenre(user);
      await openCreatePanel(user);
      await waitFor(() =>
        expect(screen.getByLabelText("Code number")).toHaveValue("7"),
      );

      await user.tripleClick(screen.getByLabelText("Code number"));
      await user.keyboard("12");
      await fillRelease(user, { title: "Edits", label: "" });
      await awaitDefaultCard();
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0]).toMatchObject({
        artist: { kind: "create", code_number: 12 },
      });
    });

    it("matches an existing artist without creating: the panel never opens", async () => {
      const filings = fakeLibraryFilingsEndpoint({ existingArtists: [MOLINA_ROW] });
      const { user } = renderBench();

      await selectGenre(user);
      await pickExistingArtist(user);
      expect(screen.queryByLabelText("Call letters")).not.toBeInTheDocument();

      await fillRelease(user);
      await awaitDefaultCard();
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(filings.bodies()).toHaveLength(1));
      expect(filings.bodies()[0]).toMatchObject({
        artist: { kind: "existing", artist_id: ARTIST_ID },
      });
    });

    it("names the holder of a refused artist code at the code field and files nothing", async () => {
      mockEmptyArtistSearch();
      const filings = fakeLibraryFilingsEndpoint({
        respond: () =>
          filingConflictResponse("artist_code_conflict", {
            id: 5,
            artist_name: "Stereolab",
            code_letters: "CH",
            code_artist_number: 12,
            genre_id: GENRE_ID,
          }),
      });
      const { user } = renderBench();

      await selectGenre(user);
      await openCreatePanel(user);
      await waitFor(() =>
        expect(screen.getByLabelText("Code number")).toHaveValue("7"),
      );
      await user.tripleClick(screen.getByLabelText("Code number"));
      await user.keyboard("12");
      await fillRelease(user, { title: "Edits", label: "" });
      await awaitDefaultCard();
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("CH12 is already taken by Stereolab.");
      expect(filings.bodies()).toHaveLength(1);
      expect(within(ledger()).getByText("Nothing filed yet.")).toBeInTheDocument();
      expect(screen.getByLabelText("Album title")).toHaveValue("Edits");
      // The refused triple blocks resubmission until one of its fields moves.
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeDisabled();
      await user.tripleClick(screen.getByLabelText("Code number"));
      await user.keyboard("13");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add to rotation" })).toBeEnabled();
    });
  });

  it("accumulates the session's filings in order", async () => {
    const filings = fakeLibraryFilingsEndpoint({ existingArtists: [MOLINA_ROW] });
    const { user } = renderBench();

    await selectGenre(user);
    await pickExistingArtist(user);
    await fillRelease(user);
    await awaitDefaultCard();
    await user.click(screen.getByRole("button", { name: "Add to rotation" }));
    await within(ledger()).findByText("Juana Molina — DOGA");

    await pickExistingArtist(user);
    await user.type(screen.getByLabelText("Album title"), "Halo");
    await user.click(screen.getByRole("button", { name: "Add to rotation" }));

    await within(ledger()).findByText("Juana Molina — Halo");
    expect(filings.bodies()).toHaveLength(2);
    expect(within(ledger()).getByText("Juana Molina — DOGA")).toBeInTheDocument();
  });
});
