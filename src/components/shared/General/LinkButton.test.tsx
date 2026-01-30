import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkButton, LinkIconButton } from "./LinkButton";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

describe("LinkButton", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("should render with children", () => {
    render(<LinkButton href="/test">Click me</LinkButton>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("should render as a button for internal links", () => {
    render(<LinkButton href="/dashboard">Go to Dashboard</LinkButton>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should render as an anchor for external links", () => {
    render(<LinkButton href="https://example.com">External</LinkButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("should navigate using router.push for internal links", async () => {
    const user = userEvent.setup();
    render(<LinkButton href="/dashboard">Navigate</LinkButton>);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("should support variant prop", () => {
    render(
      <LinkButton href="/test" variant="outlined">
        Outlined Button
      </LinkButton>
    );
    expect(screen.getByText("Outlined Button")).toBeInTheDocument();
  });

  it("should support color prop", () => {
    render(
      <LinkButton href="/test" color="primary">
        Primary Button
      </LinkButton>
    );
    expect(screen.getByText("Primary Button")).toBeInTheDocument();
  });

  it("should support target prop for external links", () => {
    render(
      <LinkButton href="https://example.com" target="_blank">
        Open in new tab
      </LinkButton>
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("LinkIconButton", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("should render children", () => {
    render(<LinkIconButton href="/test">X</LinkIconButton>);
    expect(screen.getByText("X")).toBeInTheDocument();
  });

  it("should render as a button for internal links", () => {
    render(<LinkIconButton href="/test">Icon</LinkIconButton>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should render as an anchor for external links", () => {
    render(<LinkIconButton href="https://example.com">Icon</LinkIconButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("should navigate using router.push for internal links", async () => {
    const user = userEvent.setup();
    render(<LinkIconButton href="/settings">Icon</LinkIconButton>);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(mockPush).toHaveBeenCalledWith("/settings");
  });
});

// MenuLinkItem tests require Menu context - tested via integration tests
