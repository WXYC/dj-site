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

// Serves no list read, so the default empty `status=active` answer applies:
// the cases here do not cover the records each card lists, so a card whose
// active_count is 0 shows "Nothing on this card yet." beside its count.
async function renderCards(cards = CARDS) {
  const fake = fakeRotationCardsEndpoints(cards);
  const rendered = renderWithProviders(<CardsManager />);
  await screen.findByTestId("rotation-cards-bin-H");
  return { fake, ...rendered };
}

type RotationCardRef = NonNullable<RotationListRow["card"]>;

describe("CardsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders every bin as a column with its cards, names, and active counts", async () => {
    await renderCards();
    await heavyColumn().findByTestId("rotation-card-31");

    expect(screen.getByRole("heading", { name: /Heavy/ })).toHaveTextContent("H · 2 cards");
    expect(heavyColumn().getByLabelText("Name for Heavy 1")).toHaveValue("Late Aug");
    // The number rides in a decorative circle; the accessible "Name for Heavy 1"
    // reading stays on the name input's label above, so the badge is aria-hidden.
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
    const input = await heavyColumn().findByLabelText("Name for Heavy 2");

    await user.click(input);
    await user.type(input, "Early Sep");
    await user.tab();

    await waitFor(() =>
      expect(fake.renameBodies()).toEqual([{ id: 32, body: { name: "Early Sep" } }]),
    );
    await waitFor(() =>
      expect(heavyColumn().getByLabelText("Name for Heavy 2")).toHaveValue("Early Sep"),
    );
  });

  it("clears a name as null and never PATCHes an unchanged one", async () => {
    const { fake, user } = await renderCards();
    const named = await heavyColumn().findByLabelText("Name for Heavy 1");

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
      expect(toastSuccessMock).toHaveBeenCalledWith("Added Heavy 3."),
    );
    // The new card renders from the refetched list, not from local math.
    await waitFor(() =>
      expect(heavyColumn().getByLabelText("Name for Heavy 3")).toBeInTheDocument(),
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
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Added Heavy 3."));
    await waitFor(() => expect(addToHeavy).toBeEnabled());
    expect(posts).toBe(1);
  });

  it("locks a card's Assign records control while that card's rename is in flight", async () => {
    const { user } = await renderCards();
    const input = await heavyColumn().findByLabelText("Name for Heavy 2");
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
    expect(screen.getByRole("button", { name: "Delete: Heavy 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete: Medium 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete: Medium 2" })).toBeDisabled();
    const deletable = screen.getByRole("button", { name: "Delete: Heavy 2" });
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

    await user.click(screen.getByRole("button", { name: "Delete: Heavy 2" }));

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
      // A real bin: Heavy 1 sits alongside the open and next cards, and the
      // pile rows the walk is moving off of are filed there.
      const fake = fakeRotationAdminEndpoints(
        [PILE_ROW, STILL_ON_PILE_ROW],
        [PILE_CARD, OPEN_CARD, NEXT_CARD],
      );
      const { user } = renderWithProviders(<CardsManager />);
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
      expect(staleRow).toBeInTheDocument();
      expect(staleRow).toBeDisabled();
      expect(staleRow).not.toBeChecked();
      expect(nextPanel.getByRole("button", { name: "Save" })).toBeDisabled();

      await act(() => fake.releaseActiveListReads());

      // Once the read lands, the moved record carries card N (Heavy 3) as
      // its current card, so the toggle -- still on -- stops offering it.
      await waitFor(() =>
        expect(
          nextPanel.queryByRole("checkbox", { name: "Juana Molina — DOGA" }),
        ).not.toBeInTheDocument(),
      );
      // The row that never left Heavy 1 still is -- the filter is finding
      // genuine card-1 rows, not just emptied out.
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
      fakeRotationAdminEndpoints([PILE_ROW], [PILE_CARD, OPEN_CARD, NEXT_CARD]);
      const { user } = renderWithProviders(<CardsManager />);
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
      fakeRotationAdminEndpoints([PILE_ROW], [PILE_CARD, OPEN_CARD, NEXT_CARD]);
      const { user } = renderWithProviders(<CardsManager />);
      await screen.findByTestId(`rotation-card-${OPEN_CARD.id}`);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 3" }));
      const openPanel = within(await screen.findByRole("dialog", { name: "Heavy 3" }));
      await user.click(await openPanel.findByRole("checkbox", { name: "Still on Heavy 1" }));

      await user.click(openPanel.getByRole("button", { name: "Open Heavy 4" }));

      const nextPanel = within(await screen.findByRole("dialog", { name: "Heavy 4" }));
      expect(await nextPanel.findByRole("checkbox", { name: "Still on Heavy 1" })).toBeChecked();
    });

    it("advances via the Open step with nothing ticked, sending no writes", async () => {
      const fake = fakeRotationAdminEndpoints([PILE_ROW], [PILE_CARD, OPEN_CARD, NEXT_CARD]);
      const { user } = renderWithProviders(<CardsManager />);
      await screen.findByTestId(`rotation-card-${OPEN_CARD.id}`);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 3" }));
      const openPanel = within(await screen.findByRole("dialog", { name: "Heavy 3" }));
      await openPanel.findByText(/On Heavy 3 now/);

      await user.click(openPanel.getByRole("button", { name: "Open Heavy 4" }));

      await screen.findByRole("dialog", { name: "Heavy 4" });
      expect(fake.updateBodies()).toEqual([]);
    });
  });

  describe("the records on each card", () => {
    const HEAVY_1 = { id: 31, bin: RotationBin.H, number: 1, name: "Late Aug" };
    const HEAVY_2 = { id: 32, bin: RotationBin.H, number: 2, name: null };
    const MEDIUM_1 = { id: 21, bin: RotationBin.M, number: 1, name: null };
    const onCard = (
      card: RotationCardRef,
      rotationId: number,
      artistName: string,
      albumTitle: string,
    ) =>
      createTestRotationListRow({
        id: rotationId,
        rotation_id: rotationId,
        rotation_bin: card.bin,
        card,
        artist_name: artistName,
        album_title: albumTitle,
      });
    const recordLines = (cardId: number) =>
      within(screen.getByTestId(`rotation-card-${cardId}`))
        .queryAllByRole("listitem")
        .map((item) => item.textContent);

    it("lists each card's own active records as Artist — Title, in the panel's order", async () => {
      fakeRotationAdminEndpoints(
        [
          onCard(HEAVY_1, 5101, "Nilüfer Yanya", "PAINLESS"),
          onCard(HEAVY_1, 5102, "Autechre", "Elseq 1-5"),
          // "Łukasz" (from the vendored charset corpus) has no NFD
          // decomposition, so a fold-then-code-unit compare would sort it
          // after every ASCII letter -- after "Nilüfer Yanya", not between
          // "Little Simz" and "Lungfish". Only the collator gets this right.
          onCard(HEAVY_1, 5103, "Łukasz", "Sample Record"),
          onCard(HEAVY_1, 5104, "Little Simz", "Sometimes I Might Be Introvert"),
          onCard(HEAVY_1, 5105, "Lungfish", "Hall of Ideas"),
          onCard(HEAVY_2, 5106, "Juana Molina", "DOGA"),
          onCard(MEDIUM_1, 5107, "Wednesday", "Rat Saw God"),
        ],
        [HEAVY_1, HEAVY_2, MEDIUM_1],
      );
      renderWithProviders(<CardsManager />);
      await screen.findByTestId("rotation-card-31");

      await waitFor(() =>
        expect(recordLines(31)).toEqual([
          "Autechre — Elseq 1-5",
          "Little Simz — Sometimes I Might Be Introvert",
          "Łukasz — Sample Record",
          "Lungfish — Hall of Ideas",
          "Nilüfer Yanya — PAINLESS",
        ]),
      );
      expect(recordLines(32)).toEqual(["Juana Molina — DOGA"]);
      expect(recordLines(21)).toEqual(["Wednesday — Rat Saw God"]);
      expect(screen.getByRole("list", { name: "Records on Heavy 1" })).toBeInTheDocument();
    });

    it("shows five records and expands in place to all of them, then collapses", async () => {
      const six = ["Anna", "Bruce", "Cora", "Dale", "Erin", "Finn"].map((artist, index) =>
        onCard(HEAVY_1, 5200 + index, artist, "Side A"),
      );
      fakeRotationAdminEndpoints(six, [HEAVY_1]);
      const { user } = renderWithProviders(<CardsManager />);
      await screen.findByTestId("rotation-card-31");

      const expand = await screen.findByRole("button", { name: "Show all 6 records on Heavy 1" });
      expect(expand).toHaveAttribute("aria-expanded", "false");
      expect(expand).toHaveTextContent("Show all 6");
      expect(recordLines(31)).toHaveLength(5);

      await user.click(expand);
      expect(recordLines(31)).toHaveLength(6);
      const collapse = screen.getByRole("button", { name: "Show fewer records on Heavy 1" });
      expect(collapse).toHaveAttribute("aria-expanded", "true");
      expect(collapse).toHaveTextContent("Show fewer");

      await user.click(collapse);
      expect(recordLines(31)).toHaveLength(5);
      expect(
        screen.getByRole("button", { name: "Show all 6 records on Heavy 1" }),
      ).toBeInTheDocument();
    });

    it("drops the expanded state once a refetch dips the count to the preview, even after it climbs back", async () => {
      const six = ["Anna", "Bruce", "Cora", "Dale", "Erin", "Finn"].map((artist, index) =>
        onCard(HEAVY_1, 5250 + index, artist, "Side A"),
      );
      fakeRotationAdminEndpoints(six, [HEAVY_1]);
      let activeReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation`, ({ request }) => {
          const status = new URL(request.url).searchParams.get("status");
          if (status !== "active") return HttpResponse.json(six);
          activeReads += 1;
          // The second active read (after the expand, before the count
          // climbs back) answers with one fewer -- every other read,
          // including the one after, answers with all six.
          return HttpResponse.json(activeReads === 2 ? six.slice(0, 5) : six);
        }),
      );
      const { user, store } = renderWithProviders(<CardsManager />);
      await screen.findByTestId("rotation-card-31");

      await user.click(await screen.findByRole("button", { name: "Show all 6 records on Heavy 1" }));
      expect(recordLines(31)).toHaveLength(6);

      await act(async () => {
        await store.dispatch(
          rotationApi.endpoints.getRotationList.initiate("active", { forceRefetch: true }),
        );
      });
      // At or below the preview, the toggle has nothing to show -- and so no
      // way for anyone to have pressed it back to collapsed.
      await waitFor(() => expect(recordLines(31)).toHaveLength(5));
      expect(screen.queryByRole("button", { name: /^Show (all|fewer)/ })).not.toBeInTheDocument();

      await act(async () => {
        await store.dispatch(
          rotationApi.endpoints.getRotationList.initiate("active", { forceRefetch: true }),
        );
      });

      // Back above the preview with nobody having pressed anything: the card
      // reopens collapsed, not still expanded from before the dip. Waited
      // for, not asserted bare -- the cache updates synchronously with the
      // dispatch above, but the subscribed component's re-render does not.
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Show all 6 records on Heavy 1" }),
        ).toHaveTextContent("Show all 6"),
      );
      expect(recordLines(31)).toHaveLength(5);
    });

    it("shows no expand control for a card with five or fewer records", async () => {
      fakeRotationAdminEndpoints(
        ["Anna", "Bruce", "Cora", "Dale", "Erin"].map((artist, index) =>
          onCard(HEAVY_1, 5300 + index, artist, "Side A"),
        ),
        [HEAVY_1],
      );
      renderWithProviders(<CardsManager />);
      await screen.findByTestId("rotation-card-31");

      await waitFor(() => expect(recordLines(31)).toHaveLength(5));
      expect(screen.queryByRole("button", { name: /^Show (all|fewer)/ })).not.toBeInTheDocument();
    });

    it("says a card is empty only when the list read succeeded and holds nothing for it", async () => {
      fakeRotationAdminEndpoints(
        [onCard(HEAVY_1, 5401, "Stereolab", "Dots and Loops")],
        [HEAVY_1, HEAVY_2],
      );
      renderWithProviders(<CardsManager />);

      expect(
        await within(await screen.findByTestId("rotation-card-32")).findByText(
          "Nothing on this card yet.",
        ),
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId("rotation-card-31")).queryByText("Nothing on this card yet."),
      ).not.toBeInTheDocument();
    });

    it("shows the empty line only when the count also says the card is empty", async () => {
      // The list read's dedup can hide a card's only active row -- a newer
      // row for the same release sits on a sibling card in the bin -- so an
      // empty list and a positive count both describe this card at once.
      fakeRotationAdminEndpoints([], [HEAVY_1, HEAVY_2]);
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () =>
          HttpResponse.json([
            { ...HEAVY_1, active_count: 0 },
            { ...HEAVY_2, active_count: 1 },
          ]),
        ),
      );
      renderWithProviders(<CardsManager />);
      await screen.findByTestId("rotation-card-32");

      // Count 0, list empty: the card genuinely holds nothing.
      expect(
        within(screen.getByTestId("rotation-card-31")).getByText("Nothing on this card yet."),
      ).toBeInTheDocument();
      // Count 1, list empty: neither the empty line nor any record line --
      // reporting it as empty would be as wrong as inventing a record.
      expect(
        within(screen.getByTestId("rotation-card-32")).queryByText("Nothing on this card yet."),
      ).not.toBeInTheDocument();
      expect(recordLines(32)).toEqual([]);
    });

    it("shows neither records nor the empty line while the list read is pending", async () => {
      const fake = fakeRotationAdminEndpoints(
        [onCard(HEAVY_1, 5501, "Stereolab", "Dots and Loops")],
        [HEAVY_1, HEAVY_2],
      );
      fake.holdActiveListReads();
      renderWithProviders(<CardsManager />);
      await screen.findByTestId("rotation-card-32");

      expect(screen.queryByText("Nothing on this card yet.")).not.toBeInTheDocument();
      expect(screen.queryByRole("list", { name: /^Records on/ })).not.toBeInTheDocument();
      // The list read being held must never lock the cards CRUD surface --
      // it reads from the cards query, not this one.
      expect(screen.getByLabelText("Name for Heavy 2")).toBeEnabled();
      expect(screen.getByRole("button", { name: "Assign records: Heavy 2" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Add a card to Heavy" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Delete: Heavy 2" })).toBeEnabled();

      await act(() => fake.releaseActiveListReads());
      await waitFor(() => expect(recordLines(31)).toEqual(["Stereolab — Dots and Loops"]));
    });

    it("shows one retryable message for a failed list read, and keeps card controls working", async () => {
      fakeRotationAdminEndpoints(
        [onCard(HEAVY_1, 5601, "Stereolab", "Dots and Loops")],
        [HEAVY_1, HEAVY_2],
      );
      // The cards CRUD surface, kept independent of the list read that fails
      // below -- rename, add, delete and Assign records read from the cards
      // query, not the rotation list, so they must work no matter its state.
      const cardsFake = fakeRotationCardsEndpoints([
        { ...HEAVY_1, active_count: 1 },
        { ...HEAVY_2, active_count: 0 },
      ]);
      let failures = 1;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
          if (failures === 0) return undefined;
          failures -= 1;
          return HttpResponse.json({ error: "boom" }, { status: 500 });
        }),
      );
      const { user } = renderWithProviders(<CardsManager />);

      expect(
        await screen.findByText("Couldn't load the records on these cards."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Nothing on this card yet.")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Name for Heavy 2")).toBeEnabled();
      expect(screen.getByRole("button", { name: "Assign records: Heavy 2" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Add a card to Heavy" })).toBeEnabled();
      const deletable = screen.getByRole("button", { name: "Delete: Heavy 2" });
      expect(deletable).toBeEnabled();

      // Exercised, not just checked enabled: the one deletable card in this
      // fixture actually goes away while the list read is still broken.
      await user.click(deletable);
      await waitFor(() => expect(cardsFake.deletedIds()).toEqual([32]));
      await waitFor(() => expect(screen.queryByTestId("rotation-card-32")).not.toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "Retry" }));

      // Wait on the records themselves, not on the error message's exit --
      // that happens as soon as the refetch is dispatched, before the rows
      // the retry fetched have rendered.
      await waitFor(() => expect(recordLines(31)).toEqual(["Stereolab — Dots and Loops"]));
      expect(
        screen.queryByText("Couldn't load the records on these cards."),
      ).not.toBeInTheDocument();
    });

    it("reads only the active list, never status=all -- the same cache entry the panel uses", async () => {
      const fake = fakeRotationAdminEndpoints(
        [onCard(HEAVY_1, 5701, "Stereolab", "Dots and Loops")],
        [HEAVY_1],
      );
      const { user } = renderWithProviders(<CardsManager />);
      await waitFor(() => expect(recordLines(31)).toHaveLength(1));

      expect(fake.listStatuses()).toEqual(["active"]);

      // If the tab and the panel keyed the list query differently (one on
      // "active", the other on no argument), RTK Query would treat them as
      // separate cache entries and opening the panel would issue a second
      // network read here.
      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 1" }));
      await screen.findByRole("dialog", { name: "Heavy 1" });

      expect(fake.listStatuses()).toEqual(["active"]);
    });

    it("moves a record from one card's list to another once the panel's save refetch lands", async () => {
      fakeRotationAdminEndpoints(
        [
          onCard(HEAVY_1, 5801, "Juana Molina", "DOGA"),
          onCard(HEAVY_1, 5802, "Stereolab", "Dots and Loops"),
        ],
        [HEAVY_1, HEAVY_2],
      );
      const { user } = renderWithProviders(<CardsManager />);
      await screen.findByTestId("rotation-card-31");

      await waitFor(() =>
        expect(recordLines(31)).toEqual(["Juana Molina — DOGA", "Stereolab — Dots and Loops"]),
      );
      expect(recordLines(32)).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Assign records: Heavy 2" }));
      const panel = within(await screen.findByRole("dialog", { name: "Heavy 2" }));
      await user.click(await panel.findByRole("checkbox", { name: "Stereolab — Dots and Loops" }));
      await user.click(panel.getByRole("button", { name: "Save 1" }));
      await waitFor(() => expect(panel.getByText("On Heavy 2 now · 1")).toBeInTheDocument());

      // The tab sits behind the open dialog, which MUI hides from the
      // accessibility tree while it's open -- close it to see the tab again,
      // the way an MD would after filing a move.
      await user.click(panel.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      // The move landed through the same "active" cache entry both the tab
      // and the panel read, so the tab's own list reflects it with no
      // refetch of the tab's own.
      expect(recordLines(32)).toEqual(["Stereolab — Dots and Loops"]);
      expect(recordLines(31)).toEqual(["Juana Molina — DOGA"]);
    });
  });

  describe("the next card is scoped to its own bin", () => {
    it("opens the bin's last card with no Save & open, and never hands a card another bin's", async () => {
      const HEAVY_1 = { id: 31, bin: "H", number: 1, name: null };
      const HEAVY_2 = { id: 32, bin: "H", number: 2, name: null };
      const MEDIUM_1 = { id: 21, bin: "M", number: 1, name: null };
      const MEDIUM_2 = { id: 22, bin: "M", number: 2, name: null };
      // Heavy's last card sits between two Medium cards in the cards read's
      // own order -- a next-card derivation that trusted that order instead
      // of grouping per bin would hand Heavy 2 a Medium sibling as "next".
      fakeRotationAdminEndpoints([], [HEAVY_1, MEDIUM_1, HEAVY_2, MEDIUM_2]);
      const { user } = renderWithProviders(<CardsManager />);
      await screen.findByTestId("rotation-cards-bin-H");

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
      // No walk control at all, named for any bin's number -- a narrower
      // query for the literal "Heavy 3" would miss a next card mislabeled
      // with a sibling bin's own numbering (see the Medium cards above).
      expect(
        lastPanel.queryAllByRole("button", { name: /^(Open|Save & open) / }),
      ).toHaveLength(0);
    });
  });
});
