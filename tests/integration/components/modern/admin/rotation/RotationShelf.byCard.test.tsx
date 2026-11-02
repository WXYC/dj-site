import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  server,
  TEST_BACKEND_URL,
  fakeRotationAdminEndpoints,
  fakeRotationCardsEndpoints,
  type FakeRotationCard,
} from "@/tests/helpers";
import { rotationApi } from "@/lib/features/rotation/api";
import { RotationBin, type RotationListRow } from "@/lib/features/rotation/types";
import { createTestRotationListRow } from "@/tests/fixtures/fixtures";

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

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => args, {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  }),
}));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router, {
    pathname: "/dashboard/admin/rotation",
    search: () => "view=cards",
  });
});

import RotationShelf from "@/src/components/experiences/modern/admin/rotation/shelf/RotationShelf";

type RotationCardRef = NonNullable<RotationListRow["card"]>;

// Fixed on both sides: the shelf's ages are differenced against `NOW`, and the
// fake's active/killed split against `TODAY`.
const NOW = new Date("2026-09-20T12:00:00Z");
const TODAY = "2026-09-20";

const CARDS: FakeRotationCard[] = [
  { id: 31, bin: "H", number: 1, name: "Late Aug", active_count: 3 },
  { id: 32, bin: "H", number: 2, name: null, active_count: 0 },
  { id: 21, bin: "M", number: 1, name: null, active_count: 2 },
  { id: 22, bin: "M", number: 2, name: "Fresh Arrivals", active_count: 1 },
];

const card = (id: number) => within(screen.getByTestId(`rotation-card-${id}`));
const shelfRow = (rotationId: number) => screen.queryByTestId(`rotation-admin-row-${rotationId}`);

/** The rotation ids of the record rows filed under a card's header, in order. */
function rowsUnderCard(cardId: number): number[] {
  const header = screen.getByTestId(`rotation-card-${cardId}`);
  const ids: number[] = [];
  for (let el = header.nextElementSibling; el && !el.classList.contains("card-header"); el = el.nextElementSibling) {
    const id = el.getAttribute("data-testid")?.match(/^rotation-admin-row-(\d+)$/)?.[1];
    if (id) ids.push(Number(id));
  }
  return ids;
}

async function openCardMenu(user: ReturnType<typeof renderWithProviders>["user"], cardName: string) {
  await user.click(screen.getByRole("button", { name: `More for ${cardName}` }));
  return screen.findByRole("menu", { name: `Actions for ${cardName}` });
}

// The admin fake serves the list, thresholds, and cards reads; the cards fake
// laid over it owns the cards read and its CRUD, with the counts fixed above.
async function renderCards(cards = CARDS) {
  fakeRotationAdminEndpoints([], [], { today: TODAY });
  const fake = fakeRotationCardsEndpoints(cards);
  const rendered = renderWithProviders(<RotationShelf now={NOW} />);
  await screen.findByTestId("rotation-card-31");
  return { fake, ...rendered };
}

describe("RotationShelf by card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("card headers", () => {
    it("groups every bin's cards under its strip, with names, counts, and an add affordance", async () => {
      await renderCards();

      expect(screen.getByRole("columnheader", { name: /Heavy · 2 cards/ })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /Medium · 2 cards/ })).toBeInTheDocument();
      expect(card(31).getByText("Late Aug")).toBeInTheDocument();
      expect(card(32).getByText("Unnamed")).toBeInTheDocument();
      expect(card(31).getByText("3 active")).toBeInTheDocument();
      // The number rides in a decorative circle; the card's spoken name lives
      // on its controls' labels instead.
      expect(card(31).getByText("1")).toHaveAttribute("aria-hidden", "true");
      expect(card(31).getByRole("button", { name: "Rename Heavy 1" })).toBeInTheDocument();

      // A bin with no cards still renders its strip and its add affordance.
      expect(screen.getByRole("columnheader", { name: /Singles · 0 cards/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add a card to Singles" })).toBeInTheDocument();
    });

    it("dates each card by its newest add or retirement, and marks one idle past the stale threshold", async () => {
      const HEAVY_1 = { id: 31, bin: RotationBin.H, number: 1, name: null };
      const HEAVY_2 = { id: 32, bin: RotationBin.H, number: 2, name: null };
      const HEAVY_3 = { id: 33, bin: RotationBin.H, number: 3, name: null };
      fakeRotationAdminEndpoints(
        [
          createTestRotationListRow({
            id: 6001,
            rotation_id: 6001,
            card: HEAVY_1,
            artist_name: "Juana Molina",
            album_title: "DOGA",
            rotation_add_date: "2026-09-05",
          }),
          // Added long ago but retired recently: the retirement is the work.
          createTestRotationListRow({
            id: 6002,
            rotation_id: 6002,
            card: HEAVY_2,
            artist_name: "Jessica Pratt",
            album_title: "On Your Own Love Again",
            rotation_add_date: "2026-06-01",
            rotation_kill_date: "2026-09-10",
          }),
          createTestRotationListRow({
            id: 6003,
            rotation_id: 6003,
            card: HEAVY_3,
            artist_name: "Stereolab",
            album_title: "Dots and Loops",
            rotation_add_date: "2026-08-01",
          }),
        ],
        [HEAVY_1, HEAVY_2, HEAVY_3, { id: 34, bin: "H", number: 4, name: null }],
        { today: TODAY },
      );
      renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId("rotation-card-34");

      await waitFor(() => expect(card(31).getByText("touched 15 d ago")).toBeInTheDocument());
      expect(card(32).getByText("touched 10 d ago")).toBeInTheDocument();
      expect(card(34).getByText("never touched")).toBeInTheDocument();
      // card_stale_days is 30: only Heavy 3, idle 50 days, carries the marker.
      await waitFor(() => expect(card(33).getByText("touched 50 d ago")).toBeInTheDocument());
      expect(card(33).getByTestId("TimerOutlinedIcon")).toBeInTheDocument();
      for (const id of [31, 32, 34]) {
        expect(card(id).queryByTestId("TimerOutlinedIcon")).not.toBeInTheDocument();
      }
    });
  });

  describe("renaming a card", () => {
    it("opens on demand, renames on blur, and round-trips the server's name", async () => {
      const { fake, user } = await renderCards();
      expect(screen.queryByLabelText("Name for Heavy 2")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Rename Heavy 2" }));
      const input = screen.getByLabelText("Name for Heavy 2");
      expect(input).toHaveFocus();
      expect(input).toHaveValue("");
      await user.type(input, "Early Sep");
      await user.tab();

      await waitFor(() =>
        expect(fake.renameBodies()).toEqual([{ id: 32, body: { name: "Early Sep" } }]),
      );
      await waitFor(() => expect(card(32).getByText("Early Sep")).toBeInTheDocument());
      expect(screen.queryByLabelText("Name for Heavy 2")).not.toBeInTheDocument();
    });

    it("trims the name and commits on Enter", async () => {
      const { fake, user } = await renderCards();

      await user.click(screen.getByRole("button", { name: "Rename Heavy 2" }));
      await user.type(screen.getByLabelText("Name for Heavy 2"), "  Early Sep  {Enter}");

      await waitFor(() =>
        expect(fake.renameBodies()).toEqual([{ id: 32, body: { name: "Early Sep" } }]),
      );
    });

    it("clears a name as null and never PATCHes an unchanged one", async () => {
      const { fake, user } = await renderCards();

      // Opened and left with no edit: no write.
      await user.click(screen.getByRole("button", { name: "Rename Heavy 1" }));
      expect(screen.getByLabelText("Name for Heavy 1")).toHaveValue("Late Aug");
      await user.tab();
      expect(fake.renameBodies()).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Rename Heavy 1" }));
      await user.clear(screen.getByLabelText("Name for Heavy 1"));
      await user.keyboard("{Enter}");

      await waitFor(() => expect(fake.renameBodies()).toEqual([{ id: 31, body: { name: null } }]));
      await waitFor(() => expect(card(31).getByText("Unnamed")).toBeInTheDocument());
    });

    it("cancels on Escape with no write", async () => {
      const { fake, user } = await renderCards();

      await user.click(screen.getByRole("button", { name: "Rename Heavy 1" }));
      await user.type(screen.getByLabelText("Name for Heavy 1"), " draft{Escape}");

      expect(screen.queryByLabelText("Name for Heavy 1")).not.toBeInTheDocument();
      expect(card(31).getByText("Late Aug")).toBeInTheDocument();
      expect(fake.renameBodies()).toEqual([]);
    });

    it("opens from a double-click on the name and from the card's menu", async () => {
      const { user } = await renderCards();

      await user.dblClick(card(31).getByText("Late Aug"));
      expect(screen.getByLabelText("Name for Heavy 1")).toHaveFocus();
      await user.keyboard("{Escape}");

      const menu = await openCardMenu(user, "Medium 2");
      await user.click(within(menu).getByRole("menuitem", { name: /Rename/ }));
      expect(screen.getByLabelText("Name for Medium 2")).toHaveValue("Fresh Arrivals");
    });

    it("locks the card's controls while its rename is in flight, and no other card's", async () => {
      const { user } = await renderCards();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/rotation/cards/:id`, async () => {
          await gate;
          return HttpResponse.json({ id: 32, bin: "H", number: 2, name: "Early Sep" });
        }),
      );

      await user.click(screen.getByRole("button", { name: "Rename Heavy 2" }));
      await user.type(screen.getByLabelText("Name for Heavy 2"), "Early Sep");
      await user.tab();

      const assign = screen.getByRole("button", { name: "Assign records: Heavy 2" });
      await waitFor(() => expect(assign).toBeDisabled());
      expect(screen.getByRole("button", { name: "Rename Heavy 2" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Assign records: Heavy 1" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Rename Heavy 1" })).toBeEnabled();

      release();
      await waitFor(() => expect(assign).toBeEnabled());
    });
  });

  describe("adding a card", () => {
    it("adds a card with no locally computed number and reports the server's", async () => {
      const { fake, user } = await renderCards();

      await user.click(screen.getByRole("button", { name: "Add a card to Heavy" }));

      // The request names only the bin — the number is the server's to assign.
      await waitFor(() => expect(fake.addBodies()).toEqual([{ bin: "H" }]));
      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Added Heavy 3."));
      // The new card renders from the refetched cards read, not from local math.
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Rename Heavy 3" })).toBeInTheDocument(),
      );
      expect(screen.getByRole("columnheader", { name: /Heavy · 3 cards/ })).toBeInTheDocument();
    });

    it("locks every bin's Add card affordance while a create is in flight", async () => {
      const { user } = await renderCards();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let posts = 0;
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/rotation/cards`, async () => {
          posts += 1;
          await gate;
          return HttpResponse.json({ id: 99, bin: "H", number: 3, name: null }, { status: 201 });
        }),
      );

      const addToHeavy = screen.getByRole("button", { name: "Add a card to Heavy" });
      await user.click(addToHeavy);

      // A second accepted click would file a phantom card the physical bin
      // doesn't have — and every omitted-card_id rotation add then lands on
      // it. Every bin waits, not just the clicked one: the toast echoes the
      // server's number assignment, which concurrent creates race.
      await waitFor(() => expect(addToHeavy).toBeDisabled());
      expect(screen.getByRole("button", { name: "Add a card to Medium" })).toBeDisabled();

      release();
      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Added Heavy 3."));
      await waitFor(() => expect(addToHeavy).toBeEnabled());
      expect(posts).toBe(1);
    });
  });

  describe("deleting a card", () => {
    it("enables delete only for a bin's last, empty card", async () => {
      const { fake, user } = await renderCards();

      // Highest-numbered but occupied (Medium 2), and lower-numbered (Heavy 1,
      // Medium 1) — the one deletable card is Heavy 2: highest in its bin
      // with zero active rows.
      for (const name of ["Heavy 1", "Medium 1", "Medium 2"]) {
        const menu = await openCardMenu(user, name);
        const item = within(menu).getByRole("menuitem", { name: `Delete: ${name}` });
        expect(item).toHaveAttribute("aria-disabled", "true");
        expect(item).toHaveTextContent("Only a bin's last card can be deleted");
        await user.click(document.body);
        await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
      }

      const menu = await openCardMenu(user, "Heavy 2");
      const deletable = within(menu).getByRole("menuitem", { name: "Delete: Heavy 2" });
      expect(deletable).not.toHaveAttribute("aria-disabled", "true");
      expect(deletable).not.toHaveTextContent("Only a bin's last card");

      await user.click(deletable);

      await waitFor(() => expect(fake.deletedIds()).toEqual([32]));
      await waitFor(() => expect(screen.queryByTestId("rotation-card-32")).not.toBeInTheDocument());
    });

    it("never offers delete on a bin's only card, even empty", async () => {
      const { user } = await renderCards([{ id: 41, bin: "L", number: 1, name: null, active_count: 0 }, ...CARDS]);

      const menu = await openCardMenu(user, "Light 1");
      expect(within(menu).getByRole("menuitem", { name: "Delete: Light 1" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("renders the guard 409's typed reason when the race backstop fires", async () => {
      const { user } = await renderCards();
      // Another MD filed a release onto the card between this render and the
      // click — the UI still shows the delete enabled, and the server refuses.
      server.use(
        http.delete(`${TEST_BACKEND_URL}/library/rotation/cards/:id`, () =>
          HttpResponse.json(
            { message: "Cannot delete", reason: "card_has_active_rotations" },
            { status: 409 },
          ),
        ),
      );

      const menu = await openCardMenu(user, "Heavy 2");
      await user.click(within(menu).getByRole("menuitem", { name: "Delete: Heavy 2" }));

      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith(
          "This card still has active rotation releases filed on it — move or retire them first.",
        ),
      );
      // The card stays: the refusal removed nothing.
      expect(screen.getByTestId("rotation-card-32")).toBeInTheDocument();
    });
  });

  it("moves focus into a card's menu, and Escape hands it back to the menu button", async () => {
    const { user } = await renderCards();
    const menu = await openCardMenu(user, "Heavy 1");

    expect(within(menu).getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "More for Heavy 1" })).toHaveFocus();
  });

  it("renders a cards outage as a retryable failure", async () => {
    fakeRotationAdminEndpoints([], [], { today: TODAY });
    let failures = 1;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () => {
        if (failures === 0) return HttpResponse.json(CARDS);
        failures -= 1;
        return HttpResponse.json({ error: "boom" }, { status: 500 });
      }),
    );
    const { user } = renderWithProviders(<RotationShelf now={NOW} />);

    expect(await screen.findByText("Could not load the rotation cards.")).toBeInTheDocument();
    expect(screen.queryByTestId("rotation-card-31")).not.toBeInTheDocument();
    // An outage is never drawn as bins with no cards, and nothing can be added against it.
    expect(screen.queryByText(/· 0 cards/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add a card to/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("rotation-card-31")).toBeInTheDocument();
    expect(screen.queryByText("Could not load the rotation cards.")).not.toBeInTheDocument();
  });

  describe("the records under each card", () => {
    const HEAVY_1 = { id: 31, bin: RotationBin.H, number: 1, name: "Late Aug" };
    const HEAVY_2 = { id: 32, bin: RotationBin.H, number: 2, name: null };
    const MEDIUM_1 = { id: 21, bin: RotationBin.M, number: 1, name: null };
    const onCard = (
      card: RotationCardRef | null,
      rotationId: number,
      artistName: string,
      albumTitle: string,
      bin: RotationBin = card?.bin ?? RotationBin.H,
    ) =>
      createTestRotationListRow({
        id: rotationId,
        rotation_id: rotationId,
        rotation_bin: bin,
        card,
        artist_name: artistName,
        album_title: albumTitle,
      });

    it("files each active record under its own card, and a bin's cardless records under No card", async () => {
      fakeRotationAdminEndpoints(
        [
          onCard(HEAVY_1, 5101, "Juana Molina", "DOGA"),
          onCard(HEAVY_1, 5102, "Jessica Pratt", "On Your Own Love Again"),
          onCard(HEAVY_2, 5103, "Chuquimamani-Condori", "Edits"),
          onCard(MEDIUM_1, 5104, "Stereolab", "Dots and Loops"),
          onCard(null, 5105, "Cat Power", "Moon Pix"),
          // Retired rows stay in the full read but never on a card's list.
          { ...onCard(HEAVY_2, 5106, "Duke Ellington & John Coltrane", "Duke Ellington & John Coltrane"), rotation_kill_date: "2026-09-01" },
        ],
        [HEAVY_1, HEAVY_2, MEDIUM_1],
        { today: TODAY },
      );
      renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId("rotation-card-31");

      await waitFor(() => expect(rowsUnderCard(31).sort()).toEqual([5101, 5102]));
      expect(rowsUnderCard(32)).toEqual([5103]);
      expect(rowsUnderCard(21)).toEqual([5104]);
      expect(shelfRow(5106)).not.toBeInTheDocument();

      const noCard = screen.getByRole("columnheader", { name: "No card" });
      expect(noCard.closest("tr")?.nextElementSibling).toBe(shelfRow(5105));
      // Only Heavy has a cardless record, so only Heavy shows the header.
      expect(screen.getAllByRole("columnheader", { name: "No card" })).toHaveLength(1);
    });

    it("says a card is empty only when its count also says so", async () => {
      // The list read's dedup can hide a card's only active row -- a newer
      // row for the same release sits on a sibling card in the bin -- so an
      // empty list and a positive count both describe one card at once.
      fakeRotationAdminEndpoints([], [], { today: TODAY });
      fakeRotationCardsEndpoints([
        { ...HEAVY_1, active_count: 0 },
        { ...HEAVY_2, active_count: 1 },
      ]);
      renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId("rotation-card-32");

      const emptyLine = (cardId: number) =>
        screen.getByTestId(`rotation-card-${cardId}`).nextElementSibling?.textContent;
      expect(emptyLine(31)).toBe("Nothing on this card yet.");
      expect(emptyLine(32)).not.toBe("Nothing on this card yet.");
      expect(rowsUnderCard(32)).toEqual([]);
    });

    it("moves a record from one card's group to another once the panel's save lands", async () => {
      fakeRotationAdminEndpoints(
        [
          onCard(HEAVY_1, 5801, "Juana Molina", "DOGA"),
          onCard(HEAVY_1, 5802, "Stereolab", "Dots and Loops"),
        ],
        [HEAVY_1, HEAVY_2],
        { today: TODAY },
      );
      const { user } = renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId("rotation-card-31");
      await waitFor(() => expect(rowsUnderCard(31).sort()).toEqual([5801, 5802]));
      expect(rowsUnderCard(32)).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 2" }));
      const panel = within(await screen.findByRole("dialog", { name: "Heavy 2" }));
      await user.click(await panel.findByRole("checkbox", { name: "Stereolab — Dots and Loops" }));
      await user.click(panel.getByRole("button", { name: "Save 1" }));
      await waitFor(() => expect(panel.getByText("On Heavy 2 now · 1")).toBeInTheDocument());

      // The shelf sits behind the open dialog, which MUI hides from the
      // accessibility tree while it's open.
      await user.click(panel.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await waitFor(() => expect(rowsUnderCard(32)).toEqual([5802]));
      expect(rowsUnderCard(31)).toEqual([5801]);
      expect(card(32).getByText("1 active")).toBeInTheDocument();
      expect(card(31).getByText("1 active")).toBeInTheDocument();
    });
  });

  // The panel reads the rotation list and a save moves rows between cards, so
  // these run on the admin fake alone: it serves the cards read too, with
  // each card's count derived from the rows a save has moved.
  describe("assigning records to a card", () => {
    const HEAVY_1 = { id: 31, bin: RotationBin.H, number: 1, name: "Late Aug" };
    const HEAVY_2 = { id: 32, bin: RotationBin.H, number: 2, name: null };
    const MEDIUM_1 = { id: 21, bin: RotationBin.M, number: 1, name: null };
    const ADMIN_ROWS = [
      createTestRotationListRow({
        id: 5001,
        rotation_id: 5001,
        rotation_bin: RotationBin.H,
        card: HEAVY_1,
        artist_name: "Juana Molina",
        album_title: "DOGA",
      }),
      createTestRotationListRow({
        id: 5002,
        rotation_id: 5002,
        rotation_bin: RotationBin.H,
        card: HEAVY_1,
        artist_name: "Jessica Pratt",
        album_title: "On Your Own Love Again",
      }),
      createTestRotationListRow({
        id: 5003,
        rotation_id: 5003,
        rotation_bin: RotationBin.H,
        card: HEAVY_1,
        artist_name: "Chuquimamani-Condori",
        album_title: "Edits",
      }),
      createTestRotationListRow({
        id: 5004,
        rotation_id: 5004,
        rotation_bin: RotationBin.M,
        card: MEDIUM_1,
        artist_name: "Stereolab",
        album_title: "Dots and Loops",
      }),
    ];
    const activeCount = (cardId: number) => card(cardId).getByText(/ active$/).textContent;

    async function renderCardsWithRecords() {
      const fake = fakeRotationAdminEndpoints(ADMIN_ROWS, [HEAVY_1, HEAVY_2, MEDIUM_1], { today: TODAY });
      const rendered = renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId("rotation-card-31");
      return { fake, ...rendered };
    }

    it("gives every card an Assign records control named the way MDs name the card", async () => {
      await renderCardsWithRecords();

      for (const name of ["Heavy 1", "Heavy 2", "Medium 1"]) {
        expect(screen.getByRole("button", { name: `Assign records: ${name}` })).toBeEnabled();
      }
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens the panel on the card whose control was used, and closes it", async () => {
      const { user } = await renderCardsWithRecords();

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 2" }));

      const panel = within(await screen.findByRole("dialog", { name: "Heavy 2" }));
      expect(await panel.findByText("On Heavy 2 now · 0")).toBeInTheDocument();
      expect(panel.getByText("Elsewhere in Heavy · 3")).toBeInTheDocument();
      expect(panel.queryByText(/Stereolab/)).not.toBeInTheDocument();

      await user.click(panel.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("refetches the cards read once for a save, and the cards' counts follow the moves", async () => {
      const { fake, user } = await renderCardsWithRecords();
      expect(activeCount(31)).toBe("3 active");
      expect(activeCount(32)).toBe("0 active");
      expect(fake.cardsRequests()).toBe(1);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 2" }));
      const panel = within(await screen.findByRole("dialog", { name: "Heavy 2" }));
      await user.click(await panel.findByRole("checkbox", { name: "Juana Molina — DOGA" }));
      await user.click(panel.getByRole("checkbox", { name: "Chuquimamani-Condori — Edits" }));
      await user.click(panel.getByRole("button", { name: "Save 2" }));

      await waitFor(() => expect(activeCount(32)).toBe("2 active"));
      expect(activeCount(31)).toBe("1 active");
      expect(await panel.findByText("On Heavy 2 now · 2")).toBeInTheDocument();
      expect(fake.updateBodies()).toEqual([
        { id: 5001, body: { card_id: 32 } },
        { id: 5003, body: { card_id: 32 } },
      ]);
      // Two rows moved: one refetch of the cards for the save, not one per row.
      expect(fake.cardsRequests()).toBe(2);
    });

    it("closes the panel when its card is no longer in the cards list", async () => {
      const { store, user } = await renderCardsWithRecords();
      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 2" }));
      await screen.findByRole("dialog", { name: "Heavy 2" });

      // Someone else deleted Heavy 2: the next cards read comes back without it.
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () =>
          HttpResponse.json([
            { ...HEAVY_1, active_count: 3 },
            { ...MEDIUM_1, active_count: 1 },
          ]),
        ),
      );
      await act(async () => {
        await store.dispatch(
          rotationApi.endpoints.getRotationCards.initiate(undefined, { forceRefetch: true }),
        );
      });

      await waitFor(() => expect(screen.queryByTestId("rotation-card-32")).not.toBeInTheDocument());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Save & open the next card", () => {
    const PILE_CARD = { id: 11, bin: RotationBin.H, number: 1, name: null };
    const OPEN_CARD = { id: 13, bin: "H", number: 3, name: null };
    const NEXT_CARD = { id: 14, bin: "H", number: 4, name: null };
    const PILE_ROW = createTestRotationListRow({
      id: 7001,
      rotation_id: 7001,
      rotation_bin: RotationBin.H,
      card: PILE_CARD,
      artist_name: "Juana Molina",
      album_title: "DOGA",
    });
    // Stays on Heavy 1 through the whole walk -- a positive control proving
    // the filter still finds a genuine card-1 row once the refetch lands,
    // not just that it stops finding the one that moved.
    const STILL_ON_PILE_ROW = createTestRotationListRow({
      id: 7002,
      rotation_id: 7002,
      rotation_bin: RotationBin.H,
      card: PILE_CARD,
      artist_name: "Stereolab",
      album_title: "Dots and Loops",
    });

    it("holds the just-moved record under the 'Still on Heavy 1' filter, locked, until the refetch lands -- then drops it", async () => {
      const fake = fakeRotationAdminEndpoints(
        [PILE_ROW, STILL_ON_PILE_ROW],
        [PILE_CARD, OPEN_CARD, NEXT_CARD],
        { today: TODAY },
      );
      const { user } = renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId(`rotation-card-${OPEN_CARD.id}`);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 3" }));
      const openPanel = within(await screen.findByRole("dialog", { name: "Heavy 3" }));
      await user.click(await openPanel.findByRole("checkbox", { name: "Juana Molina — DOGA" }));

      // Held before the walk's save, so its own refetch -- the one the
      // next card's panel subscribes to on mount -- lands into the hold.
      fake.holdActiveListReads();
      await user.click(openPanel.getByRole("button", { name: "Save & open Heavy 4" }));

      const nextPanel = within(await screen.findByRole("dialog", { name: "Heavy 4" }));
      await user.click(nextPanel.getByRole("checkbox", { name: "Still on Heavy 1" }));

      // The remount dropped the row's own lock along with its tick, so what
      // keeps it from being ticked again here is the panel lock: the stale
      // list still shows it on Heavy 1, so the filter still offers it, and
      // it renders disabled.
      const staleRow = nextPanel.getByRole("checkbox", { name: "Juana Molina — DOGA" });
      expect(staleRow).toBeDisabled();
      expect(staleRow).not.toBeChecked();
      expect(nextPanel.getByRole("button", { name: "Save" })).toBeDisabled();

      await act(() => fake.releaseActiveListReads());

      await waitFor(() =>
        expect(
          nextPanel.queryByRole("checkbox", { name: "Juana Molina — DOGA" }),
        ).not.toBeInTheDocument(),
      );
      expect(
        nextPanel.getByRole("checkbox", { name: "Stereolab — Dots and Loops" }),
      ).toBeInTheDocument();

      // Off the filter, the moved record's own line confirms where it landed.
      await user.click(nextPanel.getByRole("checkbox", { name: "Still on Heavy 1" }));
      expect(
        nextPanel.getByRole("checkbox", { name: "Juana Molina — DOGA" }),
      ).toHaveAccessibleDescription("Heavy 3");
    });

    it("carries the 'Still on Heavy 1' toggle through Save & open, and resets it on close and on a fresh Assign records", async () => {
      fakeRotationAdminEndpoints([PILE_ROW], [PILE_CARD, OPEN_CARD, NEXT_CARD], { today: TODAY });
      const { user } = renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId(`rotation-card-${OPEN_CARD.id}`);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 3" }));
      const openPanel = within(await screen.findByRole("dialog", { name: "Heavy 3" }));
      await user.click(await openPanel.findByRole("checkbox", { name: "Still on Heavy 1" }));
      await user.click(openPanel.getByRole("checkbox", { name: "Juana Molina — DOGA" }));

      await user.click(openPanel.getByRole("button", { name: "Save & open Heavy 4" }));

      const nextPanel = within(await screen.findByRole("dialog", { name: "Heavy 4" }));
      expect(await nextPanel.findByRole("checkbox", { name: "Still on Heavy 1" })).toBeChecked();

      await user.click(nextPanel.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 3" }));
      const reopened = within(await screen.findByRole("dialog", { name: "Heavy 3" }));
      expect(await reopened.findByRole("checkbox", { name: "Still on Heavy 1" })).not.toBeChecked();
    });

    it("carries the 'Still on Heavy 1' toggle through the Open step too, not only Save & open", async () => {
      fakeRotationAdminEndpoints([PILE_ROW], [PILE_CARD, OPEN_CARD, NEXT_CARD], { today: TODAY });
      const { user } = renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId(`rotation-card-${OPEN_CARD.id}`);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 3" }));
      const openPanel = within(await screen.findByRole("dialog", { name: "Heavy 3" }));
      await user.click(await openPanel.findByRole("checkbox", { name: "Still on Heavy 1" }));

      await user.click(openPanel.getByRole("button", { name: "Open Heavy 4" }));

      const nextPanel = within(await screen.findByRole("dialog", { name: "Heavy 4" }));
      expect(await nextPanel.findByRole("checkbox", { name: "Still on Heavy 1" })).toBeChecked();
    });

    it("advances via the Open step with nothing ticked, sending no writes", async () => {
      const fake = fakeRotationAdminEndpoints([PILE_ROW], [PILE_CARD, OPEN_CARD, NEXT_CARD], { today: TODAY });
      const { user } = renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId(`rotation-card-${OPEN_CARD.id}`);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 3" }));
      const openPanel = within(await screen.findByRole("dialog", { name: "Heavy 3" }));
      await openPanel.findByText(/On Heavy 3 now/);

      await user.click(openPanel.getByRole("button", { name: "Open Heavy 4" }));

      await screen.findByRole("dialog", { name: "Heavy 4" });
      expect(fake.updateBodies()).toEqual([]);
    });

    it("opens the bin's last card with no walk step, and never hands a card another bin's", async () => {
      const HEAVY_1 = { id: 31, bin: "H", number: 1, name: null };
      const HEAVY_2 = { id: 32, bin: "H", number: 2, name: null };
      const MEDIUM_1 = { id: 21, bin: "M", number: 1, name: null };
      const MEDIUM_2 = { id: 22, bin: "M", number: 2, name: null };
      // Heavy's last card sits between two Medium cards in the cards read's
      // own order -- a next-card derivation that trusted that order instead
      // of grouping per bin would hand Heavy 2 a Medium sibling as "next".
      fakeRotationAdminEndpoints([], [HEAVY_1, MEDIUM_1, HEAVY_2, MEDIUM_2], { today: TODAY });
      const { user } = renderWithProviders(<RotationShelf now={NOW} />);
      await screen.findByTestId("rotation-card-32");

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 1" }));
      const firstPanel = within(await screen.findByRole("dialog", { name: "Heavy 1" }));
      await firstPanel.findByText(/On Heavy 1 now/);
      // Nothing is ticked, so the walk step is the no-op "Open" form.
      expect(firstPanel.getByRole("button", { name: "Open Heavy 2" })).toBeInTheDocument();
      await user.click(firstPanel.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 2" }));
      const lastPanel = within(await screen.findByRole("dialog", { name: "Heavy 2" }));
      await lastPanel.findByText(/On Heavy 2 now/);
      expect(
        lastPanel.queryAllByRole("button", { name: /^(Open|Save & open) / }),
      ).toHaveLength(0);
    });
  });
});
