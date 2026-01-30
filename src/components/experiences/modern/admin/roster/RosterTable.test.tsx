import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import RosterTable from "./RosterTable";
import { adminSlice } from "@/lib/features/admin/frontend";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import type { User, Authorization } from "@/lib/features/authentication/types";
import React from "react";

// Mock adminHooks
const mockRefetch = vi.fn();
vi.mock("@/src/hooks/adminHooks", () => ({
  useAccountListResults: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
  })),
}));

// Mock auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      createUser: vi.fn(() => Promise.resolve({ data: { user: { id: "new-user-id" } } })),
    },
    organization: {
      getFullOrganization: vi.fn(() => Promise.resolve({ data: { id: "org-123" } })),
      addMember: vi.fn(() => Promise.resolve({})),
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock child components
vi.mock("./AccountEntry", () => ({
  AccountEntry: ({ account }: any) => (
    <tr data-testid={`account-entry-${account.userName}`}>
      <td>{account.realName}</td>
    </tr>
  ),
}));

vi.mock("./AccountSearchForm", () => ({
  default: () => <div data-testid="account-search-form" />,
}));

vi.mock("./ExportCSV", () => ({
  default: () => <button data-testid="export-csv-button">Export</button>,
}));

vi.mock("./NewAccountForm", () => ({
  default: () => (
    <tr data-testid="new-account-form">
      <td colSpan={6}>New Account Form</td>
    </tr>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Add: () => <span data-testid="add-icon" />,
  GppBad: () => <span data-testid="error-icon" />,
}));

vi.mock("@mui/icons-material/AdminPanelSettings", () => ({
  default: () => <span data-testid="admin-icon" />,
}));

function createTestStore(preloadedState?: any) {
  return configureStore({
    reducer: {
      admin: adminSlice.reducer,
      authentication: authenticationSlice.reducer,
    },
    preloadedState,
  });
}

describe("RosterTable", () => {
  const mockUser: User = {
    id: "user-123",
    username: "admin",
    realName: "Admin User",
    djName: "Admin DJ",
    email: "admin@example.com",
    authority: 3, // SM level
  };

  const mockDJUser: User = {
    ...mockUser,
    authority: 2, // DJ level
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD = "temp123";
    process.env.NEXT_PUBLIC_APP_ORGANIZATION = "test-org";
  });

  it("should render the table with header row", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("DJ Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("should render account search form", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    expect(screen.getByTestId("account-search-form")).toBeInTheDocument();
  });

  it("should render export CSV button", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    expect(screen.getByTestId("export-csv-button")).toBeInTheDocument();
  });

  it("should render Add DJ button", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    expect(screen.getByRole("button", { name: /add dj/i })).toBeInTheDocument();
  });

  it("should disable Add DJ button for non-SM users", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockDJUser} />
      </Provider>
    );

    expect(screen.getByRole("button", { name: /add dj/i })).toBeDisabled();
  });

  it("should show loading state", async () => {
    const { useAccountListResults } = await import("@/src/hooks/adminHooks");
    vi.mocked(useAccountListResults).mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should show error state", async () => {
    const { useAccountListResults } = await import("@/src/hooks/adminHooks");
    vi.mocked(useAccountListResults).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error("API Error"),
      refetch: mockRefetch,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    expect(screen.getByText(/something has gone wrong/i)).toBeInTheDocument();
    expect(screen.getByTestId("error-icon")).toBeInTheDocument();
  });

  it("should render account entries when data is loaded", async () => {
    const mockAccounts = [
      { userName: "dj1", realName: "DJ One", email: "dj1@example.com" },
      { userName: "dj2", realName: "DJ Two", email: "dj2@example.com" },
    ];

    const { useAccountListResults } = await import("@/src/hooks/adminHooks");
    vi.mocked(useAccountListResults).mockReturnValue({
      data: mockAccounts,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    expect(screen.getByTestId("account-entry-dj1")).toBeInTheDocument();
    expect(screen.getByTestId("account-entry-dj2")).toBeInTheDocument();
  });

  it("should show new account form when isAdding is true", () => {
    const store = createTestStore({
      admin: {
        ...adminSlice.getInitialState(),
        adding: true,
      },
    });

    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    expect(screen.getByTestId("new-account-form")).toBeInTheDocument();
  });

  it("should dispatch setAdding when Add DJ button is clicked", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <RosterTable user={mockUser} />
      </Provider>
    );

    const addButton = screen.getByRole("button", { name: /add dj/i });
    fireEvent.click(addButton);

    expect(store.getState().admin.adding).toBe(true);
  });
});
