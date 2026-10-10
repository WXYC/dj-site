import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import {
  setUpClassicPageAuthority,
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

// The page's own responsibility under test is the flag + role gate.
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
    [undefined, "musicDirector"],
    [undefined, "dj"],
    ["false", "stationManager"],
    ["staff", "dj"],
  ] as const)("is not found when the flag is %s for a %s", async (flag, role) => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
    else process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    setUpClassicPageAuthority(role);

    await assertNotFoundPage(() => MusicDirectorsPage());
  });

  it("sends a DJ home when the flag is open to every DJ", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => MusicDirectorsPage());
  });

  it.each([
    ["staff", "musicDirector"],
    ["staff", "stationManager"],
    ["true", "musicDirector"],
    ["true", "stationManager"],
  ] as const)("renders the bare lanes under the Reviews heading when the flag is %s for a %s", async (flag, role) => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    setUpClassicPageAuthority(role);

    renderWithProviders(await MusicDirectorsPage());

    expect(screen.getByTestId("page-header")).toHaveTextContent("Reviews");
    expect(screen.getByTestId("intake-lanes")).toHaveAttribute("data-props", "{}");
  });
});
