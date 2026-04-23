import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { AccountEntry } from "../AccountEntry";
import { renderWithProviders, createTestAccountResult } from "@/lib/test-utils";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: { listUsers: vi.fn(), updateUser: vi.fn(), removeUser: vi.fn(), setUserPassword: vi.fn() },
    organization: { getFullOrganization: vi.fn(), listMembers: vi.fn(), updateMemberRole: vi.fn() },
  },
  authBaseURL: "http://localhost:8082/auth",
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  getAppOrganizationIdClient: vi.fn(() => "test-org"),
}));

function renderAccountEntry(overrides: Parameters<typeof createTestAccountResult>[0] = {}) {
  const account = createTestAccountResult(overrides);
  return renderWithProviders(
    <table>
      <tbody>
        <AccountEntry account={account} isSelf={false} />
      </tbody>
    </table>
  );
}

describe("AccountEntry onboarding indicator", () => {
  it("should show 'New' chip when user has not completed onboarding", () => {
    renderAccountEntry({ hasCompletedOnboarding: false });

    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("should not show 'New' chip when user has completed onboarding", () => {
    renderAccountEntry({ hasCompletedOnboarding: true });

    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("should not show 'New' chip when hasCompletedOnboarding is undefined", () => {
    renderAccountEntry({ hasCompletedOnboarding: undefined });

    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });
});
