import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HoldOnQuotes from "./HoldOn";

describe("HoldOnQuotes", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render 'Hold On...' heading", () => {
    render(<HoldOnQuotes />);
    expect(screen.getByText("Hold On...")).toBeInTheDocument();
  });

  it("should render the quote continuation", () => {
    render(<HoldOnQuotes />);
    expect(screen.getByText("for one more day.")).toBeInTheDocument();
  });

  it("should render the artist name", () => {
    render(<HoldOnQuotes />);
    expect(screen.getByText("- Wilson Phillips")).toBeInTheDocument();
  });

  it("should render the information message", () => {
    render(<HoldOnQuotes />);
    expect(
      screen.getByText(
        "Actually, we just need some more information from you."
      )
    ).toBeInTheDocument();
  });

  it("should render different quote when random value changes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.35);
    render(<HoldOnQuotes />);
    // Index 3 (Math.floor(0.35 * 10)) should be 2Pac quote
    expect(
      screen.getByText("be strong, and stay true to yourself.")
    ).toBeInTheDocument();
    expect(screen.getByText("- 2Pac")).toBeInTheDocument();
  });

  it("should render Pearl Jam quote for middle value", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    render(<HoldOnQuotes />);
    // Index 7 should be Pearl Jam
    expect(screen.getByText("I'm still alive.")).toBeInTheDocument();
    expect(screen.getByText("- Pearl Jam")).toBeInTheDocument();
  });

  it("should render last quote when random approaches 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    render(<HoldOnQuotes />);
    // Index 9 (last item) should be Florence + The Machine
    expect(
      screen.getByText("to hope if you got it.")
    ).toBeInTheDocument();
    expect(screen.getByText("- Florence + The Machine")).toBeInTheDocument();
  });
});
