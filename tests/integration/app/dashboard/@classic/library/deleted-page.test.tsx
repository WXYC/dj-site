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
vi.mock("@/src/components/experiences/classic/catalog/DeletedArchiveListing", () => ({
  default: () => <div data-testid="deleted-archive-listing" />,
}));

import ClassicDeletedArchivePage from "@/app/dashboard/@classic/library/deleted/page";

// Same bar as the delete that writes the archive row this page reads:
// Backend gates `GET /library/deleted` and `POST .../restore` at
// `catalog: ['write']`, the musicDirector + stationManager pair.
describe("classic Recently Deleted page", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the page for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(
      ClassicDeletedArchivePage,
      "classic-main",
      "deleted-archive-listing",
    );
  });

  it("redirects a DJ away", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(ClassicDeletedArchivePage);
  });

  it("redirects an unauthenticated visitor to login", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(ClassicDeletedArchivePage, "/login?bounced=no-session");
  });
});
