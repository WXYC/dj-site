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
// Query-backed confirmation content.
vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="classic-main">{children}</div>
  ),
}));
vi.mock("@/src/components/experiences/classic/catalog/ReleaseDeleteConfirm", () => ({
  default: () => <div data-testid="release-delete-confirm" />,
}));

import ClassicReleaseDeletePage from "@/app/dashboard/@classic/library/release/[id]/delete/page";

const page = () => ClassicReleaseDeletePage({ params: Promise.resolve({ id: "53375" }) });

describe("Classic /dashboard/library/release/[id]/delete page — libraryReleaseDelete.jsp", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the delete confirmation for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(page, "classic-main", "release-delete-confirm");
  });

  it("redirects a DJ away — deleting a release is the most irreversible catalog write there is", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(page);
  });

  it("redirects a member with no station role", async () => {
    setUpClassicPageAuthority(undefined);

    await assertDeniedClassicPage(page);
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(page);
  });

  it("bounces an unauthenticated visitor to login before any role resolution", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(page, "/login?bounced=no-session");
  });
});
