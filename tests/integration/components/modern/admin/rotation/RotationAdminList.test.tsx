import { describe, it, expect, vi } from "vitest";
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

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import RotationAdminList from "@/src/components/experiences/modern/admin/rotation/RotationAdminList";

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

async function renderList(rows = ALL_ROWS, cards = CARDS) {
  const fake = fakeRotationAdminEndpoints(rows, cards);
  const rendered = renderWithProviders(<RotationAdminList />);
  await screen.findByTestId("rotation-admin-active");
  return { fake, ...rendered };
}

describe("RotationAdminList", () => {
  it("reads status=all and renders both presentations with their totals", async () => {
    const { fake } = await renderList();

    await activeSection().findByText("Instant Holograms on Metal Film");
    expect(fake.listStatuses()).toEqual(["all"]);

    expect(screen.getByRole("heading", { name: "Active (4)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Killed (1)" })).toBeInTheDocument();
    expect(killedSection().getByText("Dots and Loops")).toBeInTheDocument();
    expect(killedSection().getByText("killed 09/01/26")).toBeInTheDocument();
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
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Card for: Instant Holograms on Metal Film" }),
      ).toHaveTextContent("card 1 — Late Aug"),
    );
    // The row's new card came from the endpoint's cache patch, not from
    // refetching the unbounded status=all read.
    expect(fake.listStatuses()).toEqual(["all"]);
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
