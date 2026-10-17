import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { setupListeners } from "@reduxjs/toolkit/query";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderedFrame, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { makeStore } from "@/lib/store";
import { intakeApi } from "@/lib/features/reviews/intakeApi";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const pathname = vi.hoisted(() => ({ current: "/dashboard/reviews" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});
const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import ReviewsTabs from "@/src/components/experiences/modern/reviews/ReviewsTabs";

const waiting = (id: number) =>
  intakeItem({ id, artist_name: "Cat Power", album_title: "Moon Pix", state: "pool", effective_state: "pool" });

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff"));
afterEach(() => vi.unstubAllEnvs());

describe("ReviewsTabs", () => {
  it.each([
    ["a DJ", false, [["Review shelf", "/dashboard/reviews"], ["My reviews", "/dashboard/reviews/mine"]]],
    [
      "a music director",
      true,
      [["Review shelf", "/dashboard/reviews"], ["My reviews", "/dashboard/reviews/mine"], ["New music", "/dashboard/reviews/music-directors"]],
    ],
  ])("draws %s the tabs, by name and URL, in order", (_who, showNewMusic, tabs) => {
    pathname.current = "/dashboard/reviews";
    fakeReviewsEndpoints({ awaiting: [] });

    renderWithProviders(<ReviewsTabs showNewMusic={showNewMusic} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(tabs);
  });

  it.each([
    ["/dashboard/reviews", "Review shelf"],
    ["/dashboard/reviews/mine", "My reviews"],
    ["/dashboard/reviews/music-directors", "New music"],
  ])("at %s only %s is current", (path, current) => {
    pathname.current = path;
    fakeReviewsEndpoints({ awaiting: [] });

    renderWithProviders(<ReviewsTabs showNewMusic />);

    expect(screen.getByRole("link", { name: current })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("asks for no waiting count when a DJ's strip has no New music tab", async () => {
    pathname.current = "/dashboard/reviews";
    let reads = 0;
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => {
      reads += 1;
      return HttpResponse.json([]);
    }));

    renderWithProviders(<ReviewsTabs showNewMusic={false} />);
    await renderedFrame();

    expect(reads).toBe(0);
  });

  it("recounts the waiting reviews when the window regains focus", async () => {
    pathname.current = "/dashboard/reviews";
    fakeReviewsEndpoints({ awaiting: [waiting(1)] });
    const store = makeStore();
    const stopListening = setupListeners(store.dispatch);
    renderWithProviders(<ReviewsTabs showNewMusic />, { store });
    await screen.findByRole("link", { name: "New music, 1 review waiting" });

    fakeReviewsEndpoints({ awaiting: [waiting(1), waiting(2)] });
    window.dispatchEvent(new Event("focus"));

    await screen.findByRole("link", { name: "New music, 2 reviews waiting" });
    stopListening();
  });

  it("leaves a reviewed record out of the count, as the Review waiting lane does", async () => {
    const reviewed = intakeItem({ id: 4, state: "reviewed", effective_state: "reviewed" });
    fakeReviewsEndpoints({ awaiting: [waiting(1), reviewed] });

    renderWithProviders(<ReviewsTabs showNewMusic />);

    await screen.findByRole("link", { name: "New music, 1 review waiting" });
  });

  it("counts the reviews waiting for a music director to accept", async () => {
    fakeReviewsEndpoints({ awaiting: [waiting(1), waiting(2), waiting(3)] });

    renderWithProviders(<ReviewsTabs showNewMusic />);

    const link = await screen.findByRole("link", { name: "New music, 3 reviews waiting" });
    expect(link).toHaveTextContent(/^New music3, 3 reviews waiting$/);
  });

  it.each([
    ["no rows", () => fakeReviewsEndpoints({ awaiting: [] }), "fulfilled"],
    ["a failed read", () => server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "x" }, { status: 500 }))), "rejected"],
    ["a read still loading", () => server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => new Promise(() => {}))), "pending"],
  ] as const)("keeps the plain label for %s", async (_label, arrange, status) => {
    arrange();

    const { store } = renderWithProviders(<ReviewsTabs showNewMusic />);

    // Assert once the awaiting read has reached the state the row names: answered, refused, or started and held.
    await waitFor(() =>
      expect(intakeApi.endpoints.getIntakeItems.select({ awaiting_acceptance: true })(store.getState()).status).toBe(status),
    );
    // The store settling is not the tab re-rendering: RTK batches its notifications to the next frame.
    await renderedFrame();
    expect(screen.getByRole("link", { name: "New music" })).toBeInTheDocument();
  });

  it.each([
    ["reviewShelf", REVIEW_COPY.tabs.reviewShelf, "Review shelf"],
    ["myReviews", REVIEW_COPY.tabs.myReviews, "My reviews"],
    ["directors", REVIEW_COPY.tabs.directors, "New music"],
  ])("words %s exactly as the station approved it", (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });

  // The station has not approved this wording yet, so this pins it without claiming it is signed off.
  it.each([
    ["one", 1, "1 review waiting"],
    ["many", 3, "3 reviews waiting"],
  ])("speaks the waiting count, %s, as currently worded (not yet approved)", (_name, count, expected) => {
    expect(REVIEW_COPY.tabs.waiting(count)).toBe(expected);
  });
});
