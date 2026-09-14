import { describe, it, expect } from "vitest";
import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { fakeRotationCardsEndpoints, type FakeRotationCard } from "@/tests/fakes/rotation";
import type { RotationBin } from "@wxyc/shared";

import CardPicker from "@/src/components/shared/inputs/CardPicker";

function Harness({ bin }: { bin: RotationBin }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <div>
      <span data-testid="selected">{value ?? ""}</span>
      <CardPicker bin={bin} value={value} onChange={setValue} />
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
    expect(selected()).not.toBe("2");
  });

  it("resets the selection to the new bin's newest card when bin changes", async () => {
    fakeRotationCardsEndpoints(CARDS);
    const { rerender } = renderWithProviders(<Harness bin="H" />);

    await waitFor(() => expect(selected()).toBe("2"));

    rerender(<Harness bin="M" />);

    await waitFor(() => expect(selected()).toBe("3"));
  });
});
