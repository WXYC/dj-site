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

vi.mock("@/src/components/experiences/modern/reviews/ReviewHistory", () => ({
  default: ({ id }: { id: number }) => <div data-testid="history">{id}</div>,
}));

vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

import ReviewHistoryPage, { metadata } from "@/app/dashboard/@modern/reviews/[id]/history/page";
import { getPageTitle } from "@/lib/utils/page-title";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

describe("review history page", () => {
  setUpClassicPageAuthorityEnv();

  const open = (id = "40") => ReviewHistoryPage({ params: Promise.resolve({ id }) });

  it("renders the history once the gate passes", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    renderWithProviders(await open());

    expect(screen.getByTestId("history")).toHaveTextContent("40");
    expect(screen.getByTestId("page-header")).toHaveTextContent(REVIEW_COPY.history.link);
  });

  it("titles the tab from the copy module", () => {
    expect(metadata.title).toBe(getPageTitle(REVIEW_COPY.history.link));
  });

  it("goes through the gate: a DJ under staff sees the staff-only line and no history", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "staff";
    setUpClassicPageAuthority("dj");

    renderWithProviders(await open());

    expect(screen.getByText(REVIEW_COPY.staffOnly)).toBeInTheDocument();
    expect(screen.queryByTestId("history")).not.toBeInTheDocument();
  });

  it("is not found for an id that is not a positive integer", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    await assertNotFoundPage(() => open("abc"));
  });
});
