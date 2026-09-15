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

vi.mock("@/src/components/experiences/classic/catalog/SearchForm", () => ({
  default: () => <div data-testid="classic-search-form" />,
}));
vi.mock("@/src/components/experiences/classic/catalog/SearchResults", () => ({
  default: ({ canModify }: { canModify: boolean }) => (
    <div data-testid="classic-search-results" data-can-modify={canModify} />
  ),
}));
vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => <nav data-testid="classic-nav" />,
}));

import ClassicCatalogPage from "@/app/dashboard/@classic/catalog/page";

// `searchCardCatalog` carries no role check of its own, and classic's card
// catalog is the DJ-facing search screen -- gating this page at MD would
// bounce every DJ who ran a search. Authority decides only which artist card
// a result row links to, resolved once here rather than left to the client.
describe("Classic /dashboard/catalog page — DJ-reachable, authority passed down", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    { role: "dj" as const, label: "a plain DJ session", canModify: false },
    { role: "musicDirector" as const, label: "a music director", canModify: true },
    { role: "stationManager" as const, label: "a station manager", canModify: true },
  ])("reaches the card catalog for $label with canModify=$canModify", async ({ role, canModify }) => {
    setUpClassicPageAuthority(role);

    await assertReachesClassicPage(
      () => ClassicCatalogPage(),
      "classic-search-results",
      "classic-nav",
    );

    expect(screen.getByTestId("classic-search-results")).toHaveAttribute(
      "data-can-modify",
      String(canModify),
    );
  });

  it("bounces an unauthenticated visitor to login", async () => {
    setUpClassicPageAuthority("unauthenticated");

    await assertDeniedClassicPage(() => ClassicCatalogPage(), "/login?bounced=no-session");
  });
});
