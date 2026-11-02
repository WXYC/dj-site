import { describe, it, expect, vi, beforeEach, onTestFinished } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  server,
  TEST_BACKEND_URL,
  fakeRotationAdminEndpoints,
  createTestRotationListRow,
  type FakeRotationAdminRow,
  type FakeRotationCard,
} from "@/tests/helpers";

vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { renderWithModernTheme as renderWithProviders } from "@/tests/helpers/renderModern";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router, { pathname: "/dashboard/admin/rotation", search: () => "" });
});

const toastMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  }),
}));

import RotationShelf from "@/src/components/experiences/modern/admin/rotation/shelf/RotationShelf";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { rotationApi } from "@/lib/features/rotation/api";
import type { RotationListRow } from "@/lib/features/rotation/types";

const CARDS: FakeRotationCard[] = [
  { id: 31, bin: "H", number: 1, name: "Late Aug" },
  { id: 32, bin: "H", number: 2, name: null },
  { id: 21, bin: "M", number: 1, name: null },
  { id: 22, bin: "M", number: 2, name: "Fresh Arrivals" },
  { id: 11, bin: "L", number: 1, name: null },
];

const listRow = (overrides: Partial<RotationListRow> = {}): RotationListRow =>
  createTestRotationListRow({
    id: 9001,
    ...overrides,
  });

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

const IHOMF_TITLE = "Instant Holograms on Metal Film";

// Noon UTC, a few days after the fixtures' latest add date: every active
// fixture row is only days old here, nowhere near its 60-day window, so no
// case starts rendering an overdue row by accident.
const DEFAULT_NOW = new Date("2026-09-13T12:00:00Z");

const shelfTable = () => screen.getByRole("table", { name: "Rotation shelf" });
const shownOrder = () =>
  Array.from(shelfTable().querySelectorAll('[data-testid^="rotation-admin-row-"]')).map((node) =>
    node.getAttribute("data-testid"),
  );
const rowFor = (rotationId: number) => within(screen.getByTestId(`rotation-admin-row-${rotationId}`));
const binStrip = (label: string) => {
  const strip = Array.from(shelfTable().querySelectorAll("tr.bin-strip")).find((node) =>
    within(node as HTMLElement).queryByText(label),
  );
  if (!strip) throw new Error(`no bin strip for ${label}`);
  return within(strip as HTMLElement);
};
const statusRegion = () => screen.getByRole("status");
// Found by the chip action's own aria-label; the dedicated accessible-name
// case below pins that this is also the name a screen reader computes.
const binChip = (label: string) => screen.getByLabelText(label, { selector: "button" });

// Waits for the thresholds read to settle as well as the list: they are two
// requests, and an assertion on a chip made while the windows are still
// pending would race the second one.
async function renderShelfFor(fake: ReturnType<typeof fakeRotationAdminEndpoints>, now?: Date) {
  const rendered = renderWithProviders(<RotationShelf now={now} />);
  await waitFor(() => expect(shelfTable()).toHaveAttribute("aria-busy", "false"));
  await waitFor(() => {
    const { status } = rotationApi.endpoints.getRotationThresholds.select()(rendered.store.getState());
    expect(["fulfilled", "rejected"]).toContain(status);
  });
  return { fake, ...rendered };
}

async function renderShelf(
  rows: FakeRotationAdminRow[] = ALL_ROWS,
  cards = CARDS,
  options?: Parameters<typeof fakeRotationAdminEndpoints>[2],
  now: Date = DEFAULT_NOW,
) {
  return renderShelfFor(fakeRotationAdminEndpoints(rows, cards, options), now);
}

type User = Awaited<ReturnType<typeof renderShelf>>["user"];

const showRetired = (user: User) => user.click(screen.getByRole("button", { name: /^Retired \d+$/ }));
const showActive = (user: User) => user.click(screen.getByRole("button", { name: /^Active \d+$/ }));

async function openMoveMenu(user: User, name: string) {
  await user.click(screen.getByRole("button", { name: `Move: ${name}` }));
  return within(await screen.findByRole("menu", { name: `Actions for ${name}` }));
}

async function moveToBin(user: User, name: string, binLabel: string) {
  const menu = await openMoveMenu(user, name);
  await user.click(menu.getByRole("menuitem", { name: `Move to ${binLabel}: ${name}` }));
}

// A click outside the menu, which closes it through its click-away listener.
const closeMenus = (user: User) => user.click(document.body);

const chooseSort = async (user: User, name: string) => {
  await user.click(screen.getByRole("combobox", { name: "Sort rotation" }));
  await user.click(await screen.findByRole("option", { name }));
};

/** A list read that waits on the returned release, then falls through to the fake's own handler. */
function holdNextListReads() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/rotation`, async () => {
      held += 1;
      await gate;
    }),
  );
  return { release, held: () => held };
}

describe("RotationShelf (list view)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads status=all and shows the active rows, with both totals on the status toggle", async () => {
    const { fake } = await renderShelf();

    expect(fake.listStatuses()).toEqual(["all"]);
    expect(screen.getByRole("button", { name: "Active 4" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Retired 1" })).toHaveAttribute("aria-pressed", "false");
    expect(within(shelfTable()).getByText(IHOMF_TITLE)).toBeInTheDocument();
    expect(within(shelfTable()).queryByText("Dots and Loops")).not.toBeInTheDocument();
    expect(statusRegion()).toHaveTextContent("4 active records");
  });

  it("shows retired rows behind the toggle, with the retire date and the bin and card they left", async () => {
    const { user, fake } = await renderShelf();

    await showRetired(user);

    expect(shownOrder()).toEqual(["rotation-admin-row-5005"]);
    const retired = rowFor(5005);
    expect(retired.getByText("Dots and Loops")).toBeInTheDocument();
    expect(retired.getByText("retired 09/01/26")).toBeInTheDocument();
    expect(retired.getByLabelText("Medium rotation, card 1")).toBeInTheDocument();
    expect(within(shelfTable()).queryByText(IHOMF_TITLE)).not.toBeInTheDocument();
    // Switching presentations is client-side over the one status=all read.
    expect(fake.listStatuses()).toEqual(["all"]);
  });

  it("groups rows under a strip per bin, in bin order, each strip counting its rows", async () => {
    await renderShelf();

    expect(binStrip("Heavy").getByText("2")).toBeInTheDocument();
    expect(binStrip("Medium").getByText("2")).toBeInTheDocument();
    // A bin with no shown rows gets no strip at all.
    expect(within(shelfTable()).queryByText("Light")).not.toBeInTheDocument();
    expect(shownOrder()).toEqual([
      "rotation-admin-row-5002",
      "rotation-admin-row-5001",
      "rotation-admin-row-5003",
      "rotation-admin-row-5004",
    ]);
  });

  it("orders each bin oldest-added first by default", async () => {
    await renderShelf();

    expect(screen.getByRole("combobox", { name: "Sort rotation" })).toHaveTextContent("Oldest first");
    expect(shownOrder()).toEqual([
      "rotation-admin-row-5002",
      "rotation-admin-row-5001",
      "rotation-admin-row-5003",
      "rotation-admin-row-5004",
    ]);
  });

  it("switching the sort to newest first reorders the active rows and leaves the retired order alone", async () => {
    // A second retired row, added after DOTS_KILLED, so the retired
    // presentation has a real order (most recently added first) to prove it
    // holds rather than trivially passing with a single row.
    const MARS_KILLED = listRow({
      rotation_id: 5008,
      id: 9005,
      artist_name: "Stereolab",
      album_title: "Mars Audiac Quintet",
      code_number: 4,
      rotation_bin: "M",
      rotation_add_date: "2026-09-02",
      rotation_kill_date: "2026-09-05",
      card: null,
    });
    const { user } = await renderShelf([...ALL_ROWS, MARS_KILLED]);

    await showRetired(user);
    expect(shownOrder()).toEqual(["rotation-admin-row-5008", "rotation-admin-row-5005"]);
    await showActive(user);

    await chooseSort(user, "Newest first");

    await waitFor(() =>
      expect(shownOrder()).toEqual([
        "rotation-admin-row-5001",
        "rotation-admin-row-5002",
        "rotation-admin-row-5004",
        "rotation-admin-row-5003",
      ]),
    );
    await showRetired(user);
    expect(shownOrder()).toEqual(["rotation-admin-row-5008", "rotation-admin-row-5005"]);
    expect(screen.getByRole("button", { name: "Active 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retired 2" })).toBeInTheDocument();
  });

  it("mounts retired rows in batches while counting and searching over the full set", async () => {
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
    const { user } = await renderShelf([IHOMF, ...killedRows]);

    await showRetired(user);
    await within(shelfTable()).findByText("Buried Treasure 154");

    // The toggle counts the whole set; only the first batch is mounted.
    expect(screen.getByRole("button", { name: "Retired 55" })).toBeInTheDocument();
    expect(shownOrder()).toHaveLength(50);
    expect(within(shelfTable()).queryByText("Buried Treasure 100")).not.toBeInTheDocument();

    // Search runs over the full set, not the mounted slice: the one match is
    // the oldest row, which was beyond the cap.
    await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "treasure 100");
    expect(shownOrder()).toEqual(["rotation-admin-row-7000"]);
    await user.clear(screen.getByRole("searchbox", { name: "Search rotation" }));

    await user.click(screen.getByRole("button", { name: "Show 5 more" }));
    expect(shownOrder()).toHaveLength(55);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });

  it("renders a row title first, artist below, with its location as a pill naming bin and card", async () => {
    await renderShelf();

    const row = rowFor(5002);
    expect(row.getByText("Painless")).toBeInTheDocument();
    expect(row.getByText("Nilüfer Yanya")).toBeInTheDocument();
    expect(row.getByLabelText("Heavy rotation, card 1 “Late Aug”")).toBeInTheDocument();
    // Each row is a named target in its own right.
    expect(screen.getByTestId("rotation-admin-row-5002")).toHaveAttribute(
      "aria-label",
      "Painless — Nilüfer Yanya",
    );
  });

  it("renders an unlinked row from its snapshot fields, with no shelf code and nothing to open", async () => {
    const { user } = await renderShelf();

    const row = rowFor(5004);
    expect(row.getByText("Edits")).toBeInTheDocument();
    expect(row.getByText("Chuquimamani-Condori")).toBeInTheDocument();
    expect(row.getByLabelText("Medium rotation")).toBeInTheDocument();
    // The code columns are the library join's; an unlinked row has none.
    expect(row.queryByText(/[A-Z]{2} \d+\/\d+/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open: Edits" })).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByTestId("rotation-admin-row-5004"));
    const menu = within(await screen.findByRole("menu", { name: "Actions for Edits" }));
    expect(menu.queryByRole("menuitem", { name: /Open album/ })).not.toBeInTheDocument();

    await closeMenus(user);
    screen.getByTestId("rotation-admin-row-5004").focus();
    await user.keyboard("{Enter}");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens a catalogued row's album from its Open button, its context menu, and Enter on the row", async () => {
    const { user } = await renderShelf();

    await user.click(screen.getByRole("button", { name: "Open: Painless" }));
    expect(router.push).toHaveBeenLastCalledWith("/dashboard/album/9002");

    fireEvent.contextMenu(screen.getByTestId("rotation-admin-row-5001"));
    const menu = within(await screen.findByRole("menu", { name: `Actions for ${IHOMF_TITLE}` }));
    await user.click(menu.getByRole("menuitem", { name: /Open album/ }));
    expect(router.push).toHaveBeenLastCalledWith("/dashboard/album/9001");

    screen.getByTestId("rotation-admin-row-5003").focus();
    await user.keyboard("{Enter}");
    expect(router.push).toHaveBeenLastCalledWith("/dashboard/album/9003");
  });

  it("renders a row with no card or urls key the same as one carrying card: null and urls: [] — a backend older than the card join omits both keys", async () => {
    const chuquiMissingKeys: RotationListRow = { ...CHUQUI_UNLINKED };
    delete chuquiMissingKeys.card;
    delete chuquiMissingKeys.urls;
    await renderShelf([...ALL_ROWS.filter((row) => row !== CHUQUI_UNLINKED), chuquiMissingKeys]);

    const row = rowFor(5004);
    expect(row.getByLabelText("Medium rotation")).toBeInTheDocument();
    expect(row.queryByTestId("LinkIcon")).not.toBeInTheDocument();
  });

  it("shows a row's links as a labelled count, never as an anchor", async () => {
    await renderShelf();

    const row = screen.getByTestId("rotation-admin-row-5001");
    expect(
      within(row).getByLabelText("1 link: stereolab.bandcamp.com/album/instant-holograms-on-metal-film"),
    ).toHaveTextContent("1");
    // A pasted value carries no scheme guarantee, so it is never bound to an href.
    expect(row.querySelector("a[href]")).toBeNull();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("names each bin chip by its bin's full name and count", async () => {
    await renderShelf();

    expect(screen.getByRole("button", { name: "Heavy (2)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Medium (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light (0)" })).toBeInTheDocument();
  });

  it("announces the shown presentation's count in the status region, in the toggle's own words", async () => {
    const { user } = await renderShelf();
    expect(statusRegion()).toHaveTextContent("4 active records");

    await showRetired(user);

    expect(statusRegion()).toHaveTextContent("1 retired record");
  });

  it("names every per-row control after its release", async () => {
    await renderShelf();

    for (const name of [IHOMF_TITLE, "Painless", "Halo", "Edits"]) {
      expect(screen.getByRole("button", { name: `Move: ${name}` })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `Retire: ${name}` })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: /^Open: / })).toHaveLength(3);
  });

  describe("filters", () => {
    it("search narrows the rows and every bin count", async () => {
      const { user } = await renderShelf();

      await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "stereolab");

      expect(shownOrder()).toEqual(["rotation-admin-row-5001"]);
      expect(statusRegion()).toHaveTextContent("1 active record");
      expect(screen.getByRole("button", { name: "All 1" })).toBeInTheDocument();
      expect(binChip("Heavy (1)")).toBeInTheDocument();
      expect(binChip("Medium (0)")).toBeInTheDocument();
      // The status toggle keeps the unfiltered totals.
      expect(screen.getByRole("button", { name: "Active 4" })).toBeInTheDocument();

      await showRetired(user);
      expect(shownOrder()).toEqual(["rotation-admin-row-5005"]);
    });

    it("search folds diacritics", async () => {
      const { user } = await renderShelf();

      await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "nilufer");

      expect(shownOrder()).toEqual(["rotation-admin-row-5002"]);
    });

    it("search matches the shelf code", async () => {
      const { user } = await renderShelf();

      await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "SL 1/3");

      expect(shownOrder()).toEqual(["rotation-admin-row-5001"]);
      await showRetired(user);
      expect(shownOrder()).toEqual([]);
      expect(screen.getByText("Nothing on this shelf matches.")).toBeInTheDocument();
    });

    it("a search that matches nothing offers to clear every filter", async () => {
      const { user } = await renderShelf();

      await user.click(binChip("Heavy (2)"));
      await user.type(screen.getByRole("searchbox", { name: "Search rotation" }), "halo");

      expect(shownOrder()).toEqual([]);
      expect(screen.getByText("Nothing on this shelf matches.")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(screen.getByRole("searchbox", { name: "Search rotation" })).toHaveValue("");
      expect(screen.getByRole("button", { name: "All 4" })).toHaveAttribute("aria-pressed", "true");
      expect(shownOrder()).toHaveLength(4);
    });

    it("a bin chip narrows both presentations to that bin and toggles back off", async () => {
      const { user } = await renderShelf();

      const heavy = binChip("Heavy (2)");
      await user.click(heavy);

      expect(heavy).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "All 4" })).toHaveAttribute("aria-pressed", "false");
      expect(shownOrder()).toEqual(["rotation-admin-row-5002", "rotation-admin-row-5001"]);
      await showRetired(user);
      expect(shownOrder()).toEqual([]);
      await showActive(user);

      await user.click(binChip("Heavy (2)"));
      expect(screen.getByRole("button", { name: "All 4" })).toHaveAttribute("aria-pressed", "true");
      expect(shownOrder()).toHaveLength(4);
    });
  });

  describe("retire and restore", () => {
    it("retires and restores an unlinked row through the existing mutations, moving it between presentations", async () => {
      const { fake, user } = await renderShelf();

      await user.click(screen.getByRole("button", { name: "Retire: Edits" }));

      await waitFor(() => expect(screen.queryByTestId("rotation-admin-row-5004")).not.toBeInTheDocument());
      // The bodyless-path kill carries only the rotation id — the server
      // stamps the date itself.
      expect(fake.killBodies()).toEqual([{ rotation_id: 5004 }]);
      expect(toastMock).toHaveBeenCalledWith(
        "Retired Edits.",
        expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }),
      );
      expect(screen.getByRole("button", { name: "Active 3" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retired 2" })).toBeInTheDocument();

      await showRetired(user);
      await user.click(screen.getByRole("button", { name: "Restore: Edits" }));

      await waitFor(() => expect(screen.queryByTestId("rotation-admin-row-5004")).not.toBeInTheDocument());
      expect(fake.updateBodies()).toEqual([{ id: 5004, body: { kill_date: null } }]);
      expect(screen.getByRole("button", { name: "Active 4" })).toBeInTheDocument();
      await showActive(user);
      expect(screen.getByTestId("rotation-admin-row-5004")).toBeInTheDocument();
      // The rows moved through the endpoints' cache patches: the unbounded
      // status=all read was fetched exactly once, before either action.
      expect(fake.listStatuses()).toEqual(["all"]);
    });

    it("the retire toast's Undo restores the row", async () => {
      const { fake, user } = await renderShelf();

      await user.click(screen.getByRole("button", { name: "Retire: Painless" }));
      await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
      expect(toastMock.mock.calls[0][0]).toBe("Retired Painless.");

      const { action } = toastMock.mock.calls[0][1] as { action: { onClick: () => void } };
      act(() => action.onClick());

      await screen.findByTestId("rotation-admin-row-5002");
      expect(fake.killBodies()).toEqual([{ rotation_id: 5002 }]);
      expect(fake.updateBodies()).toEqual([{ id: 5002, body: { kill_date: null } }]);
      expect(screen.getByRole("button", { name: "Retired 1" })).toBeInTheDocument();
    });

    it("a failed retire offers no Undo and keeps the row active", async () => {
      const { user } = await renderShelf();
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/rotation`, () => HttpResponse.json({}, { status: 500 })),
      );

      await user.click(screen.getByRole("button", { name: "Retire: Painless" }));

      await waitFor(() => expect(screen.getByRole("button", { name: "Retire: Painless" })).toBeEnabled());
      expect(toastMock).not.toHaveBeenCalled();
      expect(screen.getByTestId("rotation-admin-row-5002")).toBeInTheDocument();
    });

    it("restores a catalogued retired row via kill_date: null", async () => {
      const { fake, user } = await renderShelf();
      await showRetired(user);

      await user.click(screen.getByRole("button", { name: "Restore: Dots and Loops" }));

      await waitFor(() => expect(screen.getByRole("button", { name: "Retired 0" })).toBeInTheDocument());
      expect(fake.updateBodies()).toEqual([{ id: 5005, body: { kill_date: null } }]);
      expect(screen.getByText("Nothing has been retired from rotation yet.")).toBeInTheDocument();
      await showActive(user);
      expect(screen.getByTestId("rotation-admin-row-5005")).toBeInTheDocument();
    });
  });

  describe("card moves", () => {
    it("offers only the row's own bin's cards, with the current card disabled", async () => {
      const { user } = await renderShelf();

      const menu = await openMoveMenu(user, IHOMF_TITLE);

      expect(
        await menu.findByRole("menuitem", { name: `Move to card 1 — Late Aug: ${IHOMF_TITLE}` }),
      ).not.toHaveAttribute("aria-disabled", "true");
      expect(menu.getByRole("menuitem", { name: `Move to card 2: ${IHOMF_TITLE}` })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(menu.queryByRole("menuitem", { name: /Fresh Arrivals/ })).not.toBeInTheDocument();
    });

    it("a card item PATCHes card_id alone and refreshes the cards read", async () => {
      const { fake, user } = await renderShelf();
      await waitFor(() => expect(fake.cardsRequests()).toBe(1));

      const menu = await openMoveMenu(user, IHOMF_TITLE);
      await user.click(
        await menu.findByRole("menuitem", { name: `Move to card 1 — Late Aug: ${IHOMF_TITLE}` }),
      );

      await waitFor(() => expect(fake.updateBodies()).toEqual([{ id: 5001, body: { card_id: 31 } }]));
      // The cards surface counts rows per card, so a card move refetches it.
      await waitFor(() => expect(fake.cardsRequests()).toBe(2));
      expect(
        await rowFor(5001).findByLabelText("Heavy rotation, card 1 “Late Aug”"),
      ).toBeInTheDocument();
      // The row's new card came from the endpoint's cache patch, not from
      // refetching the unbounded status=all read.
      expect(fake.listStatuses()).toEqual(["all"]);
    });
  });

  describe("bin moves", () => {
    it("offers every bin but the row's own", async () => {
      const { user } = await renderShelf();

      const menu = await openMoveMenu(user, IHOMF_TITLE);

      expect(menu.getByRole("menuitem", { name: `Move to Heavy: ${IHOMF_TITLE}` })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      for (const label of ["Medium", "Light"]) {
        expect(
          menu.getByRole("menuitem", { name: `Move to ${label}: ${IHOMF_TITLE}` }),
        ).not.toHaveAttribute("aria-disabled", "true");
      }
    });

    it("moves a catalogued row add-first: the add lands before the retire, with no card_id", async () => {
      const { fake, user } = await renderShelf();

      await moveToBin(user, IHOMF_TITLE, "Medium");

      // The add names the library release, the target bin, and the row's
      // stored links — the retire half kills the only row that holds them,
      // so an add without `urls` would be a move that destroys the record's
      // curated links. Still no card_id: an omitted card is the server's cue
      // to file on the target bin's newest card, and the retire is the same
      // bodyless-path kill the Retire button issues.
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
      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."));

      // The replacement is a new active row in the target bin, landed on the
      // bin's newest card (the fake mirrors the server's defaulting); the
      // old entry moves to the retired presentation.
      const movedRow = within(await screen.findByTestId("rotation-admin-row-5006"));
      expect(movedRow.getByLabelText("Medium rotation, card 2 “Fresh Arrivals”")).toBeInTheDocument();
      expect(screen.queryByTestId("rotation-admin-row-5001")).not.toBeInTheDocument();

      // The move lock releases once the post-move refetch lands: the new
      // row's own bin items are live again.
      await waitFor(() => expect(shelfTable()).toHaveAttribute("aria-busy", "false"));
      const menu = await openMoveMenu(user, IHOMF_TITLE);
      expect(menu.getByRole("menuitem", { name: `Move to Heavy: ${IHOMF_TITLE}` })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await closeMenus(user);

      await showRetired(user);
      expect(screen.getByTestId("rotation-admin-row-5001")).toBeInTheDocument();
    });

    it("focuses the menu's first enabled item when the Move button opens it", async () => {
      const { user } = await renderShelf();

      await openMoveMenu(user, IHOMF_TITLE);

      // Heavy is the row's own bin, so the first enabled item is Medium.
      await waitFor(() =>
        expect(screen.getByRole("menuitem", { name: `Move to Medium: ${IHOMF_TITLE}` })).toHaveFocus(),
      );
    });

    it("closes the menu on Escape and hands focus back to the Move button", async () => {
      const { user } = await renderShelf();

      await openMoveMenu(user, IHOMF_TITLE);
      await waitFor(() => expect(screen.getByRole("menu").contains(document.activeElement)).toBe(true));

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: `Move: ${IHOMF_TITLE}` })).toHaveFocus();
    });

    it("reaches the same move from the row's context menu", async () => {
      const { fake, user } = await renderShelf();

      fireEvent.contextMenu(screen.getByTestId("rotation-admin-row-5002"));
      const menu = within(await screen.findByRole("menu", { name: "Actions for Painless" }));
      await user.click(menu.getByRole("menuitem", { name: "Move to Light: Painless" }));

      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Light rotation."));
      expect(fake.callOrder()).toEqual(["add", "kill"]);
    });

    it("locks every row's bin items while the list refetches after a move", async () => {
      const { user } = await renderShelf();
      const hold = holdNextListReads();

      await moveToBin(user, IHOMF_TITLE, "Medium");
      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."));
      await waitFor(() => expect(hold.held()).toBeGreaterThan(0));

      // Every row still reads its old bin until that refetch lands, so a
      // second move now would file a second active entry.
      const menu = await openMoveMenu(user, "Painless");
      for (const label of ["Heavy", "Medium", "Light"]) {
        expect(menu.getByRole("menuitem", { name: `Move to ${label}: Painless` })).toHaveAttribute(
          "aria-disabled",
          "true",
        );
      }
      // Card items are a within-bin field edit, not an add, and stay live.
      expect(menu.getByRole("menuitem", { name: "Move to card 2: Painless" })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await closeMenus(user);

      await act(async () => {
        hold.release();
      });
      await waitFor(() => expect(shelfTable()).toHaveAttribute("aria-busy", "false"));

      const released = await openMoveMenu(user, "Painless");
      expect(released.getByRole("menuitem", { name: "Move to Light: Painless" })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("releases the row after a failed add — nothing changed, so nothing stays locked", async () => {
      const { fake, user } = await renderShelf();
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/rotation`, () => HttpResponse.json({}, { status: 500 })),
      );

      await moveToBin(user, IHOMF_TITLE, "Medium");

      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith("Couldn't move this release to Medium — nothing changed."),
      );
      // Add-first means the failed add attempted no retire; the failed add
      // triggers no refetch, so a lock that only ever released on refetch
      // completion would wedge the row here.
      expect(fake.killBodies()).toEqual([]);
      await waitFor(() => expect(screen.getByRole("button", { name: `Move: ${IHOMF_TITLE}` })).toBeEnabled());
      const menu = await openMoveMenu(user, IHOMF_TITLE);
      expect(menu.getByRole("menuitem", { name: `Move to Medium: ${IHOMF_TITLE}` })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("releases the move lock even when the post-move refetch itself fails", async () => {
      const { user } = await renderShelf();
      // Both writes succeed; only the invalidation-driven list refetch
      // errors, so the last-good rows stay on screen and the lock must
      // still come back for them.
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "boom" }, { status: 500 }),
        ),
      );

      await moveToBin(user, IHOMF_TITLE, "Medium");

      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."));
      await waitFor(() => expect(shelfTable()).toHaveAttribute("aria-busy", "false"));
      // The failed refetch never renders as an outage over last-good rows.
      expect(screen.queryByText("Could not load the rotation list.")).not.toBeInTheDocument();
      const menu = await openMoveMenu(user, "Painless");
      expect(menu.getByRole("menuitem", { name: "Move to Medium: Painless" })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("keeps the new-bin record when the retire half fails, leaving a visible duplicate", async () => {
      const { fake, user } = await renderShelf();
      // Only the bodyless-path kill fails; the add (POST) and the list read
      // keep answering, so the safety property is observable end-to-end.
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/rotation`, () => HttpResponse.json({}, { status: 500 })),
      );

      await moveToBin(user, IHOMF_TITLE, "Medium");

      // The record still exists in the new bin — the failure mode is a
      // duplicate to clean up, never a lost record.
      await screen.findByTestId("rotation-admin-row-5006");
      // And the old entry is still active alongside it, with its own Retire.
      expect(rowFor(5001).getByRole("button", { name: `Retire: ${IHOMF_TITLE}` })).toBeInTheDocument();
      expect(fake.addBodies()).toHaveLength(1);
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith(
          "Filed in Medium, but couldn't retire the Heavy entry — retire it from the shelf.",
        ),
      );
    });

    it("moves an unlinked row through the free-text mutation with its whole snapshot carried", async () => {
      // The pre-catalog FKs live only on the single-row read (the list row's
      // label_id is the library join's, null here by construction), so the
      // move must fetch them; the urls ride on the list row itself.
      const { fake, user } = await renderShelf(
        [
          ...ALL_ROWS.filter((row) => row !== CHUQUI_UNLINKED),
          { ...CHUQUI_UNLINKED, urls: ["chuquimamani.bandcamp.com/album/edits"] },
        ],
        CARDS,
        { rowSummaries: { 5004: { format_id: 7, label_id: 42 } } },
      );

      await moveToBin(user, "Edits", "Light");

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
            moved_from_rotation_id: 5004,
          },
        ]),
      );
      // The server retires the source in the add's own transaction, so the
      // client sends no kill for it.
      const movedRow = within(await screen.findByTestId("rotation-admin-row-5006"));
      expect(movedRow.getByText("Chuquimamani-Condori")).toBeInTheDocument();
      expect(movedRow.getByLabelText("Light rotation, card 1")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByTestId("rotation-admin-row-5004")).not.toBeInTheDocument());
      expect(fake.killBodies()).toEqual([]);
      expect(fake.callOrder()).toEqual(["add"]);

      await showRetired(user);
      expect(screen.getByTestId("rotation-admin-row-5004")).toBeInTheDocument();
    });

    it("fails closed on an unlinked row without the snapshot a move would re-file", async () => {
      const untitled = listRow({ ...CHUQUI_UNLINKED, album_title: null });
      const { fake, user } = await renderShelf([untitled]);

      const menu = await openMoveMenu(user, "Chuquimamani-Condori");

      for (const label of ["Heavy", "Light", "Medium"]) {
        expect(
          menu.getByRole("menuitem", { name: `Move to ${label}: Chuquimamani-Condori` }),
        ).toHaveAttribute("aria-disabled", "true");
      }
      expect(fake.addBodies()).toEqual([]);
    });

    describe("a refused unlinked move", () => {
      const APPROVED_LINE =
        "This entry can't be moved here. It may already be linked to a release, it may have been taken out of rotation or moved already, or it may have been added after reviews moved into the DJ site. Reload the list to see where it stands now.";
      const SERVER_MESSAGES = [
        "This rotation entry can't be moved to another bin this way. It is already linked to a release, or it was added after reviews moved into the DJ site.",
        "This rotation entry was taken out of rotation, linked, or moved before the move could save. Nothing was changed; reload to see where it stands.",
      ];

      it.each(SERVER_MESSAGES)(
        "shows the screen's own line, never the server's message, and refetches the list: %s",
        async (message) => {
          const { fake, user } = await renderShelf();
          const listReads = fake.listRequests();
          server.use(
            http.post(`${TEST_BACKEND_URL}/library/rotation`, () =>
              HttpResponse.json({ message, reason: "rotation_not_eligible" }, { status: 409 }),
            ),
          );

          await moveToBin(user, "Edits", "Light");

          await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
          expect(toastErrorMock.mock.calls[0][0]).toBe(APPROVED_LINE);
          expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain(message);
          expect(screen.queryByText(message)).not.toBeInTheDocument();
          await waitFor(() => expect(fake.listRequests()).toBeGreaterThan(listReads));
          expect(fake.killBodies()).toEqual([]);
        },
      );
    });

    it("refuses an unlinked move when the single-row read fails — nothing changed", async () => {
      // The read exists to feed the write, so it fails closed: proceeding
      // without it would re-file the release with its pre-catalog fields
      // silently dropped.
      const { fake, user } = await renderShelf();
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation/5004`, () =>
          HttpResponse.json({ error: "boom" }, { status: 500 }),
        ),
      );

      await moveToBin(user, "Edits", "Light");

      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith("Couldn't move this release to Light — nothing changed."),
      );
      expect(fake.addBodies()).toEqual([]);
      expect(fake.killBodies()).toEqual([]);
      expect(screen.getByTestId("rotation-admin-row-5004")).toBeInTheDocument();
    });

    describe("an album already active in the target bin", () => {
      // Album 9001 is in the duplicate state: active in H and M at once.
      // Moving the H row to M must consolidate, not stack a second active M
      // row every DISTINCT ON consumer collapses to one.
      const IHOMF_M_DUP: FakeRotationAdminRow = {
        ...IHOMF,
        rotation_id: 5007,
        rotation_bin: "M",
        rotation_add_date: "2026-08-20",
        card: null,
      };

      it("also retires that row — never an invisible in-bin duplicate", async () => {
        const { fake, user } = await renderShelf([...ALL_ROWS, IHOMF_M_DUP]);

        // The title is on both duplicate rows; the H row's Move is the first.
        await user.click(screen.getAllByRole("button", { name: `Move: ${IHOMF_TITLE}` })[0]);
        const menu = within(await screen.findByRole("menu", { name: `Actions for ${IHOMF_TITLE}` }));
        await user.click(menu.getByRole("menuitem", { name: `Move to Medium: ${IHOMF_TITLE}` }));

        await waitFor(() =>
          expect(fake.killBodies()).toEqual([{ rotation_id: 5001 }, { rotation_id: 5007 }]),
        );
        expect(fake.callOrder()).toEqual(["add", "kill", "kill"]);
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."));
      });

      it("names the leftover prior entries, not the source bin, when retiring the duplicate fails", async () => {
        const { user } = await renderShelf([...ALL_ROWS, IHOMF_M_DUP]);
        server.use(
          http.patch(`${TEST_BACKEND_URL}/library/rotation`, async ({ request }) => {
            const body = (await request.clone().json()) as { rotation_id: number };
            if (body.rotation_id === 5007) return HttpResponse.json({}, { status: 500 });
            return undefined;
          }),
        );

        await user.click(screen.getAllByRole("button", { name: `Move: ${IHOMF_TITLE}` })[0]);
        const menu = within(await screen.findByRole("menu", { name: `Actions for ${IHOMF_TITLE}` }));
        await user.click(menu.getByRole("menuitem", { name: `Move to Medium: ${IHOMF_TITLE}` }));

        await waitFor(() =>
          expect(toastErrorMock).toHaveBeenCalledWith(
            "Filed in Medium, but couldn't retire every prior entry — retire them from the shelf.",
          ),
        );
      });
    });

    it("clears the per-album catalog rotation claim once the move settles", async () => {
      // The add's cache handler writes a rotation claim for the album into
      // the catalog slice; bounded to the gesture it protects the new bin
      // from the retire half's clear, but left behind it would make a later
      // out-of-band kill of the album's real entry skip its catalog clear
      // for the life of the tab.
      const { user, store } = await renderShelf();

      await moveToBin(user, IHOMF_TITLE, "Medium");

      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."));
      await waitFor(() =>
        expect(catalogSlice.selectors.getAlbumRotation(store.getState(), 9001)).toBeUndefined(),
      );
    });

    it("offers no move on retired rows — their bin is a fact, not an affordance", async () => {
      const { user } = await renderShelf();
      await showRetired(user);

      expect(screen.queryByRole("button", { name: "Move: Dots and Loops" })).not.toBeInTheDocument();
      fireEvent.contextMenu(screen.getByTestId("rotation-admin-row-5005"));
      const menu = within(await screen.findByRole("menu", { name: "Actions for Dots and Loops" }));
      expect(menu.queryByRole("menuitem", { name: /^Move to / })).not.toBeInTheDocument();
      expect(menu.getByRole("menuitem", { name: /Restore to rotation/ })).toBeInTheDocument();
      expect(rowFor(5005).getByLabelText("Medium rotation, card 1")).toBeInTheDocument();
    });
  });

  describe("rotation age", () => {
    // Pinned on its own rather than riding on `renderShelf`'s default: these
    // figures (104 days, 44 over, 3 days, 1 day) are derived from this exact
    // instant, so a future change to the default must not silently move them.
    const AGE_NOW = new Date("2026-09-13T12:00:00Z");

    const OVERDUE = listRow({
      rotation_id: 6001,
      id: 9005,
      artist_name: "Cat Power",
      album_title: "Sun",
      rotation_add_date: "2026-06-01",
    });
    const FRESH = listRow({
      rotation_id: 6002,
      id: 9006,
      artist_name: "Jessica Pratt",
      album_title: "On Your Own Love Again",
      rotation_add_date: "2026-09-10",
    });

    it("renders the over chip and counts it, alongside a fresh row that gets neither", async () => {
      await renderShelf([OVERDUE, FRESH], CARDS, undefined, AGE_NOW);

      const overdueRow = rowFor(6001);
      expect(overdueRow.getByLabelText("Added 06/01/26 · 104 days in Heavy")).toHaveTextContent("104 d");
      expect(overdueRow.getByText("44 over")).toBeInTheDocument();
      expect(screen.getByTestId("rotation-admin-overdue-count")).toHaveTextContent("Overdue 1");
      expect(binStrip("Heavy").getByText("2 · 1 overdue")).toBeInTheDocument();

      const freshRow = rowFor(6002);
      expect(freshRow.getByLabelText("Added 09/10/26 · 3 days in Heavy")).toHaveTextContent("3 d");
      expect(freshRow.queryByText(/over$/)).not.toBeInTheDocument();
    });

    it("singularizes the age text for a one-day-old row", async () => {
      const oneDayOld = listRow({
        rotation_id: 6004,
        id: 9007,
        artist_name: "Chuquimamani-Condori",
        album_title: "Edits",
        rotation_add_date: "2026-09-12",
      });
      await renderShelf([oneDayOld], CARDS, undefined, AGE_NOW);

      expect(rowFor(6004).getByLabelText("Added 09/12/26 · 1 day in Heavy")).toHaveTextContent("1 d");
    });

    it("renders a retired row's date with no age, chip, or count contribution even past its window", async () => {
      const killedOverdue = { ...OVERDUE, rotation_id: 6003, rotation_kill_date: "2026-09-01" };
      const { user } = await renderShelf([killedOverdue], CARDS, undefined, AGE_NOW);
      await showRetired(user);

      const row = rowFor(6003);
      expect(row.getByText("retired 09/01/26")).toBeInTheDocument();
      expect(row.queryByLabelText(/days in/)).not.toBeInTheDocument();
      expect(row.queryByText(/over$/)).not.toBeInTheDocument();
      expect(screen.getByTestId("rotation-admin-overdue-count")).toHaveTextContent("Overdue 0");
    });

    it("omits the age clause entirely for a future-dated add, rather than a negative day count", async () => {
      const futureDated = listRow({
        rotation_id: 6011,
        id: 9014,
        artist_name: "Jessica Pratt",
        album_title: "On Your Own Love Again",
        rotation_add_date: "2026-09-14",
      });
      await renderShelf([futureDated], CARDS, undefined, AGE_NOW);

      const row = rowFor(6011);
      expect(row.getByLabelText("Added 09/14/26")).toHaveTextContent("—");
      expect(row.queryByLabelText(/days in/)).not.toBeInTheDocument();
      expect(row.queryByText(/over$/)).not.toBeInTheDocument();
    });

    describe("under a bin filter", () => {
      const overdueH = listRow({
        rotation_id: 6015,
        id: 9018,
        artist_name: "Cat Power",
        album_title: "Sun",
        rotation_add_date: "2026-06-01",
      });
      const overdueM = listRow({
        rotation_id: 6016,
        id: 9019,
        artist_name: "Stereolab",
        album_title: "Dots and Loops",
        rotation_bin: "M",
        rotation_add_date: "2026-06-01",
      });
      const freshH = listRow({
        rotation_id: 6017,
        id: 9020,
        artist_name: "Jessica Pratt",
        album_title: "On Your Own Love Again",
        rotation_add_date: "2026-09-10",
      });
      const freshL = listRow({
        rotation_id: 6014,
        id: 9017,
        artist_name: "Juana Molina",
        album_title: "DOGA",
        rotation_bin: "L",
        rotation_add_date: "2026-09-10",
      });

      it("keeps the overdue chip list-wide while the bin strip counts only what the filter shows", async () => {
        const { user } = await renderShelf([overdueH, overdueM, freshH, freshL], CARDS, undefined, AGE_NOW);

        await user.click(binChip("Heavy (2)"));

        expect(screen.getByTestId("rotation-admin-overdue-count")).toHaveTextContent("Overdue 2");
        expect(binStrip("Heavy").getByText("2 · 1 overdue")).toBeInTheDocument();
      });

      it("strips a bin holding none of the list's overdue rows with no overdue count", async () => {
        const { user } = await renderShelf([overdueH, overdueM, freshH, freshL], CARDS, undefined, AGE_NOW);

        await user.click(binChip("Light (1)"));

        expect(screen.getByTestId("rotation-admin-overdue-count")).toHaveTextContent("Overdue 2");
        expect(binStrip("Light").getByText("1")).toBeInTheDocument();
        expect(binStrip("Light").queryByText(/overdue/)).not.toBeInTheDocument();
      });

      it("the overdue chip narrows to overdue rows, composes with the bin filter, and toggles back off", async () => {
        const { user } = await renderShelf([overdueH, overdueM, freshH, freshL], CARDS, undefined, AGE_NOW);

        const chip = within(screen.getByTestId("rotation-admin-overdue-count")).getByRole("button");
        await user.click(chip);

        expect(chip).toHaveAttribute("aria-pressed", "true");
        expect(shownOrder()).toEqual(["rotation-admin-row-6015", "rotation-admin-row-6016"]);

        await user.click(binChip("Heavy (2)"));
        expect(shownOrder()).toEqual(["rotation-admin-row-6015"]);

        await user.click(binChip("Light (1)"));
        expect(shownOrder()).toEqual([]);
        expect(screen.getByText("Nothing on this shelf matches.")).toBeInTheDocument();

        await user.click(chip);
        expect(chip).toHaveAttribute("aria-pressed", "false");
        expect(shownOrder()).toEqual(["rotation-admin-row-6014"]);
      });
    });
  });

  describe("rotation windows", () => {
    const AGE_NOW = new Date("2026-09-13T12:00:00Z");
    // 40 days in Heavy and 50 in Medium at AGE_NOW: past a 30-day Heavy
    // window, inside a 60-day Medium one.
    const HEAVY_40 = listRow({
      rotation_id: 6101,
      id: 9101,
      artist_name: "Cat Power",
      album_title: "Sun",
      rotation_bin: "H",
      rotation_add_date: "2026-08-04",
    });
    const MEDIUM_50 = listRow({
      rotation_id: 6102,
      id: 9102,
      artist_name: "Jessica Pratt",
      album_title: "On Your Own Love Again",
      rotation_bin: "M",
      rotation_add_date: "2026-07-25",
    });
    // 10 days in Heavy: the same bin as HEAVY_40, so the two order against
    // each other inside one bin group.
    const HEAVY_10 = listRow({
      rotation_id: 6104,
      id: 9104,
      artist_name: "Juana Molina",
      album_title: "DOGA",
      rotation_bin: "H",
      rotation_add_date: "2026-09-03",
    });

    // 70 days in Light: past the 60-day window any fallback default would
    // supply, so a chip on it can only come from marking against a guess.
    const LIGHT_70 = listRow({
      rotation_id: 6103,
      id: 9103,
      artist_name: "Stereolab",
      album_title: "Aluminum Tunes",
      rotation_bin: "L",
      rotation_add_date: "2026-07-05",
    });

    it("marks a row against its own bin's window from the thresholds read", async () => {
      await renderShelf([HEAVY_40, MEDIUM_50], CARDS, { windowDays: { H: 30 } }, AGE_NOW);

      expect(rowFor(6101).getByText("10 over")).toBeInTheDocument();
      expect(rowFor(6102).queryByText(/over$/)).not.toBeInTheDocument();
      expect(screen.getByTestId("rotation-admin-overdue-count")).toHaveTextContent("Overdue 1");
    });

    it("follows a window changed and saved elsewhere, through the tag invalidation", async () => {
      const { store } = await renderShelf([HEAVY_40, MEDIUM_50], CARDS, undefined, AGE_NOW);
      expect(screen.getByTestId("rotation-admin-overdue-count")).toHaveTextContent("Overdue 0");

      await act(async () => {
        await store.dispatch(rotationApi.endpoints.updateRotationThresholds.initiate({ window_days: { H: 30 } }));
      });

      await waitFor(() =>
        expect(screen.getByTestId("rotation-admin-overdue-count")).toHaveTextContent("Overdue 1"),
      );
      expect(rowFor(6101).getByText("10 over")).toBeInTheDocument();
    });

    it("renders ages with no chips and no overdue filter when the read fails, and keeps the list", async () => {
      const fake = fakeRotationAdminEndpoints([HEAVY_40, MEDIUM_50, LIGHT_70], CARDS, { windowDays: { H: 30 } });
      fake.failThresholdsReads();
      await renderShelfFor(fake, AGE_NOW);

      const row = rowFor(6101);
      expect(row.getByLabelText("Added 08/04/26 · 40 days in Heavy")).toBeInTheDocument();
      expect(row.queryByText(/over$/)).not.toBeInTheDocument();
      expect(rowFor(6103).queryByText(/over$/)).not.toBeInTheDocument();
      expect(binStrip("Heavy").queryByText(/overdue/)).not.toBeInTheDocument();
      expect(screen.queryByTestId("rotation-admin-overdue-count")).not.toBeInTheDocument();
      expect(screen.queryByText("Could not load the rotation list.")).not.toBeInTheDocument();
    });

    it("renders a pending read like a failed one, then marks once it lands", async () => {
      const fake = fakeRotationAdminEndpoints([HEAVY_40, MEDIUM_50, LIGHT_70], CARDS, { windowDays: { H: 30 } });
      fake.holdThresholdsReads();
      const { user } = renderWithProviders(<RotationShelf now={AGE_NOW} />);
      await screen.findByTestId("rotation-admin-row-6101");

      const row = rowFor(6101);
      expect(row.getByLabelText("Added 08/04/26 · 40 days in Heavy")).toBeInTheDocument();
      expect(row.queryByText(/over$/)).not.toBeInTheDocument();
      expect(screen.queryByTestId("rotation-admin-overdue-count")).not.toBeInTheDocument();
      expect(rowFor(6103).queryByText(/over$/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("combobox", { name: "Sort rotation" }));
      expect(await screen.findByRole("option", { name: "Oldest first" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Most overdue" })).not.toBeInTheDocument();
      await closeMenus(user);

      await act(async () => {
        await fake.releaseThresholdsReads();
      });

      expect(await row.findByText("10 over")).toBeInTheDocument();
      expect(rowFor(6103).getByText("10 over")).toBeInTheDocument();
      expect(screen.getByTestId("rotation-admin-overdue-count")).toHaveTextContent("Overdue 2");
    });

    it("offers Most overdue and orders each bin by the day its window ends", async () => {
      const { user } = await renderShelf([HEAVY_10, HEAVY_40], CARDS, { windowDays: { H: 30 } }, AGE_NOW);

      await chooseSort(user, "Newest first");
      await waitFor(() => expect(shownOrder()).toEqual(["rotation-admin-row-6104", "rotation-admin-row-6101"]));

      await chooseSort(user, "Most overdue");
      await waitFor(() => expect(shownOrder()).toEqual(["rotation-admin-row-6101", "rotation-admin-row-6104"]));
      expect(screen.getByRole("combobox", { name: "Sort rotation" })).toHaveTextContent("Most overdue");
    });

    it("withholds Most overdue while the windows are unknown", async () => {
      const fake = fakeRotationAdminEndpoints([HEAVY_40, MEDIUM_50], CARDS);
      fake.failThresholdsReads();
      const { user } = await renderShelfFor(fake, AGE_NOW);

      await user.click(screen.getByRole("combobox", { name: "Sort rotation" }));

      expect(await screen.findByRole("option", { name: "Oldest first" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Most overdue" })).not.toBeInTheDocument();
    });

    it("falls back to oldest-first when the read fails under a selected Most overdue", async () => {
      const { user, fake, store } = await renderShelf([HEAVY_10, HEAVY_40], CARDS, { windowDays: { H: 30 } }, AGE_NOW);
      await chooseSort(user, "Most overdue");
      await waitFor(() => expect(shownOrder()).toEqual(["rotation-admin-row-6101", "rotation-admin-row-6104"]));

      fake.failThresholdsReads();
      await act(async () => {
        store.dispatch(rotationApi.util.invalidateTags(["RotationThresholds"]));
      });

      await waitFor(() =>
        expect(screen.getByRole("combobox", { name: "Sort rotation" })).toHaveTextContent("Oldest first"),
      );
      expect(shownOrder()).toEqual(["rotation-admin-row-6101", "rotation-admin-row-6104"]);
      expect(screen.queryByTestId("rotation-admin-overdue-count")).not.toBeInTheDocument();
    });
  });

  describe("default clock", () => {
    // Only `Date` is faked -- MSW and userEvent's own `setTimeout` delays
    // keep running on the real clock, which this userEvent-heavy spec needs.
    it("re-reads its clock from the list refetch, so a bin move stamped after UTC midnight never reads a negative age", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-12T23:50:00Z"));
      onTestFinished(() => {
        vi.useRealTimers();
      });
      // Proves the Date fake is in force before trusting anything the row renders.
      expect(new Date().toISOString()).toBe("2026-09-12T23:50:00.000Z");

      const movingRow = listRow({
        rotation_id: 7001,
        id: 9101,
        artist_name: "Hermanos Gutiérrez",
        album_title: "El Bueno y el Malo",
        rotation_bin: "H",
        rotation_add_date: "2026-08-20",
        card: { id: 32, bin: "H", number: 2, name: null },
      });
      const fake = fakeRotationAdminEndpoints([movingRow], CARDS, { addDate: "2026-09-13" });

      // No `now`: this is the default-clock path the other cases in this
      // file bypass by passing their own fixed instant.
      const { user } = await renderShelfFor(fake);
      await screen.findByTestId("rotation-admin-row-7001");

      // 19:50 EDT to 20:10 EDT, an ordinary 20 minutes at the station -- but
      // the UTC calendar day has turned over underneath it.
      vi.setSystemTime(new Date("2026-09-13T00:10:00Z"));

      await moveToBin(user, "El Bueno y el Malo", "Medium");
      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Moved to Medium rotation."));

      // The fake stamps the move with addDate, "2026-09-13" -- the UTC day
      // this spec sets after the mount, not the UTC day the test happens to
      // run on. A clock still holding the pre-midnight day would read the
      // new row as -1 days old instead of 0.
      const movedRow = within(await screen.findByTestId("rotation-admin-row-7002"));
      expect(
        await movedRow.findByLabelText("Added 09/13/26 · 0 days in Medium"),
      ).toHaveTextContent("0 d");
    });

    // `shouldAdvanceTime` keeps every faked timer (including the hook's own
    // interval) running near real wall-clock pace, which is what lets MSW's
    // fetch and `findByTestId` resolve normally here -- `toFake: ["Date"]`
    // alone (the case above) can't be used for this one, because the clock
    // has to tick forward on its own for the row's age to roll at all.
    it("advances a row's age across UTC midnight on its own, with no refetch", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-09-12T23:58:00Z") });
      onTestFinished(() => {
        vi.useRealTimers();
      });

      const tickingRow = listRow({
        rotation_id: 7101,
        id: 9201,
        artist_name: "Hermanos Gutiérrez",
        album_title: "Sonido Cósmico",
        rotation_bin: "H",
        rotation_add_date: "2026-09-10",
      });
      const fake = fakeRotationAdminEndpoints([tickingRow], CARDS);

      renderWithProviders(<RotationShelf />);
      await screen.findByTestId("rotation-admin-row-7101");

      expect(rowFor(7101).getByLabelText("Added 09/10/26 · 2 days in Heavy")).toBeInTheDocument();

      // Three of the hook's own 60-second ticks, well past the UTC midnight
      // that falls two minutes after mount -- no refetch, no new `now` prop.
      act(() => {
        vi.advanceTimersByTime(3 * 60_000);
      });

      expect(rowFor(7101).getByLabelText("Added 09/10/26 · 3 days in Heavy")).toBeInTheDocument();
      // A refetch mid-advance would re-anchor `fulfilledTimeStamp` and could
      // pass the assertions above for the wrong reason -- pin the read count
      // so the advance is provably the clock ticking on its own.
      expect(fake.listStatuses()).toEqual(["all"]);
    });
  });

  it("shows skeleton rows and announces loading until the list lands", async () => {
    fakeRotationAdminEndpoints(ALL_ROWS, CARDS);
    const hold = holdNextListReads();
    renderWithProviders(<RotationShelf now={DEFAULT_NOW} />);

    await waitFor(() => expect(hold.held()).toBe(1));
    expect(statusRegion()).toHaveTextContent("Loading rotation");
    expect(shelfTable()).toHaveAttribute("aria-busy", "true");
    expect(shownOrder()).toEqual([]);
    expect(screen.queryByText("The rotation shelf is empty.")).not.toBeInTheDocument();

    await act(async () => {
      hold.release();
    });

    await screen.findByTestId("rotation-admin-row-5001");
    expect(statusRegion()).toHaveTextContent("4 active records");
  });

  it("tells an empty shelf apart from a filtered one, and offers to file a record", async () => {
    const { user } = await renderShelf([]);

    expect(screen.getByText("The rotation shelf is empty.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "File a record into rotation" }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/admin/rotation/new");
  });

  it("renders an outage as a retryable failure, never as an empty list", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation`, () => HttpResponse.json({ error: "boom" }, { status: 500 })),
      http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/library/rotation/thresholds`, () =>
        HttpResponse.json({ window_days: { H: 60, M: 60, L: 60, S: 60 }, card_stale_days: 30 }),
      ),
    );
    renderWithProviders(<RotationShelf />);

    expect(await screen.findByText("Could not load the rotation list.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Rotation shelf" })).not.toBeInTheDocument();
    expect(screen.queryByText("The rotation shelf is empty.")).not.toBeInTheDocument();
  });
});
