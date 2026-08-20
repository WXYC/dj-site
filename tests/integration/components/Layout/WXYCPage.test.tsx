import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import WXYCPage from "@/src/Layout/WXYCPage";

// Mock child components
vi.mock("@/src/Layout/Background", () => ({
  BackgroundBox: ({ children }: any) => (
    <div data-testid="background-box">{children}</div>
  ),
  BackgroundImage: () => <div data-testid="background-image" />,
}));

vi.mock("@/src/Layout/Header", () => ({
  default: () => <header data-testid="header">Header</header>,
}));

vi.mock("@/src/Layout/Main", () => ({
  default: ({ children }: any) => (
    <main data-testid="main">{children}</main>
  ),
}));

vi.mock("@/src/Layout/Footer", () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

describe("WXYCPage", () => {
  it("should render children in Main component", () => {
    render(
      <WXYCPage>
        <div data-testid="page-content">Page Content</div>
      </WXYCPage>
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("should render Header component", () => {
    render(
      <WXYCPage>
        <span>Content</span>
      </WXYCPage>
    );

    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("should render Footer component", () => {
    render(
      <WXYCPage>
        <span>Content</span>
      </WXYCPage>
    );

    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("should render BackgroundBox component", () => {
    render(
      <WXYCPage>
        <span>Content</span>
      </WXYCPage>
    );

    expect(screen.getByTestId("background-box")).toBeInTheDocument();
  });

  it("should render BackgroundImage component", () => {
    render(
      <WXYCPage>
        <span>Content</span>
      </WXYCPage>
    );

    expect(screen.getByTestId("background-image")).toBeInTheDocument();
  });

  // The app shell above this page clips its own overflow so the dashboard can
  // own its internal scroll regions, which leaves no scrollport for the public
  // pages. This container is theirs.
  it("scrolls its own content when the page outgrows the viewport", () => {
    const { container } = renderWithProviders(
      <WXYCPage>
        <span>Content</span>
      </WXYCPage>
    );

    expect(container.querySelector(".ignoreClassic")).toHaveStyle({
      height: "100%",
      overflowY: "auto",
    });
  });

  it("should have ignoreClassic class", () => {
    const { container } = render(
      <WXYCPage>
        <span>Content</span>
      </WXYCPage>
    );

    expect(container.querySelector(".ignoreClassic")).toBeInTheDocument();
  });
});
