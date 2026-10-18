import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactElement } from "react";
import type { AlbumReview, IntakeItem } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
}));

const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() }, { pathname: "/dashboard/reviews/music-directors", search: () => url.search });
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import ReviewShelfScreen from "@/src/components/experiences/modern/reviews/ReviewShelfScreen";
import { useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";

const DOGA = intakeItem({ id: 1, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos" });
const LIBRARY_ROW = { id: 31, artist_name: "juana molina", album_title: "Doga", format_name: "CD", genre_name: "Rock", code_letters: "RO", code_number: 1, code_artist_number: 1, label: "Sonamos", plays: 0 };
const formReview = (id: number) => ({ id, reviewer: "Test Reviewer", album_id: null, artist_name: "Juana Molina", album_title: "Un día", review: "Take.", submitted_at: "2026-03-02T17:00:00Z" }) as AlbumReview;

function ShelfTab({ items, isMD }: { items: IntakeItem[]; isMD: boolean }) {
  const reviewers = useGetReviewersQuery(undefined, { skip: !isMD });
  const { write, lock } = useReviewWrite();
  return <ReviewShelfScreen items={items} isMD={isMD} reviewers={reviewers} write={write} lock={lock} />;
}

const SURFACES: { name: string; draw: (items: IntakeItem[], isMD: boolean) => ReactElement }[] = [
  { name: "the Review shelf tab", draw: (items, isMD) => <ShelfTab items={items} isMD={isMD} /> },
  {
    name: "the On the review shelf stage",
    draw: () => {
      url.search = "?stage=review_shelf";
      return <IntakeLanes />;
    },
  },
];

const LIBRARY_LINE = "The library has DOGA.";
const rowOf = async () => (await screen.findByRole("link", { name: "Juana Molina" })).closest("li")!;
const menuOrder = async (user: ReturnType<typeof renderWithProviders>["user"]) => {
  await user.click(await within(await rowOf()).findByRole("button", { name: /^More/ }));
  return within(await screen.findByRole("menu")).getAllByRole("menuitem").map((item) => within(item).getByText(/…$/).textContent);
};

beforeEach(() => {
  url.search = "";
  mockAuth.authority = Authorization.MD;
  vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(SURFACES)("the review shelf hint on $name", ({ draw }) => {
  it.each([
    ["the library only", { searchResults: [LIBRARY_ROW] }, [LIBRARY_LINE]],
    ["one form review only", { byArtist: { "Juana Molina": [formReview(1)] } }, ["1 form review of Juana Molina."]],
    ["two form reviews only", { byArtist: { "Juana Molina": [formReview(1), formReview(2)] } }, ["2 form reviews of Juana Molina."]],
    ["both", { searchResults: [LIBRARY_ROW], byArtist: { "Juana Molina": [formReview(1)] } }, [LIBRARY_LINE, "1 form review of Juana Molina."]],
  ])("shows %s", async (_case, served, lines) => {
    fakeReviewsEndpoints({ open: [DOGA], ...served });
    renderWithProviders(draw([DOGA], true));

    const row = await rowOf();
    for (const line of lines) {
      expect(await within(row).findByText(line)).toBeInTheDocument();
    }
  });

  it("shows nothing when the library's title differs and the archive has no reviews", async () => {
    fakeReviewsEndpoints({ open: [DOGA], searchResults: [{ ...LIBRARY_ROW, album_title: "Halo" }], byArtist: { "Juana Molina": [] } });
    renderWithProviders(draw([DOGA], true));

    const row = await rowOf();
    await waitFor(() => expect(row.querySelector("[aria-busy='true']")).toBeNull());
    expect(within(row).queryByText(/The library has|form review/)).not.toBeInTheDocument();
  });

  it.each([
    ["with a hint", { searchResults: [LIBRARY_ROW] }, ["Use a review we already have…", "Ask a DJ…", "Digitize a review…"]],
    ["without one", {}, ["Ask a DJ…", "Use a review we already have…", "Digitize a review…"]],
  ])("orders the More menu %s", async (_case, served, order) => {
    fakeReviewsEndpoints({ open: [DOGA], reviewers: [{ id: "dj-sam", name: "DJ Sam" }], ...served });
    const { user } = renderWithProviders(draw([DOGA], true));
    if (Object.keys(served).length > 0) {
      await within(await rowOf()).findByText(LIBRARY_LINE);
    }

    expect(await menuOrder(user)).toEqual(order);
  });
});

describe("the review shelf hint for a DJ", () => {
  it("makes no catalog or archive read and shows no hint", async () => {
    mockAuth.authority = Authorization.DJ;
    const reads: string[] = [];
    fakeReviewsEndpoints({ open: [DOGA], searchResults: [LIBRARY_ROW], byArtist: { "Juana Molina": [formReview(1)] } });
    server.use(
      http.get(`${TEST_BACKEND_URL}/album-reviews`, ({ request }) => {
        reads.push(request.url);
        return HttpResponse.json({ album_reviews: [], pagination: {} });
      }),
      http.get(`${TEST_BACKEND_URL}/library`, ({ request }) => {
        reads.push(request.url);
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<ShelfTab items={[DOGA]} isMD={false} />);

    expect(await screen.findByText("Juana Molina")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(reads).toEqual([]);
    expect(screen.queryByText(/The library has|form review/)).not.toBeInTheDocument();
  });
});
