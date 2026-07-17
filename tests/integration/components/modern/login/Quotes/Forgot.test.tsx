import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ForgotQuotes, {
  pickForgotQuote,
} from "@/src/components/experiences/modern/login/Quotes/Forgot";

describe("pickForgotQuote", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects the first entry when random is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickForgotQuote()).toEqual([
      "Forgotten",
      "Linkin Park",
      "your password?",
    ]);
  });

  it("selects a mid-array entry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    expect(pickForgotQuote()).toEqual([
      "Forgot About Dre",
      "Dr. Dre ft. Eminem",
      "and your password!",
    ]);
  });

  it("selects the last entry as random approaches 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickForgotQuote()).toEqual([
      "Forget About It",
      "Alison Krauss",
      "but don't forget your password!",
    ]);
  });
});

describe("ForgotQuotes", () => {
  it("renders the provided title, fragment, and artist", () => {
    render(
      <ForgotQuotes quote={["Forgotten", "Linkin Park", "your password?"]} />
    );
    expect(screen.getByText("Forgotten")).toBeInTheDocument();
    expect(screen.getByText("...your password?")).toBeInTheDocument();
    expect(screen.getByText("- Linkin Park")).toBeInTheDocument();
  });
});
