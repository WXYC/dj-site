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
vi.mock("@/src/components/experiences/modern/reviews/IntakeItemScreen", () => ({
  default: ({ id }: { id: number }) => <div data-testid="intake-item-screen" data-id={id} />,
}));

import IntakeItemPage, { metadata } from "@/app/dashboard/@modern/admin/intake/[id]/page";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("review shelf record page", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    ["off", "musicDirector"],
    ["off", "stationManager"],
    ["staff", "dj"],
  ] as const)("is not found when the Backend answers audience %s without access for a %s", async (audience, role) => {
    setUpReviewsAccess(audience, false);
    setUpClassicPageAuthority(role);

    await assertNotFoundPage(() => IntakeItemPage(params("11")));
  });

  it("sends a DJ home when reviews are open to every DJ", async () => {
    setUpReviewsAccess("everyone", true);
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => IntakeItemPage(params("11")));
  });

  it.each(["abc", "0", "-3", "1.5"])("is not found for the id %s", async (id) => {
    setUpReviewsAccess("staff", true);
    setUpClassicPageAuthority("musicDirector");

    await assertNotFoundPage(() => IntakeItemPage(params(id)));
  });

  it("renders the record's screen for a music director", async () => {
    setUpReviewsAccess("staff", true);
    setUpClassicPageAuthority("musicDirector");

    renderWithProviders(await IntakeItemPage(params("11")));

    expect(screen.getByTestId("page-header")).toHaveTextContent("Reviews");
    expect(screen.getByTestId("intake-item-screen")).toHaveAttribute("data-id", "11");
  });

  it("titles the tab Reviews", () => {
    expect(metadata.title).toBe("WXYC | Reviews");
  });
});
