import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import SettingsPopup from "./SettingsPopup";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import React from "react";
import type { User } from "@/lib/features/authentication/types";

// Mock next/navigation
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

// Mock djHooks
const mockHandleSaveData = vi.fn();
vi.mock("@/hooks/djHooks", () => ({
  useDJAccount: vi.fn(() => ({
    info: {
      id: 1,
      djName: "Test DJ",
      realName: "Test User",
      email: "test@example.com",
    },
    loading: false,
    handleSaveData: mockHandleSaveData,
  })),
}));

// Mock SettingsInput
vi.mock("./SettingsInput", () => ({
  default: ({ name, backendValue, ...props }: any) => (
    <input
      name={name}
      defaultValue={backendValue || ""}
      data-testid={`settings-input-${name}`}
      {...props}
    />
  ),
}));

function createTestStore(preloadedState?: any) {
  return configureStore({
    reducer: {
      authentication: authenticationSlice.reducer,
    },
    preloadedState,
  });
}

describe("SettingsPopup", () => {
  const mockUser: User = {
    id: "user-123",
    username: "testuser",
    realName: "Test User",
    djName: "DJ Test",
    email: "test@example.com",
    authority: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the modal with user information title", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <SettingsPopup user={mockUser} />
      </Provider>
    );

    expect(screen.getByText("Your Information")).toBeInTheDocument();
  });

  it("should display username label", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <SettingsPopup user={mockUser} />
      </Provider>
    );

    expect(screen.getByText("Username")).toBeInTheDocument();
  });

  it("should display form field labels", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <SettingsPopup user={mockUser} />
      </Provider>
    );

    expect(screen.getByText("Personal Name")).toBeInTheDocument();
    expect(screen.getByText("DJ Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("should display settings inputs for editable fields", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <SettingsPopup user={mockUser} />
      </Provider>
    );

    expect(screen.getByTestId("settings-input-realName")).toBeInTheDocument();
    expect(screen.getByTestId("settings-input-djName")).toBeInTheDocument();
    expect(screen.getByTestId("settings-input-email")).toBeInTheDocument();
  });

  it("should display save button", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <SettingsPopup user={mockUser} />
      </Provider>
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });
});
