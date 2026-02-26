import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AuthBackButton from "./AuthBackButton";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { applicationSlice } from "@/lib/features/application/frontend";

// Mock hooks
const mockHandleLogout = vi.fn(() => Promise.resolve());
const mockReplace = vi.fn();

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: vi.fn(() => ({
    handleLogout: mockHandleLogout,
    loggingOut: false,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  ArrowBack: () => <span data-testid="arrow-back-icon" />,
}));

function createTestStore() {
  return configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
  });
}

describe("AuthBackButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with default text", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <AuthBackButton />
      </Provider>
    );

    expect(screen.getByText("Back to Login")).toBeInTheDocument();
  });

  it("should render with custom text", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <AuthBackButton text="Go Back" />
      </Provider>
    );

    expect(screen.getByText("Go Back")).toBeInTheDocument();
  });

  it("should render arrow back icon", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <AuthBackButton />
      </Provider>
    );

    expect(screen.getByTestId("arrow-back-icon")).toBeInTheDocument();
  });

  it("should call handleLogout when clicked", async () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <AuthBackButton />
      </Provider>
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockHandleLogout).toHaveBeenCalled();
  });

  it("should dispatch setAuthStage action when clicked", () => {
    const store = createTestStore();
    const dispatchSpy = vi.spyOn(store, "dispatch");

    render(
      <Provider store={store}>
        <AuthBackButton />
      </Provider>
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("should have disabled class when logging out", async () => {
    const { useLogout } = await import("@/src/hooks/authenticationHooks");
    vi.mocked(useLogout).mockReturnValue({
      handleLogout: mockHandleLogout,
      loggingOut: true,
    });

    const store = createTestStore();

    render(
      <Provider store={store}>
        <AuthBackButton />
      </Provider>
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("Mui-disabled");
  });
});
