import { describe, it, expect } from "vitest";
import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { fakeRotationCardsEndpoints, type FakeRotationCard } from "@/tests/fakes/rotation";
import type { RotationBin } from "@wxyc/shared";

import CardPicker from "@/src/components/shared/inputs/CardPicker";

function Harness({
  bin,
  initialValue = null,
}: {
  bin: RotationBin;
  initialValue?: number | null;
}) {
  const [value, setValue] = useState<number | null>(initialValue);
  return (
    <div>
      <span data-testid="selected">{value ?? ""}</span>
      <CardPicker bin={bin} value={value} onChange={setValue} />
    </div>
  );
}

/**
 * The form-shaped parent from the field: `onChange` mints a new form object
 * (and a new handler identity) on every write and on every render, so any
 * unbounded default emit turns into an infinite update loop here.
 */
function FormHarness({
  bin,
  onEmit,
}: {
  bin: RotationBin;
  onEmit?: (cardId: number | null) => void;
}) {
  const [form, setForm] = useState<{ cardId: number | null }>({ cardId: null });
  return (
    <div>
      <span data-testid="selected">{form.cardId ?? ""}</span>
      <CardPicker
        bin={bin}
        value={form.cardId}
        onChange={(cardId) => {
          onEmit?.(cardId);
          setForm((f) => ({ ...f, cardId }));
        }}
      />
    </div>
  );
}

function selected() {
  return screen.getByTestId("selected").textContent;
}

const CARDS: FakeRotationCard[] = [
  { id: 1, bin: "H", number: 1, name: "Stereolab" },
  { id: 2, bin: "H", number: 2, name: null },
  { id: 3, bin: "M", number: 1, name: "Cat Power" },
];

describe("CardPicker", () => {
  it("defaults to the bin's newest card", async () => {
    fakeRotationCardsEndpoints(CARDS);
    renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));
    expect(screen.getByRole("button", { name: "2" })).toBeDefined();
  });

  it("displays a caller-supplied assignment instead of overwriting it with the default", async () => {
    fakeRotationCardsEndpoints(CARDS);
    renderWithProviders(<Harness bin="H" initialValue={1} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "1 · Stereolab" })).toBeInTheDocument(),
    );
    expect(selected()).toBe("1");
  });

  it("shows a spinner while the cards load, not an empty bin", async () => {
    let releaseGet!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGet = resolve;
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, async () => {
        await gate;
        return HttpResponse.json(CARDS);
      }),
    );
    renderWithProviders(<Harness bin="H" />);

    expect(screen.getByLabelText("Loading cards")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ new card" })).toBeNull();

    releaseGet();
    await waitFor(() => expect(selected()).toBe("2"));
  });

  it("shows an error with a retry affordance when the cards fail to load", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () =>
        HttpResponse.json({ message: "nope" }, { status: 500 }),
      ),
    );
    const { user } = renderWithProviders(<Harness bin="H" />);

    expect(await screen.findByText("Unable to load cards.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ new card" })).toBeNull();

    let releaseRetry!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, async () => {
        await gate;
        return HttpResponse.json(CARDS);
      }),
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));

    // The in-flight retry is visible: the spinner replaces the error pair
    // rather than leaving a button that appears to do nothing.
    expect(await screen.findByLabelText("Loading cards")).toBeInTheDocument();
    expect(screen.queryByText("Unable to load cards.")).toBeNull();

    releaseRetry();
    await waitFor(() => expect(selected()).toBe("2"));
  });

  it("stays silent for an empty bin with nothing selected", async () => {
    fakeRotationCardsEndpoints(CARDS);
    const emitted: (number | null)[] = [];
    renderWithProviders(<FormHarness bin="L" onEmit={(cardId) => emitted.push(cardId)} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "+ new card" })).toBeInTheDocument(),
    );

    expect(emitted).toEqual([]);
    expect(selected()).toBe("");
  });

  it("emits the default once per bin and cards change, even under an unstable onChange", async () => {
    fakeRotationCardsEndpoints(CARDS);
    const emitted: (number | null)[] = [];
    renderWithProviders(<FormHarness bin="H" onEmit={(cardId) => emitted.push(cardId)} />);

    await waitFor(() => expect(selected()).toBe("2"));

    expect(emitted).toEqual([2]);
  });

  it("exposes the selected card as pressed to assistive tech", async () => {
    fakeRotationCardsEndpoints(CARDS);
    renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));

    expect(screen.getByRole("group", { name: "Heavy rotation cards" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2", pressed: true })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "1 · Stereolab", pressed: false }),
    ).toBeInTheDocument();
  });

  it("selects a clicked card", async () => {
    fakeRotationCardsEndpoints(CARDS);
    const { user } = renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));
    await user.click(screen.getByRole("button", { name: "1 · Stereolab" }));

    expect(selected()).toBe("1");
  });

  it("creates a card and selects the result", async () => {
    fakeRotationCardsEndpoints(CARDS);
    const { user } = renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));
    await user.click(screen.getByRole("button", { name: "+ new card" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "3" })).toBeDefined());
    expect(selected()).toBe("4");
  });

  it("discards a create that resolves after the bin changed", async () => {
    fakeRotationCardsEndpoints(CARDS);
    let releaseCreate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/rotation/cards`, async () => {
        await gate;
        return HttpResponse.json({ id: 99, bin: "H", number: 3, name: null }, { status: 201 });
      }),
    );
    const { user, rerender } = renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));
    await user.click(screen.getByRole("button", { name: "+ new card" }));

    rerender(<Harness bin="M" />);
    await waitFor(() => expect(selected()).toBe("3"));

    releaseCreate();
    // The chip re-enabling marks the mutation as settled, so the post-await
    // continuation (guarded or not) has run by the next assertion.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "+ new card" })).toBeEnabled(),
    );
    expect(selected()).toBe("3");
  });

  it("resets the selection to the new bin's newest card when bin changes", async () => {
    fakeRotationCardsEndpoints(CARDS);
    const { rerender } = renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));

    rerender(<Harness bin="M" />);

    await waitFor(() => expect(selected()).toBe("3"));
  });

  it("clears the selection when the new bin has no cards", async () => {
    fakeRotationCardsEndpoints(CARDS);
    const { rerender } = renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));

    rerender(<Harness bin="L" />);

    await waitFor(() => expect(selected()).toBe(""));
  });

  it("shows an inline message and keeps the previous selection when create fails", async () => {
    fakeRotationCardsEndpoints(CARDS);
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/rotation/cards`, () =>
        HttpResponse.json({ message: "nope" }, { status: 500 }),
      ),
    );
    const { user } = renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));
    await user.click(screen.getByRole("button", { name: "+ new card" }));

    await waitFor(() => expect(screen.getByText("Failed to create a card.")).toBeDefined());
    expect(selected()).toBe("2");
  });
});
