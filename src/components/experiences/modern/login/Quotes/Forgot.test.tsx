import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ForgotQuotes from "./Forgot";

describe("ForgotQuotes", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render the song title", () => {
    render(<ForgotQuotes />);
    expect(screen.getByText("Forgotten")).toBeInTheDocument();
  });

  it("should render the password-related message", () => {
    render(<ForgotQuotes />);
    expect(screen.getByText("...your password?")).toBeInTheDocument();
  });

  it("should render the artist name", () => {
    render(<ForgotQuotes />);
    expect(screen.getByText("- Linkin Park")).toBeInTheDocument();
  });

  it("should render different quote when random value changes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    render(<ForgotQuotes />);
    // Index 2 (Math.floor(0.25 * 8)) should be "Forgot About Dre"
    expect(screen.getByText("Forgot About Dre")).toBeInTheDocument();
    expect(screen.getByText("- Dr. Dre ft. Eminem")).toBeInTheDocument();
    expect(screen.getByText("...and your password!")).toBeInTheDocument();
  });

  it("should render last quote when random approaches 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    render(<ForgotQuotes />);
    // Index 7 (last item) should be "Forget About It"
    expect(screen.getByText("Forget About It")).toBeInTheDocument();
    expect(screen.getByText("- Alison Krauss")).toBeInTheDocument();
  });
});
