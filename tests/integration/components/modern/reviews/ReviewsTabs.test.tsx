import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const pathname = vi.hoisted(() => ({ current: "/dashboard/reviews" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "md-me", authority: Authorization.MD } },
    authenticating: false,
    authenticated: true,
  }),
}));

import ReviewsTabs from "@/src/components/experiences/modern/reviews/ReviewsTabs";

const waiting = (id: number) =>
  intakeItem({ id, artist_name: "Cat Power", album_title: "Moon Pix", state: "pool", effective_state: "pool" });

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff"));
afterEach(() => vi.unstubAllEnvs());

describe("ReviewsTabs", () => {
  it.each([
    ["/dashboard/reviews", "Reviewing", "Music directors"],
    ["/dashboard/reviews/music-directors", "Music directors", "Reviewing"],
  ])("at %s only %s is current, and both links point at their pages", async (path, current, other) => {
    pathname.current = path;
    fakeReviewsEndpoints({ awaiting: [] });

    renderWithProviders(<ReviewsTabs />);

    expect(screen.getByRole("link", { name: "Reviewing" })).toHaveAttribute("href", "/dashboard/reviews");
    expect(screen.getByRole("link", { name: "Music directors" })).toHaveAttribute("href", "/dashboard/reviews/music-directors");
    expect(screen.getByRole("link", { name: current })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: other })).not.toHaveAttribute("aria-current");
  });

  it("counts the reviews waiting for a music director to accept", async () => {
    fakeReviewsEndpoints({ awaiting: [waiting(1), waiting(2), waiting(3)] });

    renderWithProviders(<ReviewsTabs />);

    expect(await screen.findByRole("link", { name: "Music directors (3)" })).toBeInTheDocument();
  });

  it.each([
    ["no rows", () => fakeReviewsEndpoints({ awaiting: [] })],
    ["a failed read", () => server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "x" }, { status: 500 })))],
    ["a read still loading", () => server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => new Promise(() => {})))],
  ])("keeps the plain label for %s", async (_label, arrange) => {
    arrange();

    renderWithProviders(<ReviewsTabs />);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await waitFor(() => expect(screen.getByRole("link", { name: "Music directors" })).toBeInTheDocument());
  });

  it.each([
    ["reviewing", REVIEW_COPY.tabs.reviewing, "Reviewing"],
    ["directors", REVIEW_COPY.tabs.directors, "Music directors"],
    ["count", REVIEW_COPY.tabs.count("Music directors", 3), "Music directors (3)"],
  ])("words %s exactly as the station approved it", (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });
});
