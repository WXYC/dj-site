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
vi.mock("@/src/components/experiences/classic/catalog/ArtistCardView", () => ({
  default: ({ artistId, genreId }: { artistId: number; genreId?: number }) => (
    <div data-testid="artist-card-view" data-artist-id={artistId} data-genre-id={genreId ?? ""} />
  ),
}));

import ClassicArtistViewPage from "@/app/dashboard/@classic/library/artist/[id]/view/page";

const page = (id = "431", searchParams: { genre_id?: string | string[] } = {}) =>
  ClassicArtistViewPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchParams),
  });

describe("classic /dashboard/library/artist/[id]/view page — artistCardDisplay.jsp", () => {
  setUpClassicPageAuthorityEnv();

  // Authenticated but NOT role-gated, unlike the sibling modify card: catalog
  // search is the DJ-facing screen in classic, so gating here would bounce
  // every DJ who clicked an artist name in their results.
  it.each([
    { role: "dj" as const, label: "a DJ" },
    { role: "musicDirector" as const, label: "a music director" },
    { role: "stationManager" as const, label: "a station manager" },
  ])("reaches the read-only card for $label", async ({ role }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(() => page(), "classic-main", "artist-card-view");
  });

  it("bounces an unauthenticated visitor to login", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(() => page(), "/login?bounced=no-session");
  });

  // An artist id alone does not identify a card: `genre_artist_crossreference`
  // is unique on `(artist_id, genre_id)`, so artist 431 ('Isis') is `IS 1`
  // under Hiphop and `IS 13` under Rock -- two unrelated bands.
  it("carries the genre membership the URL names down to the card", async () => {
    setUpClassicPageAuthority("dj");

    await assertReachesClassicPage(() => page("431", { genre_id: "11" }), "classic-main", "artist-card-view");
    expect(screen.getByTestId("artist-card-view").getAttribute("data-genre-id")).toBe("11");
  });

  // Every link built before this parameter existed omits it, and must still
  // render a card -- the server's lowest-membership collapse.
  it("hands the card no genre when the URL names none", async () => {
    setUpClassicPageAuthority("dj");

    await assertReachesClassicPage(() => page("431"), "classic-main", "artist-card-view");
    expect(screen.getByTestId("artist-card-view").getAttribute("data-genre-id")).toBe("");
  });

  // The input taxonomy (blank, zero, negative, scientific, hex, repeated key)
  // belongs to `parseArtistCardGenreId`'s own suite. What this tier owes is
  // that the page routes a malformed genre into `notFound()` at all: falling
  // back to the unscoped read would serve the conflated card the parameter
  // exists to split, silently.
  it("404s a malformed genre rather than falling back to the collapsed card", async () => {
    setUpClassicPageAuthority("dj");

    await expect(page("431", { genre_id: "rock" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s a non-numeric artist id instead of rendering a card that cannot load", async () => {
    setUpClassicPageAuthority("dj");

    await expect(page("not-an-id")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
