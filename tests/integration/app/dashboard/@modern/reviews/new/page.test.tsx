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

// The page's own responsibility under test is its album_id check and what it
// renders once the gate passes, not the start flow or the header chrome.
vi.mock("@/src/components/experiences/modern/reviews/NewReview", () => ({
  default: ({ albumId }: { albumId: number }) => <div data-testid="new-review">{albumId}</div>,
}));

vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

import NewReviewPage, { metadata } from "@/app/dashboard/@modern/reviews/new/page";
import { getPageTitle } from "@/lib/utils/page-title";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

describe("new review page", () => {
  setUpClassicPageAuthorityEnv();

  const open = (query: { album_id?: string } = { album_id: "7" }) => NewReviewPage({ searchParams: Promise.resolve(query) });

  it("starts the review once the gate passes", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    renderWithProviders(await open());

    expect(screen.getByTestId("new-review")).toHaveTextContent("7");
    expect(screen.getByTestId("page-header")).toHaveTextContent(REVIEW_COPY.pageTitle);
  });

  it("titles the tab from the copy module", () => {
    expect(metadata.title).toBe(getPageTitle(REVIEW_COPY.pageTitle));
  });

  it("goes through the gate: a DJ under staff sees the staff-only line and nothing started", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "staff";
    setUpClassicPageAuthority("dj");

    renderWithProviders(await open());

    expect(screen.getByText(REVIEW_COPY.staffOnly)).toBeInTheDocument();
    expect(screen.queryByTestId("new-review")).not.toBeInTheDocument();
  });

  it("is not found for an album_id that is missing or not a positive integer", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    for (const bad of [{}, { album_id: "abc" }, { album_id: "0" }, { album_id: "-3" }]) {
      await assertNotFoundPage(() => open(bad));
    }
  });
});
