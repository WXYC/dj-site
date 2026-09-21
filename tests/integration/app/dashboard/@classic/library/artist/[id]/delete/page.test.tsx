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

// The page's own responsibility under test is the auth gate and the id
// guard it hands down, not the RTK Query-backed confirmation content.
vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="classic-main">{children}</div>
  ),
}));
vi.mock("@/src/components/experiences/classic/catalog/ArtistDeleteConfirm", () => ({
  default: ({ artistId }: { artistId: number }) => (
    <div data-testid="artist-delete-confirm" data-artist-id={artistId} />
  ),
}));

import ClassicArtistDeletePage from "@/app/dashboard/@classic/library/artist/[id]/delete/page";

const page = (id = "30021", searchParams: { genre_id?: string | string[] } = {}) =>
  ClassicArtistDeletePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchParams),
  });

describe("Classic /dashboard/library/artist/[id]/delete page — ArtistAdminServlet's delete branch", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the delete confirmation for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(() => page(), "classic-main", "artist-delete-confirm");
  });

  it("redirects a DJ away — deleting an artist is as irreversible as the catalog gets", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => page());
  });

  it("redirects a member with no station role", async () => {
    setUpClassicPageAuthority(undefined);

    await assertDeniedClassicPage(() => page());
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(() => page());
  });

  it("bounces an unauthenticated visitor to login before any role resolution", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(() => page(), "/login?bounced=no-session");
  });

  it("passes the route's id through to the confirmation screen", async () => {
    setUpClassicPageAuthority("musicDirector");

    await assertReachesClassicPage(() => page("1087"), "classic-main", "artist-delete-confirm");
    expect(screen.getByTestId("artist-delete-confirm").getAttribute("data-artist-id")).toBe("1087");
  });

  // A non-numeric or non-positive segment would otherwise reach the screen
  // as NaN (or a nonsense id) and request `/library/artists/<junk>`, which
  // the backend answers 400 -- rendering as "this artist could not be
  // loaded" for what is really a wrong URL. Matches the card page's own
  // guard (`Number.isInteger(artistId) && artistId > 0`).
  it.each([["not-an-id"], ["0"], ["-5"]])("404s an invalid artist id (%s)", async (id) => {
    setUpClassicPageAuthority("musicDirector");

    await expect(page(id)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
