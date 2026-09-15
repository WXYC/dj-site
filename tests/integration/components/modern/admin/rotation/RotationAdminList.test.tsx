import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  fakeRotationAdminEndpoints,
  type FakeRotationAdminRow,
  type FakeRotationCard,
} from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import RotationAdminList from "@/src/components/experiences/modern/admin/rotation/RotationAdminList";
import { catalogSlice } from "@/lib/features/catalog/frontend";

const CARDS: FakeRotationCard[] = [
  { id: 31, bin: "H", number: 1, name: "Late Aug" },
  { id: 32, bin: "H", number: 2, name: null },
  { id: 21, bin: "M", number: 1, name: null },
  { id: 22, bin: "M", number: 2, name: "Fresh Arrivals" },
  { id: 11, bin: "L", number: 1, name: null },
];

function listRow(overrides: Partial<FakeRotationAdminRow> = {}): FakeRotationAdminRow {
  return {
    id: 9001,
    code_letters: "SL",
    code_artist_number: 1,
    code_number: 3,
    artist_name: "Stereolab",
    alphabetical_name: "Stereolab",
    album_title: "Instant Holograms on Metal Film",
    record_label: "Duophonic",
    label_id: null,
    genre_name: "Rock",
    format_name: "CD",
    rotation_id: 5001,
    add_date: "2026-09-05",
    rotation_add_date: "2026-09-05",
    rotation_bin: "H",
    rotation_kill_date: null,
    plays: null,
    legacy_release_id: null,
    ...overrides,
  };
}

const IHOMF = listRow({
  card: { id: 32, bin: "H", number: 2, name: null },
  urls: ["stereolab.bandcamp.com/album/instant-holograms-on-metal-film"],
});
const NILUFER = listRow({
  rotation_id: 5002,
  id: 9002,
  artist_name: "Nilüfer Yanya",
  album_title: "Painless",
  record_label: "ATO",
  code_letters: "NI",
  code_artist_number: 2,
  code_number: 2,
  rotation_add_date: "2026-09-03",
  card: { id: 31, bin: "H", number: 1, name: "Late Aug" },
});
const HALO = listRow({
  rotation_id: 5003,
  id: 9003,
  artist_name: "Juana Molina",
  album_title: "Halo",
  record_label: "Crammed Discs",
  code_letters: "JM",
  code_artist_number: 1,
  code_number: 2,
  rotation_bin: "M",
  rotation_add_date: "2026-08-25",
  card: { id: 22, bin: "M", number: 2, name: "Fresh Arrivals" },
});
const CHUQUI_UNLINKED = listRow({
  rotation_id: 5004,
  id: null,
  code_letters: null,
  code_artist_number: null,
  code_number: null,
  genre_name: null,
  format_name: null,
  artist_name: "Chuquimamani-Condori",
  album_title: "Edits",
  record_label: "self-released",
  rotation_bin: "M",
  rotation_add_date: "2026-08-30",
});
const DOTS_KILLED = listRow({
  rotation_id: 5005,
  id: 9004,
  album_title: "Dots and Loops",
  code_number: 2,
  rotation_bin: "M",
  rotation_add_date: "2026-06-02",
  rotation_kill_date: "2026-09-01",
  card: { id: 21, bin: "M", number: 1, name: null },
});

const ALL_ROWS = [IHOMF, NILUFER, HALO, CHUQUI_UNLINKED, DOTS_KILLED];

const activeSection = () => within(screen.getByTestId("rotation-admin-active"));
const killedSection = () => within(screen.getByTestId("rotation-admin-killed"));

async function renderList(
  rows = ALL_ROWS,
  cards = CARDS,
  options?: Parameters<typeof fakeRotationAdminEndpoints>[2],
) {
  const fake = fakeRotationAdminEndpoints(rows, cards, options);
  const rendered = renderWithProviders(<RotationAdminList />);
  await screen.findByTestId("rotation-admin-active");
  return { fake, ...rendered };
}

describe("RotationAdminList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads status=all and renders both presentations with their totals", async () => {
    const { fake } = await renderList();

    await activeSection().findByText("Instant Holograms on Metal Film");
    expect(fake.listStatuses()).toEqual(["all"]);

    expect(screen.getByRole("heading", { name: "Active (4)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Killed (1)" })).toBeInTheDocument();
    expect(killedSection().getByText("Dots and Loops")).toBeInTheDocument();
    expect(killedSection().getByText("killed 09/01/26")).toBeInTheDocument();
    // The killed row's card number renders in a decorative circle; the "card N"
    // reading stays accessible via the element's title, so the badge is hidden.
    expect(killedSection().getByText("1")).toHaveAttribute("aria-hidden", "true");
    expect(killedSection().getByTitle("card 1")).toBeInTheDocument();
    expect(activeSection().queryByText("Dots and Loops")).not.toBeInTheDocument();
  });

  it("orders each presentation most recently added first", async () => {
    await renderList();
    await activeSection().findByText("Instant Holograms on Metal Film");

    const order = Array.from(
      screen
        .getByTestId("rotation-admin-active")
        .querySelectorAll('[data-testid^="rotation-admin-row-"]'),
    ).map((node) => node.getAttribute("data-testid"));
    expect(order).toEqual([
      "rotation-admin-row-5001",
      "rotation-admin-row-5002",
      "rotation-admin-row-5004",
      "rotation-admin-row-5003",
    ]);
  });

  it("mounts killed rows in batches while counting and filtering over the full set", async () => {
    // Distinct add dates make the most-recently-added ordering deterministic:
    // row 0 is the oldest, so it sorts last and sits beyond the render cap.
    const killedRows = Array.from({ length: 55 }, (_, i) =>
      listRow({
        rotation_id: 7000 + i,
        id: null,
        code_letters: null,
        code_artist_number: null,
        code_number: null,
        genre_name: null,
        format_name: null,
        artist_name: "Stereolab",
        album_title: `Buried Treasure ${100 + i}`,
        rotation_bin: "M",
        rotation_add_date: `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, "0")}`,
        rotation_kill_date: "2026-09-01",
      }),
    );
    const { user } = await renderList([IHOMF, ...killedRows]);
    await killedSection().findByText("Buried Treasure 154");

    const mountedKilledRows = () =>
      screen
        .getByTestId("rotation-admin-killed")
        .querySelectorAll('[data-testid^="rotation-admin-row-"]').length;

    // The heading counts the whole set; only the first batch is mounted.
    expect(screen.getByRole("heading", { name: "Killed (55)" })).toBeInTheDocument();
    expect(mountedKilledRows()).toBe(50);

    // Search runs over the full set, not the mounted slice: the one match is
    // the oldest row, which was beyond the cap.
    await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "treasure 100");
    expect(screen.getByRole("heading", { name: "Killed (1 of 55)" })).toBeInTheDocument();
    expect(killedSection().getByText("Buried Treasure 100")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search rotation" }));

    await user.click(screen.getByRole("button", { name: "Show 5 more" }));
    expect(mountedKilledRows()).toBe(55);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });

  it("renders an unlinked row from its snapshot fields, with no shelf code", async () => {
    await renderList();
    await activeSection().findByText("Edits");

    const rowSheet = within(screen.getByTestId("rotation-admin-row-5004"));
    expect(rowSheet.getByText("Chuquimamani-Condori")).toBeInTheDocument();
    expect(rowSheet.getByText("no card")).toBeInTheDocument();
    // The code columns are the library join's; an unlinked row has none. The
    // letter-space-digits/digits shape can't collide with the MM/DD/YY dates
    // the row also renders.
    expect(rowSheet.queryByText(/[A-Z]{2} \d+\/\d+/)).not.toBeInTheDocument();
  });

  it("search narrows every section and reports N of total", async () => {
    const { user } = await renderList();
    await activeSection().findByText("Instant Holograms on Metal Film");

    await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "stereolab");

    expect(screen.getByRole("heading", { name: "Active (1 of 4)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Killed (1 of 1)" })).toBeInTheDocument();
    expect(activeSection().getByText("Instant Holograms on Metal Film")).toBeInTheDocument();
    expect(activeSection().queryByText("Painless")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "H (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "M (0)" })).toBeInTheDocument();
  });

  it("search folds diacritics in both directions", async () => {
    const { user } = await renderList();
    await activeSection().findByText("Painless");

    await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "nilufer");

    expect(screen.getByRole("heading", { name: "Active (1 of 4)" })).toBeInTheDocument();
    expect(activeSection().getByText("Painless")).toBeInTheDocument();
  });

  it("search matches the shelf code", async () => {
    const { user } = await renderList();
    await activeSection().findByText("Instant Holograms on Metal Film");

    await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "SL 1/3");

    expect(screen.getByRole("heading", { name: "Active (1 of 4)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Killed (0 of 1)" })).toBeInTheDocument();
    expect(activeSection().getByText("Instant Holograms on Metal Film")).toBeInTheDocument();
  });

  it("selecting a bin reveals that bin's card sub-filter with counts", async () => {
    const { user } = await renderList();
    await activeSection().findByText("Instant Holograms on Metal Film");
    expect(screen.queryByRole("button", { name: "All cards" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "H (2)" }));

    expect(screen.getByRole("heading", { name: "Active (2 of 4)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Killed (0 of 1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All cards" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "card 1 — Late Aug (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "card 2 (1)" })).toBeInTheDocument();
  });

  it("a card chip narrows to that card's rows and composes with search", async () => {
    const { user } = await renderList();
    await activeSection().findByText("Instant Holograms on Metal Film");

    await user.click(screen.getByRole("button", { name: "H (2)" }));
    await user.click(screen.getByRole("button", { name: "card 2 (1)" }));

    expect(screen.getByRole("heading", { name: "Active (1 of 4)" })).toBeInTheDocument();
    expect(activeSection().getByText("Instant Holograms on Metal Film")).toBeInTheDocument();
    expect(activeSection().queryByText("Painless")).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "painless");
    expect(screen.getByRole("heading", { name: "Active (0 of 4)" })).toBeInTheDocument();
    expect(activeSection().getByText(/No active rotation entries match/)).toBeInTheDocument();
  });

  it("a card filter hides uncarded rows and clears when the bin changes", async () => {
    const { user } = await renderList();
    await activeSection().findByText("Edits");

    await user.click(screen.getByRole("button", { name: "M (2)" }));
    expect(activeSection().getByText("Edits")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "card 2 — Fresh Arrivals (1)" }));
    expect(activeSection().queryByText("Edits")).not.toBeInTheDocument();
    expect(activeSection().getByText("Halo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "H (2)" }));
    expect(screen.getByRole("button", { name: "All cards" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("heading", { name: "Active (2 of 4)" })).toBeInTheDocument();
  });

  it("kills and unkills an unlinked row through the existing mutations, moving it between presentations", async () => {
    const { fake, user } = await renderList();
    await activeSection().findByText("Edits");

    await user.click(screen.getByRole("button", { name: "Kill: Edits" }));

    await killedSection().findByText("Edits");
    expect(activeSection().queryByText("Edits")).not.toBeInTheDocument();
    // The bodyless-path kill carries only the rotation id — the server
    // stamps the date itself.
    expect(fake.killBodies()).toEqual([{ rotation_id: 5004 }]);
    expect(screen.getByRole("heading", { name: "Active (3)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Killed (2)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unkill: Edits" }));

    await activeSection().findByText("Edits");
    expect(killedSection().queryByText("Edits")).not.toBeInTheDocument();
    expect(fake.updateBodies()).toEqual([{ id: 5004, body: { kill_date: null } }]);
    expect(screen.getByRole("heading", { name: "Active (4)" })).toBeInTheDocument();
    // The rows moved through the endpoints' cache patches: the unbounded
    // status=all read was fetched exactly once, before either action.
    expect(fake.listStatuses()).toEqual(["all"]);
  });

  it("unkills a catalogued killed row via kill_date: null", async () => {
    const { fake, user } = await renderList();
    await killedSection().findByText("Dots and Loops");

    await user.click(screen.getByRole("button", { name: "Unkill: Dots and Loops" }));

    await activeSection().findByText("Dots and Loops");
    expect(fake.updateBodies()).toEqual([{ id: 5005, body: { kill_date: null } }]);
    expect(screen.getByRole("heading", { name: "Killed (0)" })).toBeInTheDocument();
  });

  it("card select PATCHes card_id alone and refreshes the cards read", async () => {
    const { fake, user } = await renderList();
    await activeSection().findByText("Instant Holograms on Metal Film");
    expect(fake.cardsRequests()).toBe(1);

    await user.click(
      screen.getByRole("combobox", { name: "Card for: Instant Holograms on Metal Film" }),
    );
    await user.click(await screen.findByRole("option", { name: "card 1 — Late Aug" }));

    await waitFor(() =>
      expect(fake.updateBodies()).toEqual([{ id: 5001, body: { card_id: 31 } }]),
    );
    // The cards surface counts rows per card, so a card move refetches it.
    await waitFor(() => expect(fake.cardsRequests()).toBe(2));
    // The selected value shows the chosen card as its decorative badge plus the
    // name; the "card 1 — Late Aug" reading rides the combobox's own labelling.
    await waitFor(() => {
      const combobox = screen.getByRole("combobox", {
        name: "Card for: Instant Holograms on Metal Film",
      });
      expect(combobox).toHaveTextContent("Late Aug");
      expect(within(combobox).getByText("1")).toHaveAttribute("aria-hidden", "true");
    });
    // The row's new card came from the endpoint's cache patch, not from
    // refetching the unbounded status=all read.
    expect(fake.listStatuses()).toEqual(["all"]);
  });

  it("renders each card option as its decorative badge while the full card reading stays the accessible name", async () => {
    const { user } = await renderList();
    await activeSection().findByText("Instant Holograms on Metal Film");

    await user.click(
      screen.getByRole("combobox", { name: "Card for: Instant Holograms on Metal Film" }),
    );

    // The number shows only as an aria-hidden circle, but the full "card N —
    // name" is still the option's accessible name — what typeahead and a
    // screen reader read.
    const namedOption = await screen.findByRole("option", { name: "card 1 — Late Aug" });
    expect(namedOption).toHaveTextContent("Late Aug");
    expect(within(namedOption).getByText("1")).toHaveAttribute("aria-hidden", "true");

    // An unnamed card keeps its "card N" accessible name — the aria-hidden
    // badge alone would leave a screen reader with nothing.
    const unnamedOption = screen.getByRole("option", { name: "card 2" });
    expect(within(unnamedOption).getByText("2")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the selected card's badge in the Select's value", async () => {
    await renderList();
    // Painless sits on card 1 (Late Aug); the closed Select shows that card as
    // its badge beside the name, never the bare "card 1 — Late Aug" text.
    const combobox = await screen.findByRole("combobox", { name: "Card for: Painless" });
    expect(combobox).toHaveTextContent("Late Aug");
    expect(within(combobox).getByText("1")).toHaveAttribute("aria-hidden", "true");
  });

  describe("bin moves", () => {
    it("moves a catalogued row add-first: the add lands before the kill, with no card_id", async () => {
      const { fake, user } = await renderList();
      await activeSection().findByText("Instant Holograms on Metal Film");

      await user.click(
        screen.getByRole("button", { name: "Move to Medium: Instant Holograms on Metal Film" }),
      );

      // The add names the library release, the target bin, and the row's
      // stored links — the kill half retires the only row that holds them,
      // so an add without `urls` would be a move that destroys the record's
      // curated links. Still no card_id: an omitted card is the server's cue
      // to file on the target bin's newest card, and the retire is the same
      // bodyless-path kill the Kill button issues.
      await waitFor(() =>
        expect(fake.addBodies()).toEqual([
          {
            album_id: 9001,
            rotation_bin: "M",
            urls: ["stereolab.bandcamp.com/album/instant-holograms-on-metal-film"],
          },
        ]),
      );
      await waitFor(() => expect(fake.killBodies()).toEqual([{ rotation_id: 5001 }]));
      expect(fake.callOrder()).toEqual(["add", "kill"]);
      await waitFor(() =>
        expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."),
      );

      // The replacement is a new active row in the target bin, landed on the
      // bin's newest card (the fake mirrors the server's defaulting); the
      // old entry moves to the Killed presentation.
      const movedRow = await screen.findByTestId("rotation-admin-row-5006");
      const movedCombobox = within(movedRow).getByRole("combobox", {
        name: "Card for: Instant Holograms on Metal Film",
      });
      expect(movedCombobox).toHaveTextContent("Fresh Arrivals");
      expect(within(movedCombobox).getByText("2")).toHaveAttribute("aria-hidden", "true");
      await killedSection().findByText("Instant Holograms on Metal Film");
      // The move lock releases once the post-move refetch lands: the new
      // row's own move chips are live again.
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Move to Heavy: Instant Holograms on Metal Film" }),
        ).toBeEnabled(),
      );
    });

    it("releases the move chips after a failed add — nothing changed, so nothing stays locked", async () => {
      const { fake, user } = await renderList();
      await activeSection().findByText("Instant Holograms on Metal Film");
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({}, { status: 500 }),
        ),
      );

      const chip = screen.getByRole("button", {
        name: "Move to Medium: Instant Holograms on Metal Film",
      });
      await user.click(chip);

      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith(
          "Couldn't move this release to Medium — nothing changed.",
        ),
      );
      // Add-first means the failed add attempted no kill; the failed add
      // triggers no refetch, so a lock that only ever released on refetch
      // completion would wedge these chips here.
      expect(fake.killBodies()).toEqual([]);
      await waitFor(() => expect(chip).toBeEnabled());
    });

    it("releases the move lock even when the post-move refetch itself fails", async () => {
      const { user } = await renderList();
      await activeSection().findByText("Instant Holograms on Metal Film");
      // Both writes succeed; only the invalidation-driven list refetch
      // errors, so the last-good rows stay on screen and the lock must
      // still come back for them.
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "boom" }, { status: 500 }),
        ),
      );

      await user.click(
        screen.getByRole("button", { name: "Move to Medium: Instant Holograms on Metal Film" }),
      );

      await waitFor(() =>
        expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."),
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Move to Medium: Instant Holograms on Metal Film" }),
        ).toBeEnabled(),
      );
    });

    it("keeps the new-bin record when the kill half fails, leaving a visible duplicate", async () => {
      const { fake, user } = await renderList();
      await activeSection().findByText("Instant Holograms on Metal Film");
      // Only the bodyless-path kill fails; the add (POST) and the list read
      // keep answering, so the safety property is observable end-to-end.
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({}, { status: 500 }),
        ),
      );

      await user.click(
        screen.getByRole("button", { name: "Move to Medium: Instant Holograms on Metal Film" }),
      );

      // The record still exists in the new bin — the failure mode is a
      // duplicate to clean up, never a lost record.
      const movedRow = await screen.findByTestId("rotation-admin-row-5006");
      expect(activeSection().getByTestId("rotation-admin-row-5006")).toBe(movedRow);
      // And the old entry is still active alongside it, with its own Kill.
      expect(activeSection().getByTestId("rotation-admin-row-5001")).toBeInTheDocument();
      expect(fake.addBodies()).toHaveLength(1);
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith(
          "Filed in Medium, but couldn't retire the Heavy entry — kill it from this list.",
        ),
      );
    });

    it("moves an unlinked row through the free-text mutation with its whole snapshot carried", async () => {
      // The pre-catalog FKs live only on the single-row read (the list row's
      // label_id is the library join's, null here by construction), so the
      // move must fetch them; the urls ride on the list row itself.
      const { fake, user } = await renderList(
        [...ALL_ROWS.filter((row) => row !== CHUQUI_UNLINKED), { ...CHUQUI_UNLINKED, urls: ["chuquimamani.bandcamp.com/album/edits"] }],
        CARDS,
        { rowSummaries: { 5004: { format_id: 7, label_id: 42 } } },
      );
      await activeSection().findByText("Edits");

      await user.click(screen.getByRole("button", { name: "Move to Light: Edits" }));

      await waitFor(() =>
        expect(fake.addBodies()).toEqual([
          {
            rotation_bin: "L",
            artist_name: "Chuquimamani-Condori",
            album_title: "Edits",
            record_label: "self-released",
            format_id: 7,
            label_id: 42,
            urls: ["chuquimamani.bandcamp.com/album/edits"],
          },
        ]),
      );
      await waitFor(() => expect(fake.killBodies()).toEqual([{ rotation_id: 5004 }]));
      expect(fake.callOrder()).toEqual(["add", "kill"]);

      const movedRow = await screen.findByTestId("rotation-admin-row-5006");
      expect(within(movedRow).getByText("Chuquimamani-Condori")).toBeInTheDocument();
      await killedSection().findByText("Edits");
    });

    it("refuses an unlinked move when the single-row read fails — nothing changed", async () => {
      // The read exists to feed the write, so it fails closed: proceeding
      // without it would re-file the release with its pre-catalog fields
      // silently dropped.
      const { fake, user } = await renderList();
      await activeSection().findByText("Edits");
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation/5004`, () =>
          HttpResponse.json({ error: "boom" }, { status: 500 }),
        ),
      );

      await user.click(screen.getByRole("button", { name: "Move to Light: Edits" }));

      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith(
          "Couldn't move this release to Light — nothing changed.",
        ),
      );
      expect(fake.addBodies()).toEqual([]);
      expect(fake.killBodies()).toEqual([]);
      expect(activeSection().getByTestId("rotation-admin-row-5004")).toBeInTheDocument();
    });

    it("also retires the album's active row already in the target bin — never an invisible in-bin duplicate", async () => {
      // Album 9001 is in the duplicate state: active in H and
      // M at once. Moving the H row to M must consolidate, not stack a
      // second active M row every DISTINCT ON consumer collapses to one.
      const IHOMF_M_DUP: FakeRotationAdminRow = {
        ...IHOMF,
        rotation_id: 5007,
        rotation_bin: "M",
        rotation_add_date: "2026-08-20",
        card: null,
      };
      const { fake, user } = await renderList([...ALL_ROWS, IHOMF_M_DUP]);
      // The title appears on both duplicate rows; wait on the dup's own row.
      await screen.findByTestId("rotation-admin-row-5007");

      await user.click(
        screen.getByRole("button", { name: "Move to Medium: Instant Holograms on Metal Film" }),
      );

      await waitFor(() =>
        expect(fake.killBodies()).toEqual([{ rotation_id: 5001 }, { rotation_id: 5007 }]),
      );
      expect(fake.callOrder()).toEqual(["add", "kill", "kill"]);
      await waitFor(() =>
        expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."),
      );
    });

    it("clears the per-album catalog rotation claim once the move settles", async () => {
      // The add's cache handler writes a rotation claim for the album into
      // the catalog slice; bounded to the gesture it protects the new bin
      // from the kill half's clear, but left behind it would make a later
      // out-of-band kill of the album's real entry skip its catalog clear
      // for the life of the tab.
      const { user, store } = await renderList();
      await activeSection().findByText("Instant Holograms on Metal Film");

      await user.click(
        screen.getByRole("button", { name: "Move to Medium: Instant Holograms on Metal Film" }),
      );

      await waitFor(() =>
        expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."),
      );
      await waitFor(() =>
        expect(catalogSlice.selectors.getAlbumRotation(store.getState(), 9001)).toBeUndefined(),
      );
    });

    it("offers no move on killed rows — their bin is a fact, not an affordance", async () => {
      await renderList();
      await killedSection().findByText("Dots and Loops");

      expect(
        screen.queryByRole("button", { name: "Move to Heavy: Dots and Loops" }),
      ).not.toBeInTheDocument();
      expect(within(screen.getByTestId("rotation-admin-row-5005")).getByText("M")).toBeInTheDocument();
    });
  });

  it("renders an outage as a retryable failure, never as an empty list", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
      http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () => HttpResponse.json([])),
    );
    renderWithProviders(<RotationAdminList />);

    expect(await screen.findByText("Could not load the rotation list.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByTestId("rotation-admin-active")).not.toBeInTheDocument();
  });
});
