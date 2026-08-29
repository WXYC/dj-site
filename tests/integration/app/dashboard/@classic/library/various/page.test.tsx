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
// Query-backed card content.
vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="classic-main">{children}</div>
  ),
}));
vi.mock("@/src/components/experiences/classic/catalog/VariousArtistsCard", () => ({
  default: () => <div data-testid="various-artists-card" />,
}));

import ClassicVariousArtistsPage from "@/app/dashboard/@classic/library/various/[id]/page";

const page = (created?: string) =>
  ClassicVariousArtistsPage({
    params: Promise.resolve({ id: "4211" }),
    searchParams: Promise.resolve(created ? { created } : {}),
  });

describe("Classic /dashboard/library/various/[id] page — variousArtistsCardModify.jsp", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the compilation bucket card for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(page, "classic-main", "various-artists-card");
  });

  it("redirects a DJ away — this is an add/edit screen, gated with the rest of the catalog editor", async () => {
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
