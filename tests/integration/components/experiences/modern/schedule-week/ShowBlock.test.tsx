import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import ShowBlock from "@/src/components/experiences/modern/schedule-week/ShowBlock";
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
  // A show is a destination, not a detail row: the block navigates to it
  // rather than expanding a panel under the calendar.
  it("is a link to the show", () => {
    render(<ShowBlock block={block()} href="?show=1951179" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "?show=1951179");
  });

  it("carries no disclosure semantics", () => {
    // aria-expanded / aria-controls describe a panel this block no longer
    // opens; on a link they announce control of something that never appears.
    render(<ShowBlock block={block()} href="?show=1951179" />);
    const link = screen.getByRole("link");
    expect(link).not.toHaveAttribute("aria-expanded");
    expect(link).not.toHaveAttribute("aria-controls");
  });

  it("keeps an accessible name on a block too short to show text", () => {
    // A sliver renders no visible label; without an accessible name it is an
    // anonymous target that a screen reader cannot distinguish from any other.
    render(
      <ShowBlock
        block={block({ heightFraction: 0.002, timeRangeLabel: "2:00a–2:03a" })}
        href="?show=1951179"
      />,
    );
    expect(
      screen.getByRole("link", { name: /DJ Chowder — 2:00a–2:03a/ }),
    ).toBeInTheDocument();
  });

  it("is reachable from the keyboard", async () => {
    const { user } = render(<ShowBlock block={block()} href="?show=1951179" />);
    await user.tab();
    expect(screen.getByRole("link")).toHaveFocus();
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
      render(<ShowBlock block={block({ heightFraction })} href="?show=1" />);
      expect(screen.queryByText("DJ Chowder") !== null).toBe(expectName);
      expect(screen.queryByText("6:00a–9:00a") !== null).toBe(expectRange);
      // Whatever is visible, the full label is always reachable.
      expect(
        screen.getByRole("link", { name: /DJ Chowder — 6:00a–9:00a/ }),
      ).toBeInTheDocument();
    },
  );

  it("marks a show whose sign-off was never recorded", () => {
    render(
      <ShowBlock
        block={block({ endIsInferred: true, timeRangeLabel: "6:00a–?" })}
        href="?show=1951179"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "title",
      expect.stringContaining("no sign-off recorded"),
    );
  });
});
