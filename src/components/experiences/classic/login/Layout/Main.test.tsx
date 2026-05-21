import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Main from "./Main";

describe("Main (classic login signon-card)", () => {
  it("should render a table element", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td>Test Content</td>
        </tr>
      </Main>
    );
    expect(document.querySelector("table")).toBeInTheDocument();
  });

  it("should render the title prop", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td>Test Content</td>
        </tr>
      </Main>
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("should render children as table body rows", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td data-testid="child">Child Content</td>
        </tr>
      </Main>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("should render multiple child rows", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td data-testid="first">First</td>
        </tr>
        <tr>
          <td data-testid="second">Second</td>
        </tr>
      </Main>
    );
    expect(screen.getByTestId("first")).toBeInTheDocument();
    expect(screen.getByTestId("second")).toBeInTheDocument();
  });

  it("should wrap title in span with title class", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td>Test Content</td>
        </tr>
      </Main>
    );
    const titleSpan = screen.getByText("Test Title");
    expect(titleSpan.tagName).toBe("SPAN");
    expect(titleSpan).toHaveClass("title");
  });

  it("should constrain the layout to a centered signon-card wrapper", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td>Test Content</td>
        </tr>
      </Main>
    );
    const card = document.querySelector(".signon-card");
    expect(card).toBeInTheDocument();
    expect(card).toContainElement(screen.getByText("Test Title"));
  });

  it("should apply the signon-table class to the wrapper table", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td>Test Content</td>
        </tr>
      </Main>
    );
    const table = document.querySelector("table");
    expect(table).toHaveClass("signon-table");
  });

  it("should render the title inside a thead header row", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td>Test Content</td>
        </tr>
      </Main>
    );
    const thead = document.querySelector("thead");
    expect(thead).toBeInTheDocument();
    expect(thead).toContainElement(screen.getByText("Test Title"));
  });

  it("should render the title in a th with the signon-header class", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td>Test Content</td>
        </tr>
      </Main>
    );
    const headerCell = screen.getByText("Test Title").closest("th");
    expect(headerCell).toBeInTheDocument();
    const headerRow = headerCell?.closest("tr");
    expect(headerRow).toHaveClass("signon-header");
  });

  it("should render children inside the table body", () => {
    render(
      <Main title="Test Title">
        <tr>
          <td data-testid="child">Body Content</td>
        </tr>
      </Main>
    );
    const tbody = document.querySelector("tbody");
    expect(tbody).toContainElement(screen.getByTestId("child"));
  });
});
