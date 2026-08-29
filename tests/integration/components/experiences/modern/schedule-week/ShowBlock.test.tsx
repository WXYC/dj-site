import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import ShowBlock, {
  SHOW_PANEL_ID,
} from "@/src/components/experiences/modern/schedule-week/ShowBlock";
import type { ShowBlock as ShowBlockModel } from "@/lib/features/schedule-week/layout";

const block = (over: Partial<ShowBlockModel> = {}): ShowBlockModel => ({
  showId: 1951179,
  djName: "DJ Chowder",
  showName: null,
  startMs: 0,
  endMs: 3_600_000,
  topFraction: 0.25,
  heightFraction: 0.125,
  timeRangeLabel: "6:00a–9:00a",
  isClipped: false,
  endIsInferred: false,
  ...over,
});

describe("ShowBlock", () => {
  const onSelect = vi.fn();
  beforeEach(() => onSelect.mockReset());

  it("is a button, so the grid is operable without a mouse", () => {
    render(<ShowBlock block={block()} isSelected={false} onSelect={onSelect} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("announces the show it expands and whether it is open", () => {
    const { rerender } = render(
      <ShowBlock block={block()} isSelected={false} onSelect={onSelect} />,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", SHOW_PANEL_ID);

    rerender(<ShowBlock block={block()} isSelected onSelect={onSelect} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps an accessible name on a block too short to show text", () => {
    // A sliver renders no visible label; without an accessible name it is an
    // anonymous target that a screen reader cannot distinguish from any other.
    render(
      <ShowBlock
        block={block({ heightFraction: 0.002, timeRangeLabel: "2:00a–2:03a" })}
        isSelected={false}
        onSelect={onSelect}
      />,
    );
    expect(
      screen.getByRole("button", { name: /DJ Chowder — 2:00a–2:03a/ }),
    ).toBeInTheDocument();
  });

  it("activates from the keyboard", async () => {
    const { user } = render(
      <ShowBlock block={block()} isSelected={false} onSelect={onSelect} />,
    );
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(1951179);
  });

  it.each([
    ["an hour-long block", 60 / (24 * 60), true, false],
    ["a three-hour block", 180 / (24 * 60), true, true],
    ["a ten-minute block", 10 / (24 * 60), false, false],
  ])(
    "on %s shows name=%s timeRange=%s",
    (_label, heightFraction, expectName, expectRange) => {
      // The column is ~640px for a whole day, so an hour of airtime fits one
      // line of text and not two. Rendering both clips the second mid-glyph.
      render(
        <ShowBlock
          block={block({ heightFraction })}
          isSelected={false}
          onSelect={onSelect}
        />,
      );
      expect(screen.queryByText("DJ Chowder") !== null).toBe(expectName);
      expect(screen.queryByText("6:00a–9:00a") !== null).toBe(expectRange);
      // Whatever is visible, the full label is always reachable.
      expect(
        screen.getByRole("button", { name: /DJ Chowder — 6:00a–9:00a/ }),
      ).toBeInTheDocument();
    },
  );

  it("marks a show whose sign-off was never recorded", () => {
    render(
      <ShowBlock
        block={block({ endIsInferred: true, timeRangeLabel: "6:00a–?" })}
        isSelected={false}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      expect.stringContaining("no sign-off recorded"),
    );
  });
});
