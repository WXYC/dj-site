import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, rulesOf } from "@/tests/helpers";
import { APPBAR_CLEARANCE_PX } from "@/src/components/shared/Theme/Appbar";
import {
  setUpClassicPageAuthority,
  setUpReviewsAccess,
  setUpClassicPageAuthorityEnv,
  mockNotFound,
  mockRedirect,
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
vi.mock("@/lib/features/feature-access.server", async () => {
  const { featureAccessServerMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return featureAccessServerMock();
});

// Under test is the layout's own gate, not the strip's rendering.
vi.mock("@/src/components/experiences/modern/reviews/ReviewsTabs", () => ({
  default: ({ showNewMusic }: { showNewMusic: boolean }) => <div data-testid="reviews-tabs" data-new-music={String(showNewMusic)} />,
}));

import ReviewsListsLayout from "@/app/dashboard/@modern/reviews/(lists)/layout";

describe("reviews lists layout", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    ["off", false, "dj", null],
    ["off", false, "musicDirector", null],
    ["staff", false, "dj", null],
    ["staff", true, "musicDirector", "true"],
    ["staff", true, "stationManager", "true"],
    ["everyone", true, "dj", "false"],
    ["everyone", true, "musicDirector", "true"],
    ["everyone", true, "stationManager", "true"],
  ] as const)("with audience %s and access %s for a %s, the strip is drawn with New music: %s; children render and nobody is refused", async (audience, canSee, role, newMusic) => {
    setUpReviewsAccess(audience, canSee);
    setUpClassicPageAuthority(role);

    renderWithProviders(await ReviewsListsLayout({ children: <div data-testid="child-page" /> }));

    expect(screen.queryByTestId("reviews-tabs")?.getAttribute("data-new-music") ?? null).toBe(newMusic);
    expect(screen.queryAllByRole("heading", { name: "Reviews" })).toHaveLength(newMusic === null ? 0 : 1);
    expect(screen.getByTestId("child-page")).toBeInTheDocument();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("draws Reviews once, ahead of the strip and outside the scroll region, and leaves the document title to each page", async () => {
    setUpReviewsAccess("everyone", true);
    setUpClassicPageAuthority("musicDirector");
    document.title = "New music | WXYC";

    renderWithProviders(await ReviewsListsLayout({ children: <div data-testid="child-page" /> }));

    const heading = screen.getByRole("heading", { name: "Reviews" });
    const strip = screen.getByTestId("reviews-tabs");
    const region = screen.getByTestId("child-page").parentElement!;
    expect(heading.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region).not.toContainElement(heading);
    expect(document.title).toBe("New music | WXYC");
  });

  it("leaves room under the scroll region for the fixed account button below md, and not above it", async () => {
    setUpReviewsAccess("everyone", true);
    setUpClassicPageAuthority("dj");

    renderWithProviders(await ReviewsListsLayout({ children: <div data-testid="child-page" /> }));

    const { media } = rulesOf(screen.getByTestId("child-page").parentElement!);
    expect(media["(min-width:0px)"]).toMatch(new RegExp(`padding-bottom:\\s*${APPBAR_CLEARANCE_PX}px`));
    expect(media["(min-width:900px)"]).toMatch(/padding-bottom:\s*0/);
  });

  it("scrolls the page content and leaves the strip pinned outside the scroll region", async () => {
    setUpReviewsAccess("everyone", true);
    setUpClassicPageAuthority("musicDirector");

    renderWithProviders(await ReviewsListsLayout({ children: <div data-testid="child-page" /> }));

    const region = screen.getByTestId("child-page").parentElement!;
    expect(region).toHaveStyle({ flex: "1", minHeight: "0px", overflow: "auto" });
    expect(region).not.toContainElement(screen.getByTestId("reviews-tabs"));
  });

  it("gives a DJ the same scroll region", async () => {
    setUpReviewsAccess("everyone", true);
    setUpClassicPageAuthority("dj");

    renderWithProviders(await ReviewsListsLayout({ children: <div data-testid="child-page" /> }));

    expect(screen.getByTestId("child-page").parentElement).toHaveStyle({ overflow: "auto" });
  });
});
