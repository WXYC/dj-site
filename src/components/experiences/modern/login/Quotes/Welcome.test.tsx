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

  it("should render 'Welcome...' heading", () => {
    render(<WelcomeQuotes />);
    expect(screen.getByText("Welcome...")).toBeInTheDocument();
  });

  it("should render a quote from the list", () => {
    // With Math.random() returning 0, first quote "to the Jungle" should be selected
    render(<WelcomeQuotes />);
    expect(screen.getByText("to the Jungle")).toBeInTheDocument();
  });

  it("should render the artist name", () => {
    // With Math.random() returning 0, first artist "Guns N' Roses" should be selected
    render(<WelcomeQuotes />);
    expect(screen.getByText("- Guns N' Roses")).toBeInTheDocument();
  });

  it("should render different quote when random value changes", () => {
    // Return 0.5 to select middle of array
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<WelcomeQuotes />);
    // Index 4 (Math.floor(0.5 * 9)) should be "Home" by Coheed and Cambria
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("- Coheed and Cambria")).toBeInTheDocument();
  });

  it("should render last quote when random approaches 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    render(<WelcomeQuotes />);
    // Index 8 (last item) should be "to the Club"
    expect(screen.getByText("to the Club")).toBeInTheDocument();
    expect(screen.getByText("- Manian ft. Aila")).toBeInTheDocument();
  });
});
