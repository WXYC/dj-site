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
  default: ({ artistId, genreId, message }: { artistId: number; genreId?: number; message?: string }) => (
    <div data-testid="artist-card" data-artist-id={artistId} data-genre-id={genreId ?? ""}>
      {message}
    </div>
  ),
}));

import ClassicArtistCardPage from "@/app/dashboard/@classic/library/artist/[id]/page";

type ArtistCardSearchParams = {
  created?: string;
  genre_id?: string | string[];
};

const page = (id = "42", search: ArtistCardSearchParams = {}) =>
  ClassicArtistCardPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(search),
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

    await assertReachesClassicPage(() => page("42", { created: "1" }), "classic-main", "artist-card");
    expect(screen.getByTestId("artist-card")).toHaveTextContent(
      "The artist/library code below has been added to the database.",
    );
  });

  // An artist id alone does not identify a card: `genre_artist_crossreference`
  // is unique on `(artist_id, genre_id)`, so artist 431 ('Isis') is `IS 1`
  // under Hiphop and `IS 13` under Rock -- two unrelated bands. The card needs
  // to know which one the link meant.
  it("carries the genre membership the URL names down to the card", async () => {
    setUpClassicPageAuthority("musicDirector");

    await assertReachesClassicPage(() => page("431", { genre_id: "11" }), "classic-main", "artist-card");
    expect(screen.getByTestId("artist-card").getAttribute("data-genre-id")).toBe("11");
  });

  // Every link built before this parameter existed omits it, and must still
  // render a card -- the server's lowest-membership collapse.
  it("hands the card no genre when the URL names none", async () => {
    setUpClassicPageAuthority("musicDirector");

    await assertReachesClassicPage(() => page("431"), "classic-main", "artist-card");
    expect(screen.getByTestId("artist-card").getAttribute("data-genre-id")).toBe("");
  });

  // Silently dropping a malformed genre would serve the conflated card this
  // parameter exists to split -- the reported symptom, reached without a word
  // to the librarian. A broken link gets the answer a broken link gets.
  it.each([
    ["non-numeric", "rock"],
    ["blank", ""],
    ["zero", "0"],
    ["negative", "-11"],
    // Two values name two conflicting memberships. The backend answers 400;
    // picking one of them here would be the same silent wrong-card arrival.
    ["repeated", ["6", "11"]],
  ])(
    "404s a %s genre rather than falling back to the collapsed card",
    async (_label, genre_id) => {
      setUpClassicPageAuthority("musicDirector");

      await expect(page("431", { genre_id })).rejects.toThrow("NEXT_NOT_FOUND");
    },
  );

  // A non-numeric segment would otherwise reach the card as NaN and render as
  // "this card could not be loaded", which describes a backend fault rather
  // than a wrong URL.
  it("404s a non-numeric artist id instead of rendering a card that cannot load", async () => {
    setUpClassicPageAuthority("musicDirector");

    await expect(page("not-an-id")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
