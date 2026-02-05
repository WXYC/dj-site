import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Main from "./Main";

describe("Main", () => {
  it("should render a table element", () => {
    render(<Main title="Test Title">Test Content</Main>);
    expect(document.querySelector("table")).toBeInTheDocument();
  });

  it("should render the title prop", () => {
    render(<Main title="Test Title">Test Content</Main>);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("should render children", () => {
    render(
      <Main title="Test Title">
        <span data-testid="child">Child Content</span>
      </Main>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("should render multiple children", () => {
    render(
      <Main title="Test Title">
        <div data-testid="first">First</div>
        <div data-testid="second">Second</div>
      </Main>
    );
    expect(screen.getByTestId("first")).toBeInTheDocument();
    expect(screen.getByTestId("second")).toBeInTheDocument();
  });

  it("should wrap title in span with title class", () => {
    render(<Main title="Test Title">Test Content</Main>);
    const titleSpan = screen.getByText("Test Title");
    expect(titleSpan.tagName).toBe("SPAN");
    expect(titleSpan).toHaveClass("title");
  });

  it("should have cellPadding on the table", () => {
    render(<Main title="Test Title">Test Content</Main>);
    const table = document.querySelector("table");
    expect(table).toHaveAttribute("cellPadding", "10");
  });

  it("should center align the title cell", () => {
    render(<Main title="Test Title">Test Content</Main>);
    const titleCell = screen.getByText("Test Title").closest("td");
    expect(titleCell).toHaveAttribute("align", "center");
    expect(titleCell).toHaveAttribute("valign", "top");
  });

  it("should center align the children cell", () => {
    render(
      <Main title="Test Title">
        <span data-testid="child">Content</span>
      </Main>
    );
    const childCell = screen.getByTestId("child").closest("td");
    expect(childCell).toHaveAttribute("align", "center");
  });

  it("should render title and children in separate rows", () => {
    render(
      <Main title="Test Title">
        <span data-testid="child">Content</span>
      </Main>
    );
    const rows = document.querySelectorAll("tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContainElement(screen.getByText("Test Title"));
    expect(rows[1]).toContainElement(screen.getByTestId("child"));
  });
});
