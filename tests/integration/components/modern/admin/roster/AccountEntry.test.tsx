import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { AccountEntry } from "@/src/components/experiences/modern/admin/roster/AccountEntry";
import { renderWithProviders, createTestAccountResult } from "@/tests/helpers";
import { type Account } from "@/lib/features/admin/types";
import { isPendingManagerReview } from "@/lib/features/admin/roster-filter";

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
        <AccountEntry
          account={account}
          isSelf={false}
          organizationSlug={organizationSlug}
        />
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

describe("AccountEntry review indicator", () => {
  // The filter and this chip share `isPendingManagerReview` so they cannot
  // disagree about which rows are pending — see roster-filter.ts.
  it("shows a 'Pending review' chip for a self-signed account awaiting review", () => {
    renderAccountEntry({ selfSignupAt: "2026-08-01T00:00:00Z" });

    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("does not show the chip once the account has been reviewed", () => {
    renderAccountEntry({
      selfSignupAt: "2026-08-01T00:00:00Z",
      selfSignupReviewedAt: "2026-08-02T00:00:00Z",
    });

    expect(screen.queryByText("Pending review")).not.toBeInTheDocument();
  });

  it("does not show the chip for an ordinary admin-provisioned account", () => {
    renderAccountEntry({ selfSignupAt: undefined });

    expect(screen.queryByText("Pending review")).not.toBeInTheDocument();
  });

  // Pins the chip to the exact same predicate `selectRosterView` filters the
  // roster on, so a "pending" filter and an unbadged row can never disagree —
  // the failure mode `isPendingManagerReview`'s doc comment calls out.
  it.each<[string, Partial<Account>]>([
    ["pending — self-signed, unreviewed", { selfSignupAt: "2026-08-01T00:00:00Z" }],
    [
      "reviewed",
      {
        selfSignupAt: "2026-08-01T00:00:00Z",
        selfSignupReviewedAt: "2026-08-02T00:00:00Z",
      },
    ],
    ["never self-signed", { selfSignupAt: undefined }],
  ])("chip visibility matches isPendingManagerReview for: %s", (_label, overrides) => {
    const account = createTestAccountResult(overrides);
    renderAccountEntry(overrides);

    if (isPendingManagerReview(account)) {
      expect(screen.getByText("Pending review")).toBeInTheDocument();
    } else {
      expect(screen.queryByText("Pending review")).not.toBeInTheDocument();
    }
  });
});
