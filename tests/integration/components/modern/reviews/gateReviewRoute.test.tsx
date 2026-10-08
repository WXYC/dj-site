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

vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

import { gateReviewRoute } from "@/src/components/experiences/modern/reviews/gateReviewRoute";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

describe("gateReviewRoute", () => {
  setUpClassicPageAuthorityEnv();

  const arrange = (flag: string | undefined, role: Parameters<typeof setUpClassicPageAuthority>[0]) => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
    else process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    setUpClassicPageAuthority(role);
  };

  it.each([
    ["staff", "musicDirector"],
    ["staff", "stationManager"],
    ["true", "dj"],
    ["1", "dj"],
  ] as const)("lets the page through when the flag is %s for a %s", async (flag, role) => {
    arrange(flag, role);

    expect(await gateReviewRoute()).toBeNull();
  });

  it("answers a DJ under staff with the staff-only line", async () => {
    arrange("staff", "dj");

    renderWithProviders((await gateReviewRoute())!);

    expect(screen.getByTestId("page-header")).toHaveTextContent(REVIEW_COPY.pageTitle);
    expect(screen.getByText(REVIEW_COPY.staffOnly)).toBeInTheDocument();
  });

  it.each([
    ["staff", "member"],
    ["true", "member"],
    [undefined, "dj"],
    [undefined, "musicDirector"],
    [undefined, "stationManager"],
    ["false", "stationManager"],
  ] as const)("is not found when the flag is %s for a %s", async (flag, role) => {
    arrange(flag, role);

    await assertNotFoundPage(() => gateReviewRoute() as Promise<never>);
  });
});
