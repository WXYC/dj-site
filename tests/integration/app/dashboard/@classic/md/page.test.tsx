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

// The page's own responsibility under test is the auth gate. A real render
// would pull the live better-auth client in through Navigation.
vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="classic-main">{children}</div>,
}));
vi.mock("@/src/components/experiences/classic/musicDepartment/MusicDepartmentMenu", () => ({
  default: () => <div data-testid="music-department-menu" />,
}));

import MusicDepartmentPage from "@/app/dashboard/@classic/md/page";

describe("classic Music Department page — musicmenu.jsp", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the page for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(MusicDepartmentPage, "classic-main", "music-department-menu");
  });

  // The menu is MD-gated even though two of its five destinations are
  // DJ-accessible: a DJ reaches Missing Releases and Rotation from the nav
  // bar, which keeps both entries for every role.
  it("redirects a DJ away from the menu", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(MusicDepartmentPage);
  });

  it("redirects an unauthenticated visitor to login", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(MusicDepartmentPage, "/login?bounced=no-session");
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(MusicDepartmentPage);
  });
});
