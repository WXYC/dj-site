import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { CssVarsProvider } from "@mui/joy/styles";
import type { ReactElement } from "react";
import { Authorization } from "@/lib/features/admin/types";
import modernTheme from "@/lib/features/experiences/modern/theme";
import { fakeReviewsEndpoints, fccNote, intakeItem, renderWithProviders, review } from "@/tests/helpers";
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

import FccNotesPanel from "@/src/components/experiences/modern/reviews/FccNotesPanel";
import IntakeItemScreen from "@/src/components/experiences/modern/reviews/IntakeItemScreen";
import ReviewEditor from "@/src/components/experiences/modern/reviews/ReviewEditor";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const ITEM_ID = 11;
const AUTHORED = review({ id: 40, author_user_id: "md-me", status: "submitted", in_use: false });

const serveEditor = () => {
  fakeReviewsEndpoints({ reviews: [AUTHORED], records: [intakeItem({ id: 2 })] });
  return <ReviewEditor id={40} />;
};

// The record carries a review, so its page shows the record's Delete beside a Delete review by DJ Me.
const serveRecord = () => {
  fakeRotationCardsEndpoints([{ id: 32, bin: "H", number: 2, name: null }]);
  fakeReviewsEndpoints({
    records: [intakeItem({ id: ITEM_ID, state: "reviewed", effective_state: "reviewed", submitted_review_count: 1 })],
    forItem: { [ITEM_ID]: [review({ id: 41, intake_item_id: ITEM_ID, status: "submitted", author: "DJ Me" })] },
  });
  return <IntakeItemScreen id={ITEM_ID} />;
};

const FCC_ALBUM_ID = 7;

// A note reported by "dj-me", viewed either by the reporter (who can take it back) or by a music director (who can remove it).
const serveFccNote = (viewer: { id: string; authority: Authorization }) => () => {
  mockAuth.id = viewer.id;
  mockAuth.authority = viewer.authority;
  // The reporter is a plain DJ, and the "staff" setting hides the reviews screens from DJs.
  vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
  fakeReviewsEndpoints({
    fccNotesForRelease: { [FCC_ALBUM_ID]: [fccNote({ status: "reported", reported_by_user_id: "dj-me", album_id: FCC_ALBUM_ID })] },
  });
  return <FccNotesPanel albumId={FCC_ALBUM_ID} />;
};

describe("the review screens' delete triggers", () => {
  beforeEach(() => {
    mockAuth.id = "md-me";
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["the editor's Delete", REVIEW_COPY.delete, REVIEW_COPY.delete, serveEditor],
    ["a record page's Delete review", REVIEW_COPY.intakeItem.deleteReviewBy("DJ Me"), REVIEW_COPY.delete, serveRecord],
    ["a record page's Delete for the record itself", REVIEW_COPY.intakeItem.delete, REVIEW_COPY.delete, serveRecord],
    ["an FCC note's Remove for the reporter", REVIEW_COPY.fccNotes.removeMine, REVIEW_COPY.fccNotes.remove, serveFccNote({ id: "dj-me", authority: Authorization.DJ })],
    ["an FCC note's Remove for a music director", REVIEW_COPY.fccNotes.remove, REVIEW_COPY.fccNotes.remove, serveFccNote({ id: "md-me", authority: Authorization.MD })],
  ])("%s is plain neutral text, and its confirmation's button is solid danger", async (_name, name, confirmName, serve: () => ReactElement) => {
    const { user } = renderWithProviders(<CssVarsProvider theme={modernTheme}>{serve()}</CssVarsProvider>);

    const trigger = await screen.findByRole("button", { name });
    expect(trigger).toHaveClass("MuiButton-colorNeutral", "MuiButton-variantPlain");
    expect(trigger).not.toHaveClass("MuiButton-colorDanger");

    await user.click(trigger);
    const confirm = within(await screen.findByRole("alertdialog")).getByRole("button", { name: confirmName });
    expect(confirm).toHaveClass("MuiButton-colorDanger", "MuiButton-variantSolid");
  });

  it("keeps the editor's Submit confirmation primary, since its confirm button is shared with Delete", async () => {
    fakeReviewsEndpoints({ reviews: [review({ id: 40, author_user_id: "md-me", status: "draft" })], records: [intakeItem({ id: 2 })] });
    const { user } = renderWithProviders(<CssVarsProvider theme={modernTheme}><ReviewEditor id={40} /></CssVarsProvider>);

    await user.click(await screen.findByRole("button", { name: REVIEW_COPY.submit }));
    const confirm = within(await screen.findByRole("alertdialog")).getByRole("button", { name: REVIEW_COPY.submit });
    expect(confirm).toHaveClass("MuiButton-colorPrimary", "MuiButton-variantSolid");
    expect(confirm).not.toHaveClass("MuiButton-colorDanger");
  });
});
