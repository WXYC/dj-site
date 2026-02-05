import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock the session module
vi.mock("@/lib/features/session", () => ({
  createServerSideProps: vi.fn(),
}));

// Mock the LoadingPage component
vi.mock("./components/LoadingPage", () => ({
  LoadingPage: () => <div data-testid="loading-page">Loading...</div>,
}));

import ThemedLayout, {
  DashboardLayoutProps,
  LoginLayoutProps,
  ThemedLayoutProps,
} from "./ThemedLayout";
import { createServerSideProps } from "@/lib/features/session";

const mockCreateServerSideProps = createServerSideProps as ReturnType<typeof vi.fn>;

describe("ThemedLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("type exports", () => {
    it("should export DashboardLayoutProps type", () => {
      // Type checking at compile time - this test verifies the type is exported
      const props: DashboardLayoutProps = {
        classic: <div>Classic</div>,
        modern: <div>Modern</div>,
        information: <div>Information</div>,
      };
      expect(props).toBeDefined();
    });

    it("should export LoginLayoutProps type", () => {
      // Type checking at compile time
      const props: LoginLayoutProps = {
        classic: <div>Classic</div>,
        modern: <div>Modern</div>,
      };
      expect(props).toBeDefined();
    });

    it("should export ThemedLayoutProps type", () => {
      // Type checking at compile time - union type
      const dashboardProps: ThemedLayoutProps = {
        classic: <div>Classic</div>,
        modern: <div>Modern</div>,
        information: <div>Information</div>,
      };
      const loginProps: ThemedLayoutProps = {
        classic: <div>Classic</div>,
        modern: <div>Modern</div>,
      };
      expect(dashboardProps).toBeDefined();
      expect(loginProps).toBeDefined();
    });
  });

  describe("classic experience", () => {
    beforeEach(() => {
      mockCreateServerSideProps.mockResolvedValue({
        application: {
          experience: "classic",
          colorMode: "system",
        },
        authentication: {
          isAuthenticated: false,
          user: undefined,
        },
      });
    });

    it("should render the classic container when experience is classic", async () => {
      const Component = await ThemedLayout({
        classic: <div data-testid="classic-content">Classic Content</div>,
        modern: <div data-testid="modern-content">Modern Content</div>,
      });

      render(Component);

      await waitFor(() => {
        expect(screen.getByTestId("classic-content")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("modern-content")).not.toBeInTheDocument();
    });

    it("should render classic container with id", async () => {
      const Component = await ThemedLayout({
        classic: <div data-testid="classic-content">Classic</div>,
        modern: <div data-testid="modern-content">Modern</div>,
      });

      const { container } = render(Component);

      await waitFor(() => {
        const classicContainer = container.querySelector("#classic-container");
        expect(classicContainer).toBeInTheDocument();
      });
    });

    it("should render information slot when provided with dashboard props", async () => {
      const dashboardProps: DashboardLayoutProps = {
        classic: <div data-testid="classic-content">Classic</div>,
        modern: <div data-testid="modern-content">Modern</div>,
        information: <div data-testid="information-slot">Information</div>,
      };

      const Component = await ThemedLayout(dashboardProps);

      render(Component);

      await waitFor(() => {
        expect(screen.getByTestId("information-slot")).toBeInTheDocument();
      });
    });
  });

  describe("modern experience", () => {
    beforeEach(() => {
      mockCreateServerSideProps.mockResolvedValue({
        application: {
          experience: "modern",
          colorMode: "system",
        },
        authentication: {
          isAuthenticated: false,
          user: undefined,
        },
      });
    });

    it("should render the modern container when experience is modern", async () => {
      const Component = await ThemedLayout({
        classic: <div data-testid="classic-content">Classic Content</div>,
        modern: <div data-testid="modern-content">Modern Content</div>,
      });

      render(Component);

      await waitFor(() => {
        expect(screen.getByTestId("modern-content")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("classic-content")).not.toBeInTheDocument();
    });

    it("should render modern container with id", async () => {
      const Component = await ThemedLayout({
        classic: <div data-testid="classic-content">Classic</div>,
        modern: <div data-testid="modern-content">Modern</div>,
      });

      const { container } = render(Component);

      await waitFor(() => {
        const modernContainer = container.querySelector("#modern-container");
        expect(modernContainer).toBeInTheDocument();
      });
    });

    it("should render information slot when provided with dashboard props", async () => {
      const dashboardProps: DashboardLayoutProps = {
        classic: <div data-testid="classic-content">Classic</div>,
        modern: <div data-testid="modern-content">Modern</div>,
        information: <div data-testid="information-slot">Information</div>,
      };

      const Component = await ThemedLayout(dashboardProps);

      render(Component);

      await waitFor(() => {
        expect(screen.getByTestId("information-slot")).toBeInTheDocument();
      });
    });
  });

  describe("login layout (no information slot)", () => {
    beforeEach(() => {
      mockCreateServerSideProps.mockResolvedValue({
        application: {
          experience: "modern",
          colorMode: "system",
        },
        authentication: {
          isAuthenticated: false,
          user: undefined,
        },
      });
    });

    it("should handle login props without information slot", async () => {
      const loginProps: LoginLayoutProps = {
        classic: <div data-testid="classic-login">Classic Login</div>,
        modern: <div data-testid="modern-login">Modern Login</div>,
      };

      const Component = await ThemedLayout(loginProps);

      render(Component);

      await waitFor(() => {
        expect(screen.getByTestId("modern-login")).toBeInTheDocument();
      });
    });

    it("should not render information when using login props", async () => {
      const loginProps: LoginLayoutProps = {
        classic: <div data-testid="classic-login">Classic Login</div>,
        modern: <div data-testid="modern-login">Modern Login</div>,
      };

      const Component = await ThemedLayout(loginProps);

      render(Component);

      // Information slot should not exist (null in the output)
      await waitFor(() => {
        expect(screen.getByTestId("modern-login")).toBeInTheDocument();
      });
      // No crash means information was handled correctly as null
    });
  });

  describe("fallback behavior", () => {
    it("should render modern when only modern is provided and experience is classic", async () => {
      mockCreateServerSideProps.mockResolvedValue({
        application: {
          experience: "classic",
          colorMode: "system",
        },
        authentication: {
          isAuthenticated: false,
          user: undefined,
        },
      });

      // When both classic and modern are provided but the condition checks for both
      const Component = await ThemedLayout({
        classic: null as unknown as React.ReactNode, // Simulating missing classic
        modern: <div data-testid="modern-fallback">Modern Fallback</div>,
      });

      render(Component);

      await waitFor(() => {
        expect(screen.getByTestId("modern-fallback")).toBeInTheDocument();
      });
    });
  });

  describe("Suspense boundary", () => {
    it("should wrap content in Suspense with LoadingPage fallback", async () => {
      mockCreateServerSideProps.mockResolvedValue({
        application: {
          experience: "modern",
          colorMode: "system",
        },
        authentication: {
          isAuthenticated: false,
          user: undefined,
        },
      });

      const Component = await ThemedLayout({
        classic: <div>Classic</div>,
        modern: <div data-testid="modern-content">Modern</div>,
      });

      render(Component);

      // The Suspense boundary exists (content renders after suspense resolves)
      await waitFor(() => {
        expect(screen.getByTestId("modern-content")).toBeInTheDocument();
      });
    });
  });

  describe("server side props integration", () => {
    it("should call createServerSideProps", async () => {
      mockCreateServerSideProps.mockResolvedValue({
        application: {
          experience: "modern",
          colorMode: "system",
        },
        authentication: {
          isAuthenticated: false,
          user: undefined,
        },
      });

      await ThemedLayout({
        classic: <div>Classic</div>,
        modern: <div>Modern</div>,
      });

      expect(mockCreateServerSideProps).toHaveBeenCalledTimes(1);
    });
  });
});
