import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { CssVarsProvider } from "@mui/joy/styles";
import type { ReactElement } from "react";
import { Authorization } from "@/lib/features/admin/types";
import modernTheme from "@/lib/features/experiences/modern/theme";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, review } from "@/tests/helpers";
import { fakeRotationCardsEndpoints } from "@/tests/fakes/rotation";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: { listUsers: vi.fn() },
    useSession: () => ({
      data: { user: { id: "md-me", email: "md@wxyc.org", name: "MD", username: "md", role: null, emailVerified: true } },
      isPending: false,
      error: null,
    }),
  },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));
vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn().mockResolvedValue("musicDirector"),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));
vi.mock("next/font/google", () => ({ Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }) }));
vi.mock("next/font/local", () => ({ default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }) }));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import DeleteReviewButton from "@/src/components/experiences/modern/reviews/DeleteReviewButton";
import IntakeItemScreen from "@/src/components/experiences/modern/reviews/IntakeItemScreen";
import ReviewEditor from "@/src/components/experiences/modern/reviews/ReviewEditor";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const ITEM_ID = 11;
const AUTHORED = review({ id: 40, author_user_id: "md-me", status: "submitted", in_use: false });

const serveEditor = () => {
  fakeReviewsEndpoints({ reviews: [AUTHORED], records: [intakeItem({ id: 2 })] });
  return <ReviewEditor id={40} />;
};

const serveButton = () => (
  <DeleteReviewButton
    review={AUTHORED}
    confirmation="Delete this review?"
    blocked={false}
    disabled={false}
    reload={async () => ({ mounted: true })}
    onWritten={async () => {}}
    onNotice={() => {}}
  />
);

const serveRecord = () => {
  fakeRotationCardsEndpoints([{ id: 32, bin: "H", number: 2, name: null }]);
  fakeReviewsEndpoints({ records: [intakeItem({ id: ITEM_ID, state: "reviewed", effective_state: "reviewed", submitted_review_count: 0 })] });
  return <IntakeItemScreen id={ITEM_ID} />;
};

describe("the review screens' delete triggers", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["the editor's Delete", REVIEW_COPY.delete, serveEditor],
    ["Delete review on a record's page", REVIEW_COPY.intakeItem.deleteReview, serveButton],
    ["Delete for the record itself", REVIEW_COPY.intakeItem.delete, serveRecord],
  ])("%s is plain neutral text, and its confirmation's Delete is solid danger", async (_name, label, serve: () => ReactElement) => {
    const { user } = renderWithProviders(<CssVarsProvider theme={modernTheme}>{serve()}</CssVarsProvider>);

    const trigger = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect(trigger).toHaveClass("MuiButton-colorNeutral", "MuiButton-variantPlain");
    expect(trigger).not.toHaveClass("MuiButton-colorDanger");

    await user.click(trigger);
    const confirm = within(await screen.findByRole("alertdialog")).getByRole("button", { name: REVIEW_COPY.delete });
    expect(confirm).toHaveClass("MuiButton-colorDanger", "MuiButton-variantSolid");
  });
});
