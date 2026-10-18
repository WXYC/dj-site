import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Authorization } from "@/lib/features/admin/types";
import {
  fakeReviewsEndpoints,
  intakeItem as item,
  renderedFrame,
  renderWithProviders,
  review,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() });
});

const ME = "dj-me";
const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import ReviewsScreen from "@/src/components/experiences/modern/reviews/ReviewsScreen";

const LANES = ["The review shelf"] as const;

const asked = item({ id: 11, state: "requested", effective_state: "requested", requested_dj_id: ME, requested_at: "2026-09-30T12:00:00Z" });
const held = item({ id: 12, artist_name: "Cat Power", album_title: "Moon Pix", state: "checked_out", effective_state: "checked_out", checked_out_by: ME, checked_out_at: "2026-10-01T12:00:00Z" });
const onShelf = item({ id: 13, artist_name: "Juana Molina", album_title: "DOGA", state: "pool", effective_state: "pool" });
const mine = review({ id: 5, intake_item_id: 12, status: "draft" });

const lanesShown = () => LANES.filter((name) => screen.queryByRole("region", { name }) !== null);

describe("ReviewsScreen tabs", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    fakeReviewsEndpoints({ open: [asked, held, onShelf], mine: [mine], reviewers: [{ id: "dj-sam", name: "Test Reviewer" }] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["a DJ", Authorization.DJ],
    ["a music director", Authorization.MD],
  ])("the Review shelf tab shows the review shelf lane alone for %s: no request, checkout, My reviews or form section", async (_who, authority) => {
    mockAuth.authority = authority;

    renderWithProviders(<ReviewsScreen tab="shelf" />);

    await within(await screen.findByRole("region", { name: "The review shelf" })).findByText(/DOGA/);
    expect(lanesShown()).toEqual(["The review shelf"]);
    expect(screen.queryByRole("form", { name: "Log an item" })).not.toBeInTheDocument();
  });

  it.each([
    ["a DJ", Authorization.DJ],
    ["a music director", Authorization.MD],
  ])("the My reviews tab shows the Open reviews, Submitted and Published stages for %s, and neither the review shelf nor the form", async (_who, authority) => {
    mockAuth.authority = authority;

    renderWithProviders(<ReviewsScreen tab="mine" />);

    const open = await screen.findByRole("tabpanel", { name: "Open reviews" });
    await within(open).findByText(/Stereolab/);
    expect(within(open).getByText(/Cat Power/)).toBeInTheDocument();
    expect(["Open reviews, 2", "Submitted, 0", "Published, 0"].map((name) => screen.getByRole("tab", { name }))).toEqual(screen.getAllByRole("tab"));
    expect(lanesShown()).toEqual([]);
    expect(screen.queryByRole("form", { name: "Log an item" })).not.toBeInTheDocument();
  });

  it("makes no reviewers request on the My reviews tab, even for a music director", async () => {
    const reads: string[] = [];
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => {
      reads.push("read");
      return HttpResponse.json([{ id: "dj-sam", name: "Test Reviewer" }]);
    }));
    mockAuth.authority = Authorization.MD;

    renderWithProviders(<ReviewsScreen tab="mine" />);
    await within(await screen.findByRole("tabpanel", { name: "Open reviews" })).findByText(/Stereolab/);
    await renderedFrame();

    expect(reads).toEqual([]);
  });

  it("reloads the intake list after a write on the My reviews tab", async () => {
    let reads = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => {
        reads += 1;
        return HttpResponse.json([asked, held, onShelf]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/11/pass`, () => HttpResponse.json(asked)),
    );

    const { user } = renderWithProviders(<ReviewsScreen tab="mine" />);
    const requests = await screen.findByRole("tabpanel", { name: "Open reviews" });
    const pass = await within(requests).findByRole("button", { name: "Pass" });
    await renderedFrame();
    const readsBeforeWrite = reads;
    await user.click(pass);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Pass" }));

    await waitFor(() => expect(reads).toBeGreaterThan(readsBeforeWrite));
  });

  it("shows the load-failed line, not the lanes, when the intake read fails", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })));

    renderWithProviders(<ReviewsScreen tab="shelf" />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(lanesShown()).toEqual([]);
  });
});
