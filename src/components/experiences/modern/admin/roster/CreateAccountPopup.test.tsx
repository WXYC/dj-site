import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import CreateAccountPopup from "./CreateAccountPopup";
import { authenticationSlice } from "@/lib/features/authentication/frontend";

// Mock next/navigation
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

// Mock djHooks
vi.mock("@/src/hooks/djHooks", () => ({
  useDJAccount: () => ({
    info: { id: 1, djName: "DJ Test", realName: "Test User" },
    loading: false,
    handleSaveData: vi.fn(),
  }),
}));

function createTestStore(isModified = false) {
  return configureStore({
    reducer: {
      authentication: authenticationSlice.reducer,
    },
    preloadedState: {
      authentication: {
        ...authenticationSlice.getInitialState(),
        modifications: {
          realName: isModified,
          djName: false,
          email: false,
        },
      },
    },
  });
}

function renderWithProvider(ui: React.ReactElement, isModified = false) {
  const store = createTestStore(isModified);
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

describe("CreateAccountPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render modal with title", () => {
    renderWithProvider(<CreateAccountPopup />);
    expect(screen.getByText("Your Information")).toBeInTheDocument();
  });

  it("should render save button", () => {
    renderWithProvider(<CreateAccountPopup />);
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("should have save button disabled when not modified", () => {
    renderWithProvider(<CreateAccountPopup />);
    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it("should have save button enabled when modified", () => {
    renderWithProvider(<CreateAccountPopup />, true);
    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).not.toBeDisabled();
  });

  it("should render as a form", () => {
    renderWithProvider(<CreateAccountPopup />);
    expect(document.querySelector("form")).toBeInTheDocument();
  });
});
