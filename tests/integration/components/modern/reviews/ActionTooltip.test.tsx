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
  vi.restoreAllMocks();
  window.matchMedia = original;
  vi.useRealTimers();
});

/** Focuses the button as the keyboard does. jsdom's `:focus-visible` is true only for the first keyboard focus in a file, so the match is stated here, where Joy asks it, rather than left to the order of the tests. */
function focusByKeyboard(button: HTMLElement) {
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
    return selector === ":focus-visible" ? this === document.activeElement : matches.call(this, selector);
  });
  act(() => button.focus());
}

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
    ["focused by the keyboard where hovering is possible", true, "focus", true],
    ["hovered where hovering is not possible", false, "hover", false],
    ["focused by the keyboard where hovering is not possible", false, "focus", true],
    ["touched", true, "touch", false],
  ])("when %s, the tooltip shows: %s", async (_when, canHover, how, shows) => {
    setHover(canHover);
    const user = await draw();
    const button = screen.getByRole("button", { name: "Write a review" });

    if (how === "hover") {
      await user.hover(button);
    } else if (how === "focus") {
      focusByKeyboard(button);
    } else {
      fireEvent.touchStart(button);
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.queryByRole("tooltip") !== null).toBe(shows);
    expect(button).toHaveAccessibleDescription(TEXT);
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

  it("gives the button no native title, whether the tooltip is closed or open, so the browser draws no second tooltip", async () => {
    setHover(true);
    const user = await draw();
    const button = screen.getByRole("button", { name: "Write a review" });
    expect(button).not.toHaveAttribute("title");

    await user.hover(button);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(button).not.toHaveAttribute("title");
  });

  it("keeps the description out of the reading order, hidden, while the button still has it as its accessible description", async () => {
    setHover(true);
    await draw();

    const description = screen.getByText(TEXT, { ignore: "[role=tooltip]" });
    expect(description).toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Write a review" })).toHaveAccessibleDescription(TEXT);
  });

  it("merges the description with one the button already has, the button's own first", async () => {
    setHover(true);
    renderWithProviders(
      <>
        <span id="reason">Nothing to review yet.</span>
        <ActionTooltip title={TEXT}>
          <Button aria-describedby="reason">Submit</Button>
        </ActionTooltip>
      </>,
    );

    expect(screen.getByRole("button", { name: "Submit" })).toHaveAccessibleDescription(`Nothing to review yet. ${TEXT}`);
  });

  it("closes the open tooltip when the button becomes disabled, and keeps the description", async () => {
    setHover(true);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const drawn = (disabled: boolean) => (
      <ActionTooltip title={TEXT}>
        <Button disabled={disabled}>Save</Button>
      </ActionTooltip>
    );
    const { rerender } = renderWithProviders(drawn(false));
    await user.hover(screen.getByRole("button", { name: "Save" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    rerender(drawn(true));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAccessibleDescription(TEXT);
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute("title");
  });

  it.each([
    ["above the button when it is asked to", "top", "top"],
    ["below the button by default", undefined, "bottom"],
  ])("places the tooltip %s", async (_when, placement, expected) => {
    setHover(true);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(
      <ActionTooltip title={TEXT} placement={placement as "top" | undefined}>
        <Button>Write a review</Button>
      </ActionTooltip>,
    );
    await user.hover(screen.getByRole("button", { name: "Write a review" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByRole("tooltip").getAttribute("data-popper-placement") ?? screen.getByRole("tooltip").getAttribute("data-placement")).toBe(expected);
  });
});
