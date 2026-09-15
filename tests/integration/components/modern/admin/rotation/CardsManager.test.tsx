import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  server,
  TEST_BACKEND_URL,
  fakeRotationCardsEndpoints,
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
});
