import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./Footer";

describe("Footer", () => {
  it("should render footer element", () => {
    render(<Footer />);
    expect(document.querySelector("footer")).toBeInTheDocument();
  });

  it("should display copyright text with current year", () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`Copyright © ${currentYear} WXYC Chapel Hill`)
    ).toBeInTheDocument();
  });

  it("should include WXYC Chapel Hill in copyright", () => {
    render(<Footer />);
    expect(screen.getByText(/WXYC Chapel Hill/)).toBeInTheDocument();
  });
});
