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

// The page's own responsibility under test is the auth gate, not the form's
// RTK Query-backed content.
vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="classic-main">{children}</div>,
}));
vi.mock("@/src/components/experiences/classic/catalog/CreateLibraryCodeForm", () => ({
  default: () => <div data-testid="create-library-code-form" />,
}));

import ClassicCreateLibraryCodePage from "@/app/dashboard/@classic/library/artist/new/page";

const searchParams = Promise.resolve({
  genre_id: "3",
  code_letters: "mo",
  code_number: "12",
});

describe("classic /dashboard/library/artist/new page — createLibraryCode.jsp's miss branch", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the page for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(
      () => ClassicCreateLibraryCodePage({ searchParams }),
      "classic-main",
      "create-library-code-form",
    );
  });

  it("redirects a DJ away from the code-miss create screen", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => ClassicCreateLibraryCodePage({ searchParams }));
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(() => ClassicCreateLibraryCodePage({ searchParams }));
  });

  it("bounces an unauthenticated visitor to login, not to the dashboard home", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(() => ClassicCreateLibraryCodePage({ searchParams }), "/login?bounced=no-session");
  });
});
