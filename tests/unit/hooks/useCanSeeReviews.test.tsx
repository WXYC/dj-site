import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import type { ReactNode } from "react";
import { Provider } from "react-redux";

import { createTestStore } from "@/tests/helpers/store";
import { server } from "@/tests/fakes/server";
import { fakeReviewsAccess } from "@/tests/fakes/reviews/featureAccess";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";

vi.mock("@/lib/features/authentication/client", () => ({ getJWTToken: vi.fn().mockResolvedValue("test-token") }));
vi.mock("@/lib/error-reporting", () => ({ safeCaptureException: vi.fn() }));

const mount = (store = createTestStore()) =>
  renderHook(() => useCanSeeReviews(), {
    wrapper: ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>,
  });

describe("useCanSeeReviews", () => {
  it("hides the screens while the Backend has not answered", () => {
    server.use(http.get(`${TEST_BACKEND_URL}/feature-access`, () => new Promise(() => {})));

    expect(mount().result.current).toBe(false);
  });

  it.each([
    ["everyone, can see", { audience: "everyone", can_see: true }, true],
    ["staff, can see", { audience: "staff", can_see: true }, true],
    ["staff, cannot see", { audience: "staff", can_see: false }, false],
    ["off, cannot see", { audience: "off", can_see: false }, false],
    ["a 401", 401, false],
    ["a 500", 500, false],
  ] as const)("follows the Backend's answer: %s", async (_label, answer, expected) => {
    fakeReviewsAccess(answer as never);
    const { result } = mount();

    if (expected) {
      await waitFor(() => expect(result.current).toBe(true));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(result.current).toBe(false);
    }
  });

  it("asks again on a later mount, so a changed answer shows without a reload", async () => {
    const store = createTestStore();
    fakeReviewsAccess({ audience: "staff", can_see: true });
    const first = mount(store);
    await waitFor(() => expect(first.result.current).toBe(true));

    // A subscriber that stays (the tab strip) keeps the entry alive; a screen mounting beside it must still refetch.
    fakeReviewsAccess({ audience: "off", can_see: false });
    const second = mount(store);

    await waitFor(() => expect(second.result.current).toBe(false));
  });

  it("hides the screens on a later mount until its own read answers, even when an earlier answer is cached", async () => {
    const store = createTestStore();
    fakeReviewsAccess({ audience: "staff", can_see: true });
    const first = mount(store);
    await waitFor(() => expect(first.result.current).toBe(true));

    // The next read is held open: the cached `can_see: true` is from before this mount and must not show.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/feature-access`, async () => {
        await held;
        return Response.json({ reviews: { audience: "staff", can_see: true } });
      }),
    );
    const second = mount(store);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(second.result.current).toBe(false);

    release();
    await waitFor(() => expect(second.result.current).toBe(true));
    // The subscriber that was already mounted is not hidden by the later mount's read.
    expect(first.result.current).toBe(true);
  });
});
