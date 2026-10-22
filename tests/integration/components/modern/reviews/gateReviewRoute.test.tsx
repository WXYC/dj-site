import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import {
  setUpClassicPageAuthority,
  setUpReviewsAccess,
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
vi.mock("@/lib/features/feature-access.server", async () => {
  const { featureAccessServerMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return featureAccessServerMock();
});

vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

import { gateReviewRoute } from "@/src/components/experiences/modern/reviews/gateReviewRoute";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

describe("gateReviewRoute", () => {
  setUpClassicPageAuthorityEnv();

  const arrange = (audience: "off" | "staff" | "everyone", canSee: boolean, role: Parameters<typeof setUpClassicPageAuthority>[0]) => {
    setUpReviewsAccess(audience, canSee);
    setUpClassicPageAuthority(role);
  };

  it.each([
    ["staff", "musicDirector"],
    ["staff", "stationManager"],
    ["everyone", "dj"],
  ] as const)("lets the page through when the Backend answers audience %s with access for a %s", async (audience, role) => {
    arrange(audience, true, role);

    expect(await gateReviewRoute()).toBeNull();
  });

  it("answers a DJ without access under staff with the staff-only line", async () => {
    arrange("staff", false, "dj");

    renderWithProviders((await gateReviewRoute())!);

    expect(screen.getByTestId("page-header")).toHaveTextContent(REVIEW_COPY.pageTitle);
    expect(screen.getByText(REVIEW_COPY.staffOnly)).toBeInTheDocument();
    // The station approved this line on 2026-10-07; pin its words, not just the constant.
    expect(REVIEW_COPY.staffOnly).toBe(
      "Reviews are open to music directors for now. You'll be able to open this review when they open to every DJ.",
    );
  });

  it.each([
    ["staff", "member"],
    ["everyone", "member"],
    ["off", "dj"],
    ["off", "musicDirector"],
    ["off", "stationManager"],
    ["everyone", "dj"],
  ] as const)("is not found when the Backend answers audience %s without access for a %s", async (audience, role) => {
    arrange(audience, false, role);

    await assertNotFoundPage(() => gateReviewRoute());
  });
});
