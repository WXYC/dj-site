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
// down, not the card's RTK Query-backed content.
vi.mock("@/src/components/experiences/classic/Layout/Main", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="classic-main">{children}</div>,
}));
vi.mock("@/src/components/experiences/classic/catalog/ArtistCard", () => ({
  default: ({ artistId, message }: { artistId: number; message?: string }) => (
    <div data-testid="artist-card" data-artist-id={artistId}>
      {message}
    </div>
  ),
}));

import ClassicArtistCardPage from "@/app/dashboard/@classic/library/artist/[id]/page";

const page = (id = "42", created?: string) =>
  ClassicArtistCardPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(created ? { created } : {}),
  });

describe("classic /dashboard/library/artist/[id] page — artistCardModify.jsp", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the page for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(() => page(), "classic-main", "artist-card");
  });

  it("redirects a DJ away from the artist card", async () => {
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => page());
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    setUpClassicPageAuthority(undefined, "musicDirector");

    await assertDeniedClassicPage(() => page());
  });

  it("bounces an unauthenticated visitor to login, not to the dashboard home", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(() => page(), "/login?bounced=no-session");
  });

  it("passes the route's id through to the card", async () => {
    setUpClassicPageAuthority("musicDirector");

    await assertReachesClassicPage(() => page("1087"), "classic-main", "artist-card");
    expect(screen.getByTestId("artist-card").getAttribute("data-artist-id")).toBe("1087");
  });

  it("carries the create confirmation only when the URL asks for it", async () => {
    setUpClassicPageAuthority("musicDirector");

    await assertReachesClassicPage(() => page("42", "1"), "classic-main", "artist-card");
    expect(screen.getByTestId("artist-card")).toHaveTextContent(
      "The artist/library code below has been added to the database.",
    );
  });

  // A non-numeric segment would otherwise reach the card as NaN and render as
  // "this card could not be loaded", which describes a backend fault rather
  // than a wrong URL.
  it("404s a non-numeric artist id instead of rendering a card that cannot load", async () => {
    setUpClassicPageAuthority("musicDirector");

    await expect(page("not-an-id")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
