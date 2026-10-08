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

  it.each([
    ["open", null],
    ["reviewed", "reviewed"],
  ])("holds the row while the %s list's reload is still in flight", async (_list, heldState) => {
    let written = false;
    let releaseHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    let heldReads = 0;
    fakeReviewsEndpoints({ open: [ON_SHELF] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        const state = new URL(request.url).searchParams.get("state");
        if (written && state === heldState) {
          heldReads += 1;
          await held;
        }
        return HttpResponse.json(state === "reviewed" ? [] : [ON_SHELF]);
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

    // The other list has long since landed; only the held one is outstanding.
    await waitFor(() => expect(heldReads).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(checkout).toBeDisabled();

    releaseHeld();
    await waitFor(() => expect(checkout).toBeEnabled());
  });
});
