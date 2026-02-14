import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppShell from "./AppShell";

describe("AppShell", () => {
  it("should render children in main element", () => {
    render(<AppShell><span data-testid="content">Main Content</span></AppShell>);
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(document.querySelector("main")).toBeInTheDocument();
  });

  it("should apply className", () => {
    render(<AppShell className="test-class">Content</AppShell>);
    expect(document.querySelector(".test-class")).toBeInTheDocument();
  });

  it("should render header when provided", () => {
    render(<AppShell header={<span data-testid="header">Header</span>}>Content</AppShell>);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(document.querySelector("header")).toBeInTheDocument();
  });

  it("should not render header element when not provided", () => {
    render(<AppShell>Content</AppShell>);
    expect(document.querySelector("header")).not.toBeInTheDocument();
  });

  it("should render sidebar when provided", () => {
    render(<AppShell sidebar={<span data-testid="sidebar">Sidebar</span>}>Content</AppShell>);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(document.querySelector("aside")).toBeInTheDocument();
  });

  it("should not render aside element when sidebar not provided", () => {
    render(<AppShell>Content</AppShell>);
    expect(document.querySelector("aside")).not.toBeInTheDocument();
  });

  it("should render footer when provided", () => {
    render(<AppShell footer={<span data-testid="footer">Footer</span>}>Content</AppShell>);
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(document.querySelector("footer")).toBeInTheDocument();
  });

  it("should not render footer element when not provided", () => {
    render(<AppShell>Content</AppShell>);
    expect(document.querySelector("footer")).not.toBeInTheDocument();
  });

  it("should render all sections when provided", () => {
    render(
      <AppShell
        header={<span data-testid="header">Header</span>}
        sidebar={<span data-testid="sidebar">Sidebar</span>}
        footer={<span data-testid="footer">Footer</span>}
      >
        <span data-testid="content">Content</span>
      </AppShell>
    );

    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });
});
