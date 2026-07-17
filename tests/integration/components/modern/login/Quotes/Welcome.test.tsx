import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import WelcomeQuotes, {
  pickWelcomeQuote,
} from "@/src/components/experiences/modern/login/Quotes/Welcome";

describe("pickWelcomeQuote", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects the first entry when random is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickWelcomeQuote()).toEqual([
      "Welcome...",
      "to the Jungle",
      "Guns N' Roses",
    ]);
  });

  it("selects a mid-array entry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(pickWelcomeQuote()).toEqual([
      "Welcome...",
      "to Love",
      "Pharoah Sanders",
    ]);
  });

  it("selects the last entry as random approaches 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickWelcomeQuote()).toEqual(["Come On...", "Let's Go", "Broadcast"]);
  });
});

describe("WelcomeQuotes", () => {
  it("renders the provided greeting, fragment, and artist", () => {
    render(
      <WelcomeQuotes quote={["Hello...", "", "Erykah Badu ft. André 3000"]} />
    );
    expect(screen.getByText("Hello...")).toBeInTheDocument();
    expect(
      screen.getByText("- Erykah Badu ft. André 3000")
    ).toBeInTheDocument();
  });
});
