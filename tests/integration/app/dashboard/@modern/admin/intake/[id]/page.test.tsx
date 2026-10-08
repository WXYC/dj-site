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
vi.mock("@/src/components/experiences/modern/reviews/IntakeItemScreen", () => ({
  default: ({ id }: { id: number }) => <div data-testid="intake-item-screen" data-id={id} />,
}));

import IntakeItemPage from "@/app/dashboard/@modern/admin/intake/[id]/page";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("review shelf record page", () => {
  setUpClassicPageAuthorityEnv();

  it.each([
    [undefined, "musicDirector"],
    ["false", "stationManager"],
    ["staff", "dj"],
  ] as const)("is not found when the flag is %s for a %s", async (flag, role) => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
    else process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    setUpClassicPageAuthority(role);

    await assertNotFoundPage(() => IntakeItemPage(params("11")));
  });

  it("sends a DJ home when the flag is open to every DJ", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    setUpClassicPageAuthority("dj");

    await assertDeniedClassicPage(() => IntakeItemPage(params("11")));
  });

  it.each(["abc", "0", "-3", "1.5"])("is not found for the id %s", async (id) => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "staff";
    setUpClassicPageAuthority("musicDirector");

    await assertNotFoundPage(() => IntakeItemPage(params(id)));
  });

  it("renders the record's screen for a music director", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "staff";
    setUpClassicPageAuthority("musicDirector");

    renderWithProviders(await IntakeItemPage(params("11")));

    expect(screen.getByTestId("page-header")).toHaveTextContent("Review shelf");
    expect(screen.getByTestId("intake-item-screen")).toHaveAttribute("data-id", "11");
  });
});
