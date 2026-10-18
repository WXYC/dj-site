import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@mui/joy";
import { renderWithProviders } from "@/tests/helpers";
import ActionTooltip from "@/src/components/experiences/modern/reviews/ActionTooltip";

const TEXT = "Open the review editor for this record.";
const original = window.matchMedia;

function setHover(canHover: boolean) {
  window.matchMedia = ((query: string) => ({ ...original(query), matches: canHover && query === "(hover: hover)" })) as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  window.matchMedia = original;
  vi.useRealTimers();
});

async function draw() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderWithProviders(
    <ActionTooltip title={TEXT}>
      <Button>Write a review</Button>
    </ActionTooltip>,
  );
  return user;
}

describe("ActionTooltip", () => {
  it.each([
    ["hovered where hovering is possible", true, "hover", true],
    ["focused by the keyboard", true, "focus", true],
    ["hovered where hovering is not possible", false, "hover", false],
    ["touched", true, "touch", false],
  ])("when %s, the tooltip shows: %s", async (_when, canHover, how, shows) => {
    setHover(canHover);
    const user = await draw();
    const button = screen.getByRole("button", { name: "Write a review" });

    if (how === "hover") {
      await user.hover(button);
    } else if (how === "focus") {
      await user.tab();
    } else {
      fireEvent.touchStart(button);
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.queryByRole("tooltip") !== null).toBe(shows);
  });

  it("describes the button with the tooltip's text while the tooltip is closed, and leaves the button's name alone", async () => {
    setHover(true);
    await draw();

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write a review", description: TEXT })).toBeInTheDocument();
  });

  it("keeps the button's name and description while the tooltip is open", async () => {
    setHover(true);
    const user = await draw();
    await user.hover(screen.getByRole("button", { name: "Write a review" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent(TEXT);
    expect(screen.getByRole("button", { name: "Write a review", description: TEXT })).toBeInTheDocument();
  });
});
