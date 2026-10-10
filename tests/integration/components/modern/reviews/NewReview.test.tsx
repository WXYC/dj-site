import { describe, it, expect, vi, beforeEach, onTestFinished } from "vitest";
import { configure, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, renderWithProviders, review, reviewsSettled, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});

const mockAuth = vi.hoisted(() => ({ authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: mockAuth.authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import { toast } from "sonner";
import NewReview from "@/src/components/experiences/modern/reviews/NewReview";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

describe("NewReview", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    vi.clearAllMocks();
    fakeReviewsEndpoints();
  });

  it("starts a draft for the library release and opens it in the editor", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${TEST_BACKEND_URL}/reviews`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(review({ id: 55, intake_item_id: null, album_id: 7 }), { status: 201 });
      }),
    );

    renderWithProviders(<NewReview albumId={7} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews/55"));
    expect(bodies).toEqual([{ album_id: 7 }]);
  });

  it("starts exactly one draft when its effect runs twice", async () => {
    // Strict Mode runs every effect twice on mount. renderWithProviders does not
    // wrap in it (next.config has reactStrictMode: false too), so turn on Testing
    // Library's own wrapper, which sits outside the providers, for this test only.
    configure({ reactStrictMode: true });
    onTestFinished(() => configure({ reactStrictMode: false }));
    const bodies: unknown[] = [];
    server.use(
      http.post(`${TEST_BACKEND_URL}/reviews`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(review({ id: 55, intake_item_id: null, album_id: 7 }), { status: 201 });
      }),
    );

    const { store } = renderWithProviders(<NewReview albumId={7} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews/55"));
    await reviewsSettled(store);
    expect(bodies).toEqual([{ album_id: 7 }]);
  });

  it("returns to the reviews screen with the approved line on 409 subject_not_held, never the server's message", async () => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/reviews`, () =>
        HttpResponse.json({ message: "Server wording that must not appear", reason: "subject_not_held" }, { status: 409 }),
      ),
    );

    renderWithProviders(<NewReview albumId={7} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews"));
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith("You no longer have this record checked out, so a review can't be started here.");
    expect(REVIEW_COPY.subjectNotHeld).toBe("You no longer have this record checked out, so a review can't be started here.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says it could not start on any other failure", async () => {
    server.use(http.post(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json({ message: "down" }, { status: 500 })));

    renderWithProviders(<NewReview albumId={7} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REVIEW_COPY.couldNotStart));
    expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews");
  });

  it.each([
    ["the flag is off", "", Authorization.MD],
    ["a DJ is under staff", "staff", Authorization.DJ],
  ])("renders nothing and creates no draft when %s", async (_label, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    let posted = false;
    server.use(http.post(`${TEST_BACKEND_URL}/reviews`, () => ((posted = true), HttpResponse.json(review(), { status: 201 }))));

    const { container, store } = renderWithProviders(<NewReview albumId={7} />);
    await reviewsSettled(store);

    expect(posted).toBe(false);
    expect(container).toBeEmptyDOMElement();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
