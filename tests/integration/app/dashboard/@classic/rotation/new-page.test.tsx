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

vi.mock("@/src/components/experiences/classic/rotation/RotationReleaseInsert", () => ({
  default: () => <div data-testid="rotation-release-insert" />,
}));
vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => <nav data-testid="classic-nav" />,
}));

import ClassicRotationInsertPage from "@/app/dashboard/@classic/rotation/new/page";

// Backend requires catalog:['write'] for POST /library/rotation, so an
// ungated page would render a full add form to a DJ and fail at submit --
// gating this page at MD, unlike its DJ-readable list sibling, is the
// honest surface (docs/architecture.md's "Authority is per screen").
describe("Classic /dashboard/rotation/new page — rotationReleaseInsert.jsp, MD-gated", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the insert form for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(ClassicRotationInsertPage, "rotation-release-insert", "classic-nav");
  });

  it("redirects a plain DJ away from the insert form", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(ClassicRotationInsertPage);
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(ClassicRotationInsertPage);
  });

  it("bounces an unauthenticated visitor to login, not to the dashboard home", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(ClassicRotationInsertPage, "/login?bounced=no-session");
  });
});
