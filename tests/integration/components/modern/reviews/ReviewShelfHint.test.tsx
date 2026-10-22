import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse, type JsonBodyType } from "msw";
import type { ReactElement } from "react";
import type { AlbumReview, IntakeItem } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import type { AppStore } from "@/lib/store";
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

const LIBRARY_LINE = "The library already has Juana Molina, DOGA, with a review.";
const ANY_HINT = /The library already has|form review/;
const HINTED_ORDER = ["Use a review we already have…", "Ask a DJ…", "Digitize a review…"];
const PLAIN_ORDER = ["Ask a DJ…", "Use a review we already have…", "Digitize a review…"];
const rowOf = async () => (await screen.findByRole("link", { name: "Juana Molina" })).closest("li")!;
const openMenuOrder = async () => within(await screen.findByRole("menu")).getAllByRole("menuitem").map((item) => within(item).getByText(/…$/).textContent);
const menuOrder = async (user: ReturnType<typeof renderWithProviders>["user"]) => {
  await user.click(await within(await rowOf()).findByRole("button", { name: /^More/ }));
  return openMenuOrder();
};

/** True once the row's two lookups (the catalog search and the form archive by artist) have answered. */
function lookupsAnswered(store: AppStore) {
  const { catalogApi, reviewsApi } = store.getState();
  const answered = (queries: typeof catalogApi.queries, endpoint: string) => Object.values(queries).some((q) => q?.endpointName === endpoint && q.status === "fulfilled");
  return answered(catalogApi.queries, "searchCatalog") && answered(reviewsApi.queries, "getAlbumReviewsByArtist");
}

/** One read held until `answer` is called, so a test can open the menu before the hint is found. */
function holdRead(path: string, body: JsonBodyType) {
  let answer!: () => void;
  const held = new Promise<void>((resolve) => {
    answer = resolve;
  });
  server.use(
    http.get(`${TEST_BACKEND_URL}${path}`, async ({ request }) => {
      const params = new URL(request.url).searchParams;
      if (!params.has("artist_name") && !params.has("artist")) {
        return undefined;
      }
      await held;
      return HttpResponse.json(body);
    }),
  );
  return answer;
}

beforeEach(() => {
  url.search = "";
  mockAuth.authority = Authorization.MD;
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
    const { store } = renderWithProviders(draw([DOGA], true));

    const row = await rowOf();
    await waitFor(() => expect(lookupsAnswered(store)).toBe(true));
    // RTK Query holds back telling subscribers about its answers to batch them; an ordinary action tells them now, so the row renders what the answers say before the check.
    act(() => {
      store.dispatch({ type: "test/deliverBatchedAnswers" });
    });
    expect(within(row).queryByText(ANY_HINT)).not.toBeInTheDocument();
  });

  it.each([
    ["with a hint", { searchResults: [LIBRARY_ROW] }, HINTED_ORDER],
    ["without one", {}, PLAIN_ORDER],
  ])("orders the More menu %s", async (_case, served, order) => {
    fakeReviewsEndpoints({ open: [DOGA], reviewers: [{ id: "dj-sam", name: "DJ Sam" }], ...served });
    const { user } = renderWithProviders(draw([DOGA], true));
    if (Object.keys(served).length > 0) {
      await within(await rowOf()).findByText(LIBRARY_LINE);
    }

    expect(await menuOrder(user)).toEqual(order);
  });

  it.each([
    ["the library", "/library", [LIBRARY_ROW], LIBRARY_LINE],
    ["the form archive", "/album-reviews", { album_reviews: [formReview(1)], pagination: {} }, "1 form review of Juana Molina."],
  ])("keeps the open More menu's order when %s answers, and lists Use a review we already have… first the next time it opens", async (_case, path, body, line) => {
    fakeReviewsEndpoints({ open: [DOGA], reviewers: [{ id: "dj-sam", name: "DJ Sam" }] });
    const answer = holdRead(path, body);
    const { user } = renderWithProviders(draw([DOGA], true));

    expect(await menuOrder(user)).toEqual(PLAIN_ORDER);
    answer();
    expect(await within(await rowOf()).findByText(line)).toBeInTheDocument();
    expect(await openMenuOrder()).toEqual(PLAIN_ORDER);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(await menuOrder(user)).toEqual(HINTED_ORDER);
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
    expect(screen.queryByText(ANY_HINT)).not.toBeInTheDocument();
  });
});
