import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import WelcomeQuotes from "./Welcome";

describe("WelcomeQuotes", () => {
  beforeEach(() => {
    // Mock Math.random to return predictable values
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render greeting, fragment, and artist", () => {
    // With Math.random() returning 0, first entry should be selected
    render(<WelcomeQuotes />);
    expect(screen.getByText("Welcome...")).toBeInTheDocument();
    expect(screen.getByText("to the Jungle")).toBeInTheDocument();
    expect(screen.getByText("- Guns N' Roses")).toBeInTheDocument();
  });

  it("should render different quote when random value changes", () => {
    // Return 0.5 to select middle of array
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<WelcomeQuotes />);
    // Index 10 (Math.floor(0.5 * 20)) should be "to Love" by Pharoah Sanders
    expect(screen.getByText("Welcome...")).toBeInTheDocument();
    expect(screen.getByText("to Love")).toBeInTheDocument();
    expect(screen.getByText("- Pharoah Sanders")).toBeInTheDocument();
  });

  it("should render non-Welcome greeting", () => {
    // Index 18 (Math.floor(0.9 * 20)) is "Hello..." by Erykah Badu
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    render(<WelcomeQuotes />);
    expect(screen.getByText("Hello...")).toBeInTheDocument();
    expect(screen.getByText("- Erykah Badu ft. André 3000")).toBeInTheDocument();
  });

  it("should render last quote when random approaches 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    render(<WelcomeQuotes />);
    // Index 19 (last item) should be "Come On..." / "Let's Go" by Broadcast
    expect(screen.getByText("Come On...")).toBeInTheDocument();
    expect(screen.getByText("Let's Go")).toBeInTheDocument();
    expect(screen.getByText("- Broadcast")).toBeInTheDocument();
  });
});
