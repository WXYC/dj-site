import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import {
  setUpClassicPageAuthority,
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

// Under test is the layout's own gate, not the strip's rendering.
vi.mock("@/src/components/experiences/modern/reviews/ReviewsTabs", () => ({
  default: () => <div data-testid="reviews-tabs" />,
}));

import ReviewsListsLayout from "@/app/dashboard/@modern/reviews/(lists)/layout";

describe("reviews lists layout", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    [undefined, "dj", false],
    [undefined, "musicDirector", false],
    ["false", "stationManager", false],
    ["staff", "dj", false],
    ["staff", "musicDirector", true],
    ["staff", "stationManager", true],
    ["true", "dj", false],
    ["true", "musicDirector", true],
    ["true", "stationManager", true],
  ] as const)("with the flag %s for a %s, the strip is drawn: %s; children render and nobody is refused", async (flag, role, strip) => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
    else process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    setUpClassicPageAuthority(role);

    renderWithProviders(await ReviewsListsLayout({ children: <div data-testid="child-page" /> }));

    expect(screen.queryByTestId("reviews-tabs") !== null).toBe(strip);
    expect(screen.getByTestId("child-page")).toBeInTheDocument();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("scrolls the page content and leaves the strip pinned outside the scroll region", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("musicDirector");

    renderWithProviders(await ReviewsListsLayout({ children: <div data-testid="child-page" /> }));

    const region = screen.getByTestId("child-page").parentElement!;
    expect(region).toHaveStyle({ flex: "1", minHeight: "0px", overflow: "auto" });
    expect(region).not.toContainElement(screen.getByTestId("reviews-tabs"));
  });

  it("gives a DJ the same scroll region", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    renderWithProviders(await ReviewsListsLayout({ children: <div data-testid="child-page" /> }));

    expect(screen.getByTestId("child-page").parentElement).toHaveStyle({ overflow: "auto" });
  });
});
