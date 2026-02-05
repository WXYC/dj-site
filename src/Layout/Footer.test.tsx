import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./Footer";

describe("Footer", () => {
  it("should render a footer element", () => {
    render(<Footer />);
    expect(document.querySelector("footer")).toBeInTheDocument();
  });

  it("should display copyright text", () => {
    render(<Footer />);
    expect(screen.getByText(/Copyright/)).toBeInTheDocument();
  });

  it("should display current year", () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(String(currentYear)))).toBeInTheDocument();
  });

  it("should display WXYC Chapel Hill", () => {
    render(<Footer />);
    expect(screen.getByText(/WXYC Chapel Hill/)).toBeInTheDocument();
  });
});
