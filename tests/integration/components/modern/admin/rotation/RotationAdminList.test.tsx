import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
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
