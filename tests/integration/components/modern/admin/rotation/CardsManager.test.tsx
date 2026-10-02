import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  server,
  TEST_BACKEND_URL,
  fakeRotationAdminEndpoints,
  fakeRotationCardsEndpoints,
  type FakeRotationAdminRow,
  type FakeRotationCard,
} from "@/tests/helpers";
import { rotationApi } from "@/lib/features/rotation/api";

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
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import CardsManager from "@/src/components/experiences/modern/admin/rotation/CardsManager";

const CARDS: FakeRotationCard[] = [
  { id: 31, bin: "H", number: 1, name: "Late Aug", active_count: 3 },
  { id: 32, bin: "H", number: 2, name: null, active_count: 0 },
  { id: 21, bin: "M", number: 1, name: null, active_count: 2 },
  { id: 22, bin: "M", number: 2, name: "Fresh Arrivals", active_count: 1 },
];

const heavyColumn = () => within(screen.getByTestId("rotation-cards-bin-H"));

async function renderCards(cards = CARDS) {
  const fake = fakeRotationCardsEndpoints(cards);
  const rendered = renderWithProviders(<CardsManager />);
  await screen.findByTestId("rotation-cards-bin-H");
  return { fake, ...rendered };
}

describe("CardsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders every bin as a column with its cards, names, and active counts", async () => {
    await renderCards();
    await heavyColumn().findByTestId("rotation-card-31");

    expect(screen.getByRole("heading", { name: /Heavy/ })).toHaveTextContent("H · 2 cards");
    expect(heavyColumn().getByLabelText("Name for Heavy card 1")).toHaveValue("Late Aug");
    // The number rides in a decorative circle; the accessible "card 1" reading
    // stays on the name input's label above, so the badge is aria-hidden.
    const badge = within(screen.getByTestId("rotation-card-31")).getByText("1");
    expect(badge).toHaveAttribute("aria-hidden", "true");
    expect(within(screen.getByTestId("rotation-card-31")).getByText("3 active")).toBeInTheDocument();
    // A bin with no cards still renders its column and its add affordance.
    const singles = within(screen.getByTestId("rotation-cards-bin-S"));
    expect(singles.getByText(/0 cards/)).toBeInTheDocument();
    expect(singles.getByRole("button", { name: "Add a card to Singles" })).toBeInTheDocument();
  });

  it("renames a card on blur and round-trips the server's name", async () => {
    const { fake, user } = await renderCards();
    const input = await heavyColumn().findByLabelText("Name for Heavy card 2");

    await user.click(input);
    await user.type(input, "Early Sep");
    await user.tab();

    await waitFor(() =>
      expect(fake.renameBodies()).toEqual([{ id: 32, body: { name: "Early Sep" } }]),
    );
    await waitFor(() =>
      expect(heavyColumn().getByLabelText("Name for Heavy card 2")).toHaveValue("Early Sep"),
    );
  });

  it("clears a name as null and never PATCHes an unchanged one", async () => {
    const { fake, user } = await renderCards();
    const named = await heavyColumn().findByLabelText("Name for Heavy card 1");

    // Blur with no edit: no write.
    await user.click(named);
    await user.tab();
    expect(fake.renameBodies()).toEqual([]);

    await user.clear(named);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(fake.renameBodies()).toEqual([{ id: 31, body: { name: null } }]));
  });

  it("adds a card with no locally computed number and reports the server's", async () => {
    const { fake, user } = await renderCards();
    await heavyColumn().findByTestId("rotation-card-31");

    await user.click(heavyColumn().getByRole("button", { name: "Add a card to Heavy" }));

    // The request names only the bin — the number is the server's to assign.
    await waitFor(() => expect(fake.addBodies()).toEqual([{ bin: "H" }]));
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Added card 3 to Heavy."),
    );
    // The new card renders from the refetched list, not from local math.
    await waitFor(() =>
      expect(heavyColumn().getByLabelText("Name for Heavy card 3")).toBeInTheDocument(),
    );
  });

  it("locks every Add card affordance while a create is in flight", async () => {
    const { user } = await renderCards();
    await heavyColumn().findByTestId("rotation-card-31");
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

    const addToHeavy = heavyColumn().getByRole("button", { name: "Add a card to Heavy" });
    await user.click(addToHeavy);

    // A second accepted click would file a phantom card the physical bin
    // doesn't have — and every omitted-card_id rotation add then lands on
    // it. Every bin's affordance waits, not just the clicked one: the toast
    // echoes the server's number assignment, which concurrent creates race.
    await waitFor(() => expect(addToHeavy).toBeDisabled());
    expect(
      within(screen.getByTestId("rotation-cards-bin-M")).getByRole("button", {
        name: "Add a card to Medium",
      }),
    ).toBeDisabled();

    release();
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Added card 3 to Heavy."));
    await waitFor(() => expect(addToHeavy).toBeEnabled());
    expect(posts).toBe(1);
  });

  it("locks a card's Assign records control while that card's rename is in flight", async () => {
    const { user } = await renderCards();
    const input = await heavyColumn().findByLabelText("Name for Heavy card 2");
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

    await user.click(input);
    await user.type(input, "Early Sep");
    await user.tab();

    // The card is mid-write: like its name and its delete, the way into its
    // records waits. A card nobody is writing to stays open.
    const assign = screen.getByRole("button", { name: "Assign records: Heavy 2" });
    await waitFor(() => expect(assign).toBeDisabled());
    expect(screen.getByRole("button", { name: "Assign records: Heavy 1" })).toBeEnabled();

    release();
    await waitFor(() => expect(assign).toBeEnabled());
  });

  it("enables delete only for a bin's last, empty card", async () => {
    const { fake, user } = await renderCards();
    await heavyColumn().findByTestId("rotation-card-31");

    // Highest-numbered but occupied (M card 2), and lower-numbered but empty
    // (H card 1 is occupied; M card 1 occupied) — the one deletable card is
    // H card 2: highest in its bin with zero active rows.
    expect(screen.getByRole("button", { name: "Delete: Heavy card 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete: Medium card 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete: Medium card 2" })).toBeDisabled();
    const deletable = screen.getByRole("button", { name: "Delete: Heavy card 2" });
    expect(deletable).toBeEnabled();

    await user.click(deletable);

    await waitFor(() => expect(fake.deletedIds()).toEqual([32]));
    await waitFor(() =>
      expect(screen.queryByTestId("rotation-card-32")).not.toBeInTheDocument(),
    );
  });

  it("renders the guard 409's typed reason when the race backstop fires", async () => {
    const { user } = await renderCards();
    await heavyColumn().findByTestId("rotation-card-31");
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

    await user.click(screen.getByRole("button", { name: "Delete: Heavy card 2" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "This card still has active rotation releases filed on it — move or kill them first.",
      ),
    );
    // The card stays: the refusal removed nothing.
    expect(screen.getByTestId("rotation-card-32")).toBeInTheDocument();
  });

  it("renders an outage as a retryable failure, never as an empty grid", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<CardsManager />);

    expect(await screen.findByText("Could not load the rotation cards.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByTestId("rotation-cards-bin-H")).not.toBeInTheDocument();
  });

  // The panel reads the rotation list and a save moves rows between cards, so
  // these run on the admin fake alone: it serves the cards read too, with
  // each card's count derived from the rows a save has moved.
  describe("assigning records to a card", () => {
    const HEAVY_1 = { id: 31, bin: "H", number: 1, name: "Late Aug" };
    const HEAVY_2 = { id: 32, bin: "H", number: 2, name: null };
    const MEDIUM_1 = { id: 21, bin: "M", number: 1, name: null };
    const ADMIN_ROWS: FakeRotationAdminRow[] = (
      [
        [5001, "H", HEAVY_1, "Juana Molina", "DOGA"],
        [5002, "H", HEAVY_1, "Jessica Pratt", "On Your Own Love Again"],
        [5003, "H", HEAVY_1, "Chuquimamani-Condori", "Edits"],
        [5004, "M", MEDIUM_1, "Stereolab", "Dots and Loops"],
      ] as const
    ).map(([rotation_id, rotation_bin, card, artist_name, album_title]) => ({
      id: rotation_id,
      rotation_id,
      rotation_bin,
      rotation_kill_date: null,
      card,
      artist_name,
      album_title,
    }));
    const activeCount = (cardId: number) =>
      within(screen.getByTestId(`rotation-card-${cardId}`)).getByText(/ active$/).textContent;

    async function renderCardsWithRecords() {
      const fake = fakeRotationAdminEndpoints(ADMIN_ROWS, [HEAVY_1, HEAVY_2, MEDIUM_1]);
      const rendered = renderWithProviders(<CardsManager />);
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
      // Two rows moved, and every read the save owed has landed: one
      // refetch of the cards for the save, not one per row.
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
});
