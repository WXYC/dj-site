import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { AccountEntry } from "@/src/components/experiences/modern/admin/roster/AccountEntry";
import { renderWithProviders, createTestAccountResult } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: { listUsers: vi.fn(), updateUser: vi.fn(), removeUser: vi.fn(), setUserPassword: vi.fn() },
    organization: { getFullOrganization: vi.fn(), listMembers: vi.fn(), updateMemberRole: vi.fn() },
  },
  authBaseURL: "http://localhost:8082/auth",
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  getAppOrganizationIdClient: vi.fn(() => "test-org"),
  resolveOrganizationIdAdmin: vi.fn(() => Promise.resolve("resolved-org-id")),
}));

function renderAccountEntry(overrides: Parameters<typeof createTestAccountResult>[0] = {}, organizationSlug = "wxyc") {
  const account = createTestAccountResult(overrides);
  return renderWithProviders(
    <table>
      <tbody>
        <AccountEntry account={account} isSelf={false} organizationSlug={organizationSlug} />
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

  // An absent flag is onboarding-not-finished everywhere else in the app,
  // including the edit form this row opens. A chip that read it the other way
  // would badge the account as onboarded and then offer to finish onboarding it.
  it("should show 'New' chip when hasCompletedOnboarding is absent", () => {
    renderAccountEntry({ hasCompletedOnboarding: undefined });

    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
