import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { fakeReviewsEndpoints, heldBy, intakeItem, renderWithProviders, requestedFor, review } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import MyReviewsScreen from "@/src/components/experiences/modern/reviews/MyReviewsScreen";
import ReviewShelfScreen from "@/src/components/experiences/modern/reviews/ReviewShelfScreen";
import { useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() }, { search: () => url.search });
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

// The screens take the reviewers read and the shared write wiring from their caller, as ReviewsScreen supplies them.
function Shelf(props: Omit<ComponentProps<typeof ReviewShelfScreen>, "write" | "lock" | "reviewers">) {
  const reviewers = useGetReviewersQuery(undefined, { skip: !props.isMD });
  const { write, lock } = useReviewWrite(props.items);
  return <ReviewShelfScreen {...props} reviewers={reviewers} write={write} lock={lock} />;
}

function Mine(props: Omit<ComponentProps<typeof MyReviewsScreen>, "write" | "lock">) {
  const { write, lock } = useReviewWrite(props.items);
  return <MyReviewsScreen {...props} write={write} lock={lock} />;
}

const COVER_URL = "https://img.example/aluminum-tunes.jpg";
const requested = intakeItem({ id: 5, state: "requested", effective_state: "requested", ...requestedFor("dj-me", "DJ Me") });
const checkedOut = intakeItem({ id: 6, state: "checked_out", effective_state: "checked_out", ...heldBy("dj-me", "DJ Me") });

describe("the cover size each screen gives its rows", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    url.search = "";
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  // The review shelf is a region; the music directors' and My reviews' stages are a tabpanel named by the selected chip.
  it.each<[string, "region" | "tabpanel", string, 72 | 56, ReactElement, Parameters<typeof fakeReviewsEndpoints>[0], string?]>([
    ["the review shelf", "region", REVIEW_COPY.screen.shelfTitle, 72, <Shelf key="shelf" items={[intakeItem({ id: 4 })]} isMD={false} />, {}],
    ["a music directors' stage", "tabpanel", REVIEW_COPY.intake.requested, 56, <IntakeLanes key="md" />, { open: [requested] }, "?stage=requested"],
    ["Open reviews, a request", "tabpanel", REVIEW_COPY.myReviews.stages.open, 72, <Mine key="requests" items={[requested]} myReviews={[]} me="dj-me" />, {}],
    ["Open reviews, a record the DJ has", "tabpanel", REVIEW_COPY.myReviews.stages.open, 72, <Mine key="checkouts" items={[checkedOut]} myReviews={[]} me="dj-me" />, {}],
    ["Open reviews, a draft", "tabpanel", REVIEW_COPY.myReviews.stages.open, 72, <Mine key="draft" items={[]} myReviews={[review({ intake_item_id: 2 })]} me="dj-me" />, { records: [intakeItem({ id: 2 })] }],
    ["Submitted", "tabpanel", REVIEW_COPY.myReviews.stages.submitted, 56, <Mine key="submitted" items={[]} myReviews={[review({ intake_item_id: 2, status: "submitted", in_use: false, submitted_at: "2026-10-08T12:00:00Z" })]} me="dj-me" />, { records: [intakeItem({ id: 2 })] }],
  ])("draws the row in %s (%s %s) with its cover at %i px", async (_screen, role, lane, size, ui, endpoints, search = "") => {
    url.search = search;
    fakeReviewsEndpoints({ ...endpoints, artworkUrl: COVER_URL });
    renderWithProviders(ui);

    const region = await screen.findByRole(role, { name: lane });
    await waitFor(() => expect(region.querySelector("img")).toHaveAttribute("src", COVER_URL));
    expect(region.querySelector("img")).toHaveStyle({ width: `${size}px`, height: `${size}px` });
    expect(within(region).getByText("Stereolab")).toBeInTheDocument();
  });
});
