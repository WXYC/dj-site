import { describe, it, vi } from "vitest";
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

// The page's own responsibility under test is the auth gate, not the RTK
// Query-backed table content or the shared classic nav bar.
vi.mock("@/src/components/experiences/classic/library/MissingReleases", () => ({
  default: () => <div data-testid="missing-releases-table" />,
}));
vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => <nav data-testid="classic-nav" />,
}));

import ClassicMissingReleasesPage from "@/app/dashboard/@classic/library/missing/page";

// This screen is the one triage flagged as most likely to be "tightened" to
// MD by a well-meaning later change (dj-site#1073, PR #1082 was closed as
// exactly that regression) — asserting a plain DJ reaches it is the point of
// this test, not incidental coverage.
describe("Classic /dashboard/library/missing page — missingReleases.jsp, DJ-accessible not MD-gated", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "dj" as const, label: "a plain DJ session — the non-negotiable authority constraint" },
    { role: "musicDirector" as const, label: "a music director" },
  ])("reaches the Missing Releases screen for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(ClassicMissingReleasesPage, "missing-releases-table", "classic-nav");
  });

  it("redirects a member with no station role (below DJ)", async () => {
    setUpClassicPageAuthority(undefined);

    await assertDeniedClassicPage(ClassicMissingReleasesPage);
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(ClassicMissingReleasesPage);
  });

  it("bounces an unauthenticated visitor to login, not to the dashboard home", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(ClassicMissingReleasesPage, "/login?bounced=no-session");
  });
});
