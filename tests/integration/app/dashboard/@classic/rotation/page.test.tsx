import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import {
  setUpClassicPageAuthority,
  setUpClassicPageAuthorityEnv,
  assertReachesClassicPage,
  assertDeniedClassicPage,
} from "@/tests/helpers/classic-page-authority-harness";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => {
  const { classicPageAuthorityHeadersMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityHeadersMock();
});
vi.mock("next/navigation", async () => {
  const { classicPageAuthorityNavigationMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityNavigationMock();
});
vi.mock("@/lib/features/authentication/server-client", async () => {
  const { classicPageAuthorityServerClientMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityServerClientMock();
});
vi.mock("@/lib/features/authentication/organization-utils.server", async () => {
  const { classicPageAuthorityOrganizationUtilsMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityOrganizationUtilsMock();
});

vi.mock("@/src/components/experiences/classic/rotation/RotationReleaseList", () => ({
  default: ({ statusFilter }: { statusFilter: string }) => (
    <div data-testid="rotation-release-list" data-status-filter={statusFilter} />
  ),
}));
vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => <nav data-testid="classic-nav" />,
}));

import ClassicRotationListPage from "@/app/dashboard/@classic/rotation/page";

const noStatus = Promise.resolve({});

// Both rotation links sit outside mainmenu.jsp's hasAdminAccess() block, and
// Backend gates GET /library/rotation (and /library/rotation/uncatalogued)
// at catalog:['read'] -- the list is DJ-readable, not MD-only. Asserting a
// plain DJ reaches it is the point of this test, matching the precedent
// missing/page.test.tsx sets for the sibling DJ-accessible screen.
describe("Classic /dashboard/rotation page — rotationReleaseList.jsp, DJ-readable not MD-gated", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "dj" as const, label: "a plain DJ session — the non-negotiable authority constraint" },
    { role: "musicDirector" as const, label: "a music director" },
  ])("reaches the rotation list for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(
      () => ClassicRotationListPage({ searchParams: noStatus }),
      "rotation-release-list",
      "classic-nav",
    );
  });

  it("redirects a member with no station role (below DJ)", async () => {
    setUpClassicPageAuthority(undefined);

    await assertDeniedClassicPage(() => ClassicRotationListPage({ searchParams: noStatus }));
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(() => ClassicRotationListPage({ searchParams: noStatus }));
  });

  it("bounces an unauthenticated visitor to login, not to the dashboard home", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(
      () => ClassicRotationListPage({ searchParams: noStatus }),
      "/login?bounced=no-session",
    );
  });
});

describe("Classic /dashboard/rotation page — ?status= parsing", () => {
  setUpClassicPageAuthorityEnv();

  it("defaults to the active facet when no status is given", async () => {
    setUpClassicPageAuthority("dj");
    const result = await ClassicRotationListPage({ searchParams: noStatus });
    renderWithProviders(result);

    expect(screen.getByTestId("rotation-release-list")).toHaveAttribute("data-status-filter", "active");
  });

  it.each(["all", "active", "killed", "uncataloged"])("passes through a recognized status=%s", async (status) => {
    setUpClassicPageAuthority("dj");
    const result = await ClassicRotationListPage({ searchParams: Promise.resolve({ status }) });
    renderWithProviders(result);

    expect(screen.getByTestId("rotation-release-list")).toHaveAttribute("data-status-filter", status);
  });

  it("falls back to the active facet for an unrecognized status value", async () => {
    setUpClassicPageAuthority("dj");
    const result = await ClassicRotationListPage({
      searchParams: Promise.resolve({ status: "bogus" }),
    });
    renderWithProviders(result);

    expect(screen.getByTestId("rotation-release-list")).toHaveAttribute("data-status-filter", "active");
  });
});
