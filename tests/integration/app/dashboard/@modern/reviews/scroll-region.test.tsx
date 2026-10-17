import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { scrollsVertically } from "@/tests/helpers/scroll";
import { setUpClassicPageAuthority, setUpClassicPageAuthorityEnv } from "@/tests/helpers/classic-page-authority-harness";

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

vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: () => <div data-testid="page-header" />,
}));
vi.mock("@/src/components/experiences/modern/reviews/IntakeItemScreen", () => ({ default: () => <div data-testid="screen" /> }));
vi.mock("@/src/components/experiences/modern/reviews/IntakeSlipScreen", () => ({ default: () => <div data-testid="screen" /> }));
vi.mock("@/src/components/experiences/modern/reviews/ReleaseSlipScreen", () => ({ default: () => <div data-testid="screen" /> }));
vi.mock("@/src/components/experiences/modern/reviews/NewReview", () => ({ default: () => <div data-testid="screen" /> }));
vi.mock("@/src/components/experiences/modern/reviews/ReviewEditor", () => ({ default: () => <div data-testid="screen" /> }));
vi.mock("@/src/components/experiences/modern/reviews/ReviewHistory", () => ({ default: () => <div data-testid="screen" /> }));

import IntakeItemPage from "@/app/dashboard/@modern/admin/intake/[id]/page";
import IntakeSlipPage from "@/app/dashboard/@modern/admin/intake/[id]/slip/page";
import ReleaseSlipPage from "@/app/dashboard/@modern/admin/library/[albumId]/slip/[reviewId]/page";
import NewReviewPage from "@/app/dashboard/@modern/reviews/new/page";
import ReviewEditorPage from "@/app/dashboard/@modern/reviews/[id]/page";
import ReviewHistoryPage from "@/app/dashboard/@modern/reviews/[id]/history/page";

const params = { params: Promise.resolve({ id: "11" }) };

describe("review pages scroll inside Main", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    ["the record's page", true, () => IntakeItemPage(params)],
    ["the print page", true, () => IntakeSlipPage(params)],
    ["the album's print page", true, () => ReleaseSlipPage({ params: Promise.resolve({ albumId: "7", reviewId: "11" }) })],
    ["a new review", true, () => NewReviewPage({ searchParams: Promise.resolve({ album_id: "7" }) })],
    // The editor draws no page header: its record heading is the title.
    ["the review editor", false, () => ReviewEditorPage(params)],
    ["a review's history", true, () => ReviewHistoryPage(params)],
  ])("%s renders its screen in one scroll region, with a page header outside it only where it draws one", async (_name, hasHeader, open) => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("musicDirector");

    renderWithProviders(await open());

    const region = screen.getByTestId("screen").parentElement!;
    expect(region).toHaveStyle({ flex: "1", minHeight: "0px", overflow: "auto" });
    const header = screen.queryByTestId("page-header");
    if (hasHeader) {
      expect(header).toBeInTheDocument();
      expect(region).not.toContainElement(header);
    } else {
      expect(header).not.toBeInTheDocument();
    }
    for (let el = region.parentElement; el; el = el.parentElement) {
      expect(scrollsVertically(el)).toBe(false);
    }
  });
});
