import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Header from "./Header";

describe("Header", () => {
  it("should render a table element", () => {
    render(<Header />);
    expect(document.querySelector("table")).toBeInTheDocument();
  });

  it("should render the WXYC logo image", () => {
    render(<Header />);
    const logo = screen.getByAltText("WXYC logo");
    expect(logo).toBeInTheDocument();
  });

  it("should have correct image source path", () => {
    render(<Header />);
    const logo = screen.getByAltText("WXYC logo");
    expect(logo).toHaveAttribute("src", "/img/wxyc-logo-classic.gif");
  });

  it("should have border style of 0 on the image", () => {
    render(<Header />);
    const logo = screen.getByAltText("WXYC logo");
    expect(logo).toHaveStyle({ border: "0" });
  });

  it("should have cellPadding on the table", () => {
    render(<Header />);
    const table = document.querySelector("table");
    expect(table).toHaveAttribute("cellPadding", "10");
  });

  it("should render with centered layout", () => {
    render(<Header />);
    const td = document.querySelector("td");
    expect(td).toHaveAttribute("align", "center");
  });

  it("should have display flex with justify-content center on td", () => {
    render(<Header />);
    const td = document.querySelector("td");
    expect(td).toHaveStyle({ display: "flex", justifyContent: "center" });
  });
});
