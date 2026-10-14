import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
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
const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", async () => {
  const { classicPageAuthorityNavigationMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return { ...classicPageAuthorityNavigationMock(), notFound: () => mockNotFound() };
});
vi.mock("@/lib/features/authentication/server-client", async () => {
  const { classicPageAuthorityServerClientMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityServerClientMock();
});
vi.mock("@/lib/features/authentication/organization-utils.server", async () => {
  const { classicPageAuthorityOrganizationUtilsMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityOrganizationUtilsMock();
});

// The page's own responsibility under test is the auth gate and what it hands
// down, not the RTK Query-backed card content.
vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="classic-main">{children}</div>
  ),
}));
vi.mock("@/src/components/experiences/classic/catalog/VariousArtistsCard", () => ({
  default: ({ genreId }: { genreId?: number }) => (
    <div data-testid="various-artists-card" data-genre-id={genreId ?? ""} />
  ),
}));

import ClassicVariousArtistsPage from "@/app/dashboard/@classic/library/various/[id]/page";

const page = (search: { created?: string; genre_id?: string | string[] } = {}) =>
  ClassicVariousArtistsPage({
    params: Promise.resolve({ id: "1087" }),
    searchParams: Promise.resolve(search),
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

  // Artist 1087 ('Various Artists') is filed under 14 genres, and each
  // membership is its own shelf section. The card needs to know which one the
  // link meant, or it lists every genre's comps at once.
  it("carries the genre the URL names down to the card", async () => {
    setUpClassicPageAuthority("musicDirector");

    await assertReachesClassicPage(() => page({ genre_id: "15" }), "classic-main", "various-artists-card");
    expect(screen.getByTestId("various-artists-card").getAttribute("data-genre-id")).toBe("15");
  });

  it("hands the card no genre when the URL names none", async () => {
    setUpClassicPageAuthority("musicDirector");

    await assertReachesClassicPage(() => page(), "classic-main", "various-artists-card");
    expect(screen.getByTestId("various-artists-card").getAttribute("data-genre-id")).toBe("");
  });

  // Falling back to the unscoped read would serve every genre's comps on one
  // card, silently.
  it("404s a malformed genre rather than falling back to the merged card", async () => {
    setUpClassicPageAuthority("musicDirector");

    await expect(page({ genre_id: "electronic" })).rejects.toThrow("NEXT_NOT_FOUND");
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
