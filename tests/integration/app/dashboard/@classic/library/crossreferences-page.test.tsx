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

vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="classic-main">{children}</div>,
}));
vi.mock("@/src/components/experiences/classic/library/ArtistCrossReferences", () => ({
  default: () => <div data-testid="artist-crossreferences-table" />,
}));
vi.mock("@/src/components/experiences/classic/library/ReleaseCrossReferences", () => ({
  default: () => <div data-testid="release-crossreferences-table" />,
}));

import ArtistCrossReferencesPage from "@/app/dashboard/@classic/library/crossreferences/artists/page";
import ReleaseCrossReferencesPage from "@/app/dashboard/@classic/library/crossreferences/releases/page";

// Both links sit inside `mainmenu.jsp`'s `hasAdminAccess()` block, and
// Backend gates both endpoints at `catalog: ['write']` — the grant that
// selects the same musicDirector + stationManager pair. The menu entries are
// additionally flag-gated, which controls discoverability and never authority,
// so the gate has to hold on the URL itself.
describe.each([
  {
    name: "library-code cross-references",
    page: ArtistCrossReferencesPage,
    landmark: "artist-crossreferences-table",
  },
  {
    name: "library-release cross-references",
    page: ReleaseCrossReferencesPage,
    landmark: "release-crossreferences-table",
  },
])("classic $name page", ({ page, landmark }) => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the page for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(page, "classic-main", landmark);
  });

  it("redirects a DJ away", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(page);
  });

  it("redirects a member with no station role", async () => {
    setUpClassicPageAuthority(undefined);

    await assertDeniedClassicPage(page);
  });

  it("redirects an unauthenticated visitor to login", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(page, "/login?bounced=no-session");
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(page);
  });
});
