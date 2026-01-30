import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinkButton, LinkIconButton } from "./LinkButton";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("LinkButton components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LinkButton", () => {
    it("should render children text", () => {
      render(<LinkButton href="/test">Click me</LinkButton>);
      expect(screen.getByText("Click me")).toBeInTheDocument();
    });

    it("should render as anchor for external URLs", () => {
      render(<LinkButton href="https://example.com">External</LinkButton>);
      const button = screen.getByRole("link");
      expect(button).toHaveAttribute("href", "https://example.com");
    });

    it("should render as anchor for http URLs", () => {
      render(<LinkButton href="http://example.com">HTTP Link</LinkButton>);
      const button = screen.getByRole("link");
      expect(button).toHaveAttribute("href", "http://example.com");
    });

    it("should render with target attribute for external URLs", () => {
      render(
        <LinkButton href="https://example.com" target="_blank">
          External
        </LinkButton>
      );
      const button = screen.getByRole("link");
      expect(button).toHaveAttribute("target", "_blank");
    });

    it("should call router.push for internal URLs", () => {
      render(<LinkButton href="/dashboard">Dashboard</LinkButton>);
      const button = screen.getByRole("button");

      fireEvent.click(button);

      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("should pass additional props to button", () => {
      render(
        <LinkButton href="/test" data-testid="link-button">
          Test
        </LinkButton>
      );
      expect(screen.getByTestId("link-button")).toBeInTheDocument();
    });
  });

  describe("LinkIconButton", () => {
    it("should render children", () => {
      render(<LinkIconButton href="/test">Icon</LinkIconButton>);
      expect(screen.getByText("Icon")).toBeInTheDocument();
    });

    it("should render as anchor for external URLs", () => {
      render(<LinkIconButton href="https://example.com">Icon</LinkIconButton>);
      const button = screen.getByRole("link");
      expect(button).toHaveAttribute("href", "https://example.com");
    });

    it("should render with target attribute for external URLs", () => {
      render(
        <LinkIconButton href="https://example.com" target="_blank">
          Icon
        </LinkIconButton>
      );
      const button = screen.getByRole("link");
      expect(button).toHaveAttribute("target", "_blank");
    });

    it("should call router.push for internal URLs", () => {
      render(<LinkIconButton href="/settings">Settings Icon</LinkIconButton>);
      const button = screen.getByRole("button");

      fireEvent.click(button);

      expect(mockPush).toHaveBeenCalledWith("/settings");
    });
  });

  // Note: MenuLinkItem tests require a Menu/List context wrapper
  // and are omitted for simplicity
});
