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

// The page's own responsibility under test is the flag + role gate.
vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));
vi.mock("@/src/components/experiences/modern/reviews/ReleaseSlipScreen", () => ({
  default: ({ albumId, reviewId }: { albumId: number; reviewId: number }) => (
    <div data-testid="release-slip-screen" data-album-id={albumId} data-review-id={reviewId} />
  ),
}));

import ReleaseSlipPage from "@/app/dashboard/@modern/admin/library/[albumId]/slip/[reviewId]/page";

const params = (albumId: string, reviewId: string) => ({ params: Promise.resolve({ albumId, reviewId }) });

describe("release slip page", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    ["off", "musicDirector"],
    ["off", "stationManager"],
    ["staff", "dj"],
  ] as const)("is not found when the Backend answers audience %s without access for a %s", async (audience, role) => {
    setUpReviewsAccess(audience, false);
    setUpClassicPageAuthority(role);

    await assertNotFoundPage(() => ReleaseSlipPage(params("7", "40")));
  });

  it("sends a DJ home when reviews are open to every DJ", async () => {
    setUpReviewsAccess("everyone", true);
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => ReleaseSlipPage(params("7", "40")));
  });

  it.each([
    ["abc", "40"],
    ["0", "40"],
    ["7", "-3"],
    ["7", "1.5"],
  ])("is not found for the ids %s and %s", async (albumId, reviewId) => {
    setUpReviewsAccess("staff", true);
    setUpClassicPageAuthority("musicDirector");

    await assertNotFoundPage(() => ReleaseSlipPage(params(albumId, reviewId)));
  });

  it("renders the slip screen for a music director", async () => {
    setUpReviewsAccess("staff", true);
    setUpClassicPageAuthority("musicDirector");

    renderWithProviders(await ReleaseSlipPage(params("7", "40")));

    expect(screen.getByTestId("page-header")).toHaveTextContent("Print the slip");
    expect(screen.getByTestId("release-slip-screen")).toHaveAttribute("data-album-id", "7");
    expect(screen.getByTestId("release-slip-screen")).toHaveAttribute("data-review-id", "40");
  });
});
