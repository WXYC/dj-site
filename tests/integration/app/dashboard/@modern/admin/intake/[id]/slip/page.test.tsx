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
vi.mock("@/src/components/experiences/modern/reviews/IntakeSlipScreen", () => ({
  default: ({ id }: { id: number }) => <div data-testid="intake-slip-screen" data-id={id} />,
}));

import IntakeSlipPage from "@/app/dashboard/@modern/admin/intake/[id]/slip/page";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("slip page", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    ["off", "musicDirector"],
    ["off", "stationManager"],
    ["staff", "dj"],
  ] as const)("is not found when the Backend answers audience %s without access for a %s", async (audience, role) => {
    setUpReviewsAccess(audience, false);
    setUpClassicPageAuthority(role);

    await assertNotFoundPage(() => IntakeSlipPage(params("11")));
  });

  it("sends a DJ home when reviews are open to every DJ", async () => {
    setUpReviewsAccess("everyone", true);
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => IntakeSlipPage(params("11")));
  });

  it.each(["abc", "0", "-3", "1.5"])("is not found for the id %s", async (id) => {
    setUpReviewsAccess("staff", true);
    setUpClassicPageAuthority("musicDirector");

    await assertNotFoundPage(() => IntakeSlipPage(params(id)));
  });

  it("renders the slip screen for a music director", async () => {
    setUpReviewsAccess("staff", true);
    setUpClassicPageAuthority("musicDirector");

    renderWithProviders(await IntakeSlipPage(params("11")));

    expect(screen.getByTestId("page-header")).toHaveTextContent("Print the slip");
    expect(screen.getByTestId("intake-slip-screen")).toHaveAttribute("data-id", "11");
  });
});
