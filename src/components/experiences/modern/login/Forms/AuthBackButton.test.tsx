import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import AuthBackButton from "./AuthBackButton";
import { applicationSlice } from "@/lib/features/application/frontend";

// Mock the authentication hooks
const mockHandleLogout = vi.fn();
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: () => ({
    handleLogout: mockHandleLogout,
    loggingOut: false,
  }),
}));

function createTestStore() {
  return configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
  });
}

function renderWithProvider(ui: React.ReactElement) {
  const store = createTestStore();
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

describe("AuthBackButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with default text", () => {
    renderWithProvider(<AuthBackButton />);
    expect(screen.getByText("Back to Login")).toBeInTheDocument();
  });

  it("should render with custom text", () => {
    renderWithProvider(<AuthBackButton text="Go Back" />);
    expect(screen.getByText("Go Back")).toBeInTheDocument();
  });

  it("should render a form element", () => {
    renderWithProvider(<AuthBackButton />);
    expect(document.querySelector("form")).toBeInTheDocument();
  });

  it("should call handleLogout when clicked", async () => {
    const { store } = renderWithProvider(<AuthBackButton />);

    const button = screen.getByRole("button", { name: /back to login/i });
    fireEvent.click(button);

    expect(mockHandleLogout).toHaveBeenCalled();
  });

  it("should dispatch setAuthStage action when clicked", async () => {
    const { store } = renderWithProvider(<AuthBackButton />);

    const button = screen.getByRole("button", { name: /back to login/i });
    fireEvent.click(button);

    // Verify dispatch was triggered - the action should set authStage
    const state = store.getState();
    // Auth stage should be set to login after click
    expect(state.application.authFlow.stage).toBe("login");
  });
});
