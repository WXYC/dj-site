import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import {
  setUpClassicPageAuthority,
  setUpReviewsAccess,
  setUpClassicPageAuthorityEnv,
  assertDeniedClassicPage,
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
vi.mock("@/lib/features/feature-access.server", async () => {
  const { featureAccessServerMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return featureAccessServerMock();
});

// The page's own responsibility under test is the flag + role gate and what it mounts.
vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));
vi.mock("@/src/components/experiences/modern/reviews/IntakeLanes", () => ({
  default: (props: object) => <div data-testid="intake-lanes" data-props={JSON.stringify(props)} />,
}));

import MusicDirectorsPage from "@/app/dashboard/@modern/reviews/(lists)/music-directors/page";

describe("reviews music directors page", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    ["off", "musicDirector"],
    ["off", "dj"],
    ["off", "stationManager"],
    ["staff", "dj"],
  ] as const)("is not found when the Backend answers audience %s without access for a %s", async (audience, role) => {
    setUpReviewsAccess(audience, false);
    setUpClassicPageAuthority(role);

    await assertNotFoundPage(() => MusicDirectorsPage());
  });

  it("sends a DJ home when reviews are open to every DJ", async () => {
    setUpReviewsAccess("everyone", true);
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => MusicDirectorsPage());
  });

  it.each([
    ["staff", "musicDirector"],
    ["staff", "stationManager"],
    ["everyone", "musicDirector"],
    ["everyone", "stationManager"],
  ] as const)("renders the bare lanes alone, with no page heading and no form of its own, when the Backend answers audience %s with access for a %s", async (audience, role) => {
    setUpReviewsAccess(audience, true);
    setUpClassicPageAuthority(role);

    renderWithProviders(await MusicDirectorsPage());

    expect(screen.queryByTestId("page-header")).not.toBeInTheDocument();
    expect(screen.getByTestId("intake-lanes")).toHaveAttribute("data-props", "{}");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});
