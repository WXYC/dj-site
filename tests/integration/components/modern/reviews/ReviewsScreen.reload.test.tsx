import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

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

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: 1 } },
    authenticating: false,
    authenticated: true,
  }),
}));

import ReviewsScreen from "@/src/components/experiences/modern/reviews/ReviewsScreen";

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
    fakeReviewsEndpoints({ open: [ON_SHELF] });
    server.use(
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

    const { user } = renderWithProviders(<ReviewsScreen />);
    const shelf = await screen.findByRole("region", { name: "The review shelf" });
    const checkout = within(shelf).getByRole("button", { name: "Check out" });
    await user.click(checkout);

    // The my-reviews list has long since landed; only the intake list is outstanding.
    await waitFor(() => expect(heldReads).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(checkout).toBeDisabled();

    releaseHeld();
    await waitFor(() => expect(checkout).toBeEnabled());
  });

  it("reads intake once on load, and finds a reviewed checkout in that one read", async () => {
    const intakeReads: string[] = [];
    fakeReviewsEndpoints({
      open: [ON_SHELF, intakeItem({ id: 8, artist_name: "Cat Power", state: "reviewed", effective_state: "reviewed", checked_out_by: "dj-me", checked_out_at: "2026-09-02T12:00:00Z" })],
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        intakeReads.push(new URL(request.url).search);
      }),
    );

    renderWithProviders(<ReviewsScreen />);
    const checkouts = await screen.findByRole("region", { name: "My checkouts" });
    await within(checkouts).findByText(/Cat Power/);
    expect(intakeReads).toEqual([""]);
  });
});
