import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import {
  setUpClassicPageAuthority,
  setUpClassicPageAuthorityEnv,
  assertNotFoundPage,
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

// The page's own responsibility under test is the flag + auth gate, not the
// header chrome.
vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

import ReviewsPage from "@/app/dashboard/@modern/reviews/page";

describe("reviews page", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    [undefined, "dj"],
    [undefined, "musicDirector"],
    [undefined, "stationManager"],
    ["false", "stationManager"],
    ["staff", "dj"],
  ] as const)("is not found when the flag is %s for a %s", async (flag, role) => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
    else process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    setUpClassicPageAuthority(role);

    await assertNotFoundPage(() => ReviewsPage());
  });

  it.each([
    ["staff", "musicDirector"],
    ["staff", "stationManager"],
    ["true", "dj"],
    ["1", "dj"],
  ] as const)("renders the Reviews shell when the flag is %s for a %s", async (flag, role) => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    setUpClassicPageAuthority(role);

    renderWithProviders(await ReviewsPage());

    expect(screen.getByTestId("page-header")).toHaveTextContent("Reviews");
  });
});
