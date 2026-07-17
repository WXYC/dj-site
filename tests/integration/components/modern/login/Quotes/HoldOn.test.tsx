import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HoldOnQuotes, {
  pickHoldOnQuote,
} from "@/src/components/experiences/modern/login/Quotes/HoldOn";

describe("pickHoldOnQuote", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects the first entry when random is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickHoldOnQuote()).toEqual(["for one more day.", "Wilson Phillips"]);
  });

  it("selects a mid-array entry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.35);
    expect(pickHoldOnQuote()).toEqual([
      "be strong, and stay true to yourself.",
      "2Pac",
    ]);
  });

  it("selects the last entry as random approaches 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickHoldOnQuote()).toEqual([
      "to hope if you got it.",
      "Florence + The Machine",
    ]);
  });
});

describe("HoldOnQuotes", () => {
  it("renders the heading, provided quote, artist, and info message", () => {
    render(<HoldOnQuotes quote={["for one more day.", "Wilson Phillips"]} />);
    expect(screen.getByText("Hold On...")).toBeInTheDocument();
    expect(screen.getByText("for one more day.")).toBeInTheDocument();
    expect(screen.getByText("- Wilson Phillips")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Actually, we just need some more information from you."
      )
    ).toBeInTheDocument();
  });
});
