import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, pendingCount, renderedFrame, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

// "Write a review" opens the new draft through the app router.
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() });
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import ReviewsScreen from "@/src/components/experiences/modern/reviews/ReviewsScreen";

// The two tabs side by side: these specs cover the lanes and the writes between them, and each tab's own content is pinned in ReviewsScreen.tabs.test.tsx.
function BothTabs() {
  return (
    <>
      <ReviewsScreen tab="shelf" />
      <ReviewsScreen tab="mine" />
    </>
  );
}

const ON_SHELF = intakeItem({ id: 5 });

describe("ReviewsScreen — a row stays locked until every rendered list has reloaded", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true"));
  afterEach(() => vi.unstubAllEnvs());

  it("holds the row while the intake list's reload is still in flight", async () => {
    let written = false;
    let releaseHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    let heldReads = 0;
    let otherReads = 0;
    fakeReviewsEndpoints({ open: [ON_SHELF] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews`, () => {
        if (written) otherReads += 1;
        return HttpResponse.json([]);
      }),
      http.get(`${TEST_BACKEND_URL}/intake`, async () => {
        if (written) {
          heldReads += 1;
          await held;
        }
        return HttpResponse.json([ON_SHELF]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () => {
        written = true;
        return HttpResponse.json({ ...ON_SHELF, state: "checked_out" });
      }),
    );

    const { user, store } = renderWithProviders(<BothTabs />);
    const shelf = await screen.findByRole("region", { name: "The review shelf" });
    const checkout = within(shelf).getByRole("button", { name: "Check out" });
    await user.click(checkout);

    // Assert during the hold, once every other read has answered and only the held one is outstanding.
    await waitFor(() => expect(heldReads).toBeGreaterThan(0));
    await waitFor(() => expect(pendingCount(store)).toBe(1));
    await renderedFrame();
    // A write on the review shelf also reloads My reviews, which the tab strip's count is drawn from; that read has answered.
    expect(otherReads).toBeGreaterThan(0);
    expect(checkout).toBeDisabled();

    releaseHeld();
    await waitFor(() => expect(checkout).toBeEnabled());
  });

  it("reloads My reviews after a write on the review shelf tab, because the tab strip's count on My reviews is drawn from it", async () => {
    let written = false;
    let reviewReadsAfterWrite = 0;
    let intakeReadsAfterWrite = 0;
    fakeReviewsEndpoints({ open: [ON_SHELF] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews`, () => {
        if (written) {
          reviewReadsAfterWrite += 1;
        }
        return HttpResponse.json([]);
      }),
      http.get(`${TEST_BACKEND_URL}/intake`, () => {
        if (written) {
          intakeReadsAfterWrite += 1;
        }
        return HttpResponse.json([ON_SHELF]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () => {
        written = true;
        return HttpResponse.json({ ...ON_SHELF, state: "checked_out" });
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen tab="shelf" />);
    const shelf = await screen.findByRole("region", { name: "The review shelf" });
    const checkout = within(shelf).getByRole("button", { name: "Check out" });
    await user.click(checkout);

    await waitFor(() => expect(intakeReadsAfterWrite).toBeGreaterThan(0));
    await waitFor(() => expect(reviewReadsAfterWrite).toBeGreaterThan(0));
    await waitFor(() => expect(checkout).toBeEnabled());
  });

  it("keeps a request I started a review on locked as a record I'm reviewing until My reviews has reloaded", async () => {
    let written = false;
    let releaseHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    let heldReads = 0;
    let intakeReloads = 0;
    const CHECKED_OUT = intakeItem({ id: 5, state: "checked_out", effective_state: "checked_out", checked_out_by: "dj-me", checked_out_at: "2026-09-02T12:00:00Z" });
    const ASKED = intakeItem({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: "dj-me", requested_at: "2026-09-02T12:00:00Z" });
    fakeReviewsEndpoints({ open: [ASKED] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews`, async () => {
        if (written) {
          heldReads += 1;
          await held;
        }
        return HttpResponse.json([]);
      }),
      http.get(`${TEST_BACKEND_URL}/intake`, () => {
        if (written) {
          intakeReloads += 1;
        }
        return HttpResponse.json([written ? CHECKED_OUT : ASKED]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/5/accept`, () => {
        written = true;
        return HttpResponse.json(CHECKED_OUT);
      }),
    );

    const { user, store } = renderWithProviders(<ReviewsScreen tab="mine" />);
    const requests = await screen.findByRole("tabpanel", { name: "Open reviews" });
    await user.click(await within(requests).findByRole("button", { name: "Write a review" }));

    // The intake read has landed and turned the request into a record I'm reviewing; the My reviews read is still held.
    const checkouts = await screen.findByRole("tabpanel", { name: "Open reviews" });
    const writeReview = await within(checkouts).findByRole("button", { name: "Write a review" });
    await waitFor(() => expect(intakeReloads).toBeGreaterThan(0));
    await waitFor(() => expect(heldReads).toBeGreaterThan(0));
    await waitFor(() => expect(pendingCount(store)).toBe(1));
    await renderedFrame();
    expect(writeReview).toBeDisabled();
    expect(within(checkouts).getByRole("button", { name: "Return to the review shelf" })).toBeDisabled();

    releaseHeld();
    await waitFor(() => expect(writeReview).toBeEnabled());
  });

  it("reads intake once on load, and finds a reviewed checkout in that one read", async () => {
    const intakeReads: string[] = [];
    fakeReviewsEndpoints({
      open: [ON_SHELF],
      reviewed: [intakeItem({ id: 8, artist_name: "Cat Power", state: "reviewed", effective_state: "reviewed", checked_out_by: "dj-me", checked_out_at: "2026-09-02T12:00:00Z" })],
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        intakeReads.push(new URL(request.url).search);
      }),
    );

    renderWithProviders(<BothTabs />);
    const checkouts = await screen.findByRole("tabpanel", { name: "Open reviews" });
    await within(checkouts).findByText(/Cat Power/);
    expect(intakeReads).toEqual([""]);
  });
});
