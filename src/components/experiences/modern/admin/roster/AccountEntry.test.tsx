import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountEntry } from "./AccountEntry";
import {
  Authorization,
  AdminAuthenticationStatus,
} from "@/lib/features/admin/types";

// Mock authClient
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      listUsers: vi.fn(),
      setUserPassword: vi.fn(),
      removeUser: vi.fn(),
    },
    organization: {
      getFullOrganization: vi.fn(),
      listMembers: vi.fn(),
      updateMemberRole: vi.fn(),
    },
  },
}));

// Mock organization utils
vi.mock("@/lib/features/authentication/organization-utils", () => ({
  getAppOrganizationIdClient: () => "test-org",
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockAccount = {
  id: "user-1",
  userName: "testuser",
  realName: "Test User",
  djName: "Test",
  email: "test@example.com",
  authorization: Authorization.DJ,
  authType: AdminAuthenticationStatus.Confirmed,
};

function renderInTable(component: React.ReactElement) {
  return render(
    <table>
      <tbody>{component}</tbody>
    </table>
  );
}

describe("AccountEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render account information", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText(/DJ Test/)).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("should render as table row", () => {
    const { container } = renderInTable(
      <AccountEntry account={mockAccount} isSelf={false} />
    );
    expect(container.querySelector("tr")).toBeInTheDocument();
  });

  it("should render checkboxes", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(2);
  });

  it("should render action buttons", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={false} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2); // Reset password and Delete buttons
  });

  it("should disable checkboxes when viewing own account", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={true} />);
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeDisabled();
    });
  });

  it("should disable delete button when viewing own account", () => {
    renderInTable(<AccountEntry account={mockAccount} isSelf={true} />);
    const deleteButton = screen.getAllByRole("button")[1]; // Second button is delete
    expect(deleteButton).toBeDisabled();
  });

  it("should show SM checkbox checked for station managers", () => {
    const smAccount = { ...mockAccount, authorization: Authorization.SM };
    renderInTable(<AccountEntry account={smAccount} isSelf={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
  });

  it("should show MD checkbox checked for music directors", () => {
    const mdAccount = { ...mockAccount, authorization: Authorization.MD };
    renderInTable(<AccountEntry account={mdAccount} isSelf={false} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).toBeChecked();
  });
});
