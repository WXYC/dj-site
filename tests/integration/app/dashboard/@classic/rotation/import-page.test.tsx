import { describe, it, expect, vi } from "vitest";
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
  return {
    ...classicPageAuthorityNavigationMock(),
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  };
});
vi.mock("@/lib/features/authentication/server-client", async () => {
  const { classicPageAuthorityServerClientMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityServerClientMock();
});
vi.mock("@/lib/features/authentication/organization-utils.server", async () => {
  const { classicPageAuthorityOrganizationUtilsMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityOrganizationUtilsMock();
});

// The page's own responsibility under test is the auth gate and the id guard,
// not the RTK Query-backed screen content.
vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="classic-main">{children}</div>
  ),
}));
vi.mock("@/src/components/experiences/classic/rotation/RotationImportScreen", () => ({
  default: () => <div data-testid="rotation-import-screen" />,
}));

import ClassicRotationImportPage from "@/app/dashboard/@classic/rotation/[id]/import/page";

const page = (id = "5002") => () => ClassicRotationImportPage({ params: Promise.resolve({ id }) });

// Every rotation write requires catalog:['write'] on Backend, and this screen
// creates a library release and links a rotation row, so it is gated at the
// same tier as the rest of the rotation write surface rather than at the
// DJ-readable tier its list sibling uses.
describe("Classic /dashboard/rotation/[id]/import page — rotationReleaseImport.jsp, MD-gated", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the import screen for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(page(), "classic-main", "rotation-import-screen");
  });

  it("redirects a plain DJ away — importing to the library is a catalog write", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(page());
  });

  it("redirects a member with no station role", async () => {
    setUpClassicPageAuthority(undefined);

    await assertDeniedClassicPage(page());
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(page());
  });

  it("bounces an unauthenticated visitor to login before any role resolution", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(page(), "/login?bounced=no-session");
  });

  // A non-numeric segment would otherwise reach the screen as NaN and offer
  // to catalog a rotation release that cannot exist.
  it.each(["not-a-number", "0", "-3"])("404s on the unusable id %s", async (id) => {
    setUpClassicPageAuthority("musicDirector");

    await expect(page(id)()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
