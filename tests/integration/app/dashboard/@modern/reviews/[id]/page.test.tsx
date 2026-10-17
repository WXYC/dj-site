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

// The page's own responsibility under test is its id check and what it renders
// once the gate passes, not the editor or the header chrome.
vi.mock("@/src/components/experiences/modern/reviews/ReviewEditor", () => ({
  default: ({ id }: { id: number }) => <div data-testid="editor">{id}</div>,
}));

import ReviewEditorPage, { metadata } from "@/app/dashboard/@modern/reviews/[id]/page";
import { getPageTitle } from "@/lib/utils/page-title";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

describe("review editor page", () => {
  setUpClassicPageAuthorityEnv();

  const open = (id = "40") => ReviewEditorPage({ params: Promise.resolve({ id }) });

  it("renders the editor once the gate passes", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    renderWithProviders(await open());

    expect(screen.getByTestId("editor")).toHaveTextContent("40");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("titles the tab from the copy module", () => {
    expect(metadata.title).toBe(getPageTitle(REVIEW_COPY.pageTitle));
  });

  it("goes through the gate: a DJ under staff sees the staff-only line and no editor", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "staff";
    setUpClassicPageAuthority("dj");

    renderWithProviders(await open());

    expect(screen.getByText(REVIEW_COPY.staffOnly)).toBeInTheDocument();
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
  });

  it("is not found for an id that is not a positive integer", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    await assertNotFoundPage(() => open("abc"));
  });
});
