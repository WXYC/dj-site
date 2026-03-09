import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import MobileHeader from "./MobileHeader";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { applicationSlice } from "@/lib/features/application/frontend";
import { render } from "@testing-library/react";

// Mock Logo component
vi.mock("@/src/components/shared/Branding/Logo", () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

// Mock toggleSidebarCSS utility
const mockToggleSidebarCSS = vi.fn();
vi.mock("@/src/utilities/modern/catalog/utilities", () => ({
  toggleSidebarCSS: () => mockToggleSidebarCSS(),
}));

// Mock MUI icons
vi.mock("@mui/icons-material/DragHandle", () => ({
  default: () => <span data-testid="drag-handle-icon" />,
}));

function createTestStore(initialState?: { rightbar?: { sidebarOpen?: boolean } }) {
  return configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
    preloadedState: initialState
      ? { application: { ...applicationSlice.getInitialState(), ...initialState } as any }
      : undefined,
  });
}

describe("MobileHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render as a Sheet component", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const sheet = document.querySelector(".MuiSheet-root");
      expect(sheet).toBeInTheDocument();
    });

    it("should render Logo component", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      expect(screen.getByTestId("logo")).toBeInTheDocument();
    });

    it("should render menu toggle button", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should render DragHandle icon in menu button", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      expect(screen.getByTestId("drag-handle-icon")).toBeInTheDocument();
    });
  });

  describe("Sidebar Toggle", () => {
    it("should dispatch toggleSidebar action when button is clicked", () => {
      const store = createTestStore();
      const dispatchSpy = vi.spyOn(store, "dispatch");

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(dispatchSpy).toHaveBeenCalledWith(
        applicationSlice.actions.toggleSidebar()
      );
    });

    it("should call toggleSidebarCSS when button is clicked", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockToggleSidebarCSS).toHaveBeenCalled();
    });

    it("should toggle sidebar state in store when clicked", () => {
      const store = createTestStore({
        rightbar: { sidebarOpen: false },
      });

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      // Initial state
      expect(store.getState().application.rightbar.sidebarOpen).toBe(false);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // After click
      expect(store.getState().application.rightbar.sidebarOpen).toBe(true);
    });

    it("should toggle sidebar from open to closed", () => {
      const store = createTestStore({
        rightbar: { sidebarOpen: true },
      });

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      // Initial state
      expect(store.getState().application.rightbar.sidebarOpen).toBe(true);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // After click
      expect(store.getState().application.rightbar.sidebarOpen).toBe(false);
    });
  });

  describe("Button Styling", () => {
    it("should have outlined variant on button", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("MuiIconButton-variantOutlined");
    });

    it("should have neutral color on button", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("MuiIconButton-colorNeutral");
    });

    it("should have small size on button", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("MuiIconButton-sizeSm");
    });
  });

  describe("Layout", () => {
    it("should position header at top of viewport", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const sheet = document.querySelector(".MuiSheet-root");
      expect(sheet).toHaveStyle({ position: "fixed", top: "0px" });
    });

    it("should have full viewport width", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const sheet = document.querySelector(".MuiSheet-root");
      expect(sheet).toHaveStyle({ width: "100vw" });
    });
  });

  describe("Multiple Interactions", () => {
    it("should handle multiple toggle clicks", () => {
      const store = createTestStore({
        rightbar: { sidebarOpen: false },
      });

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");

      // Click 1: false -> true
      fireEvent.click(button);
      expect(store.getState().application.rightbar.sidebarOpen).toBe(true);

      // Click 2: true -> false
      fireEvent.click(button);
      expect(store.getState().application.rightbar.sidebarOpen).toBe(false);

      // Click 3: false -> true
      fireEvent.click(button);
      expect(store.getState().application.rightbar.sidebarOpen).toBe(true);
    });

    it("should call toggleSidebarCSS on each click", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");

      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockToggleSidebarCSS).toHaveBeenCalledTimes(3);
    });
  });

  describe("Accessibility", () => {
    it("should have accessible button element", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button.tagName.toLowerCase()).toBe("button");
    });

    it("should be keyboard accessible", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const button = screen.getByRole("button");
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });

  describe("Component Structure", () => {
    it("should have three child elements in header (button, logo container, empty box)", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const sheet = document.querySelector(".MuiSheet-root");
      // Button, Logo Box, Empty Box
      expect(sheet?.children.length).toBe(3);
    });

    it("should render logo inside a container box", () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <MobileHeader />
        </Provider>
      );

      const logo = screen.getByTestId("logo");
      expect(logo.parentElement).toHaveClass("MuiBox-root");
    });
  });
});
