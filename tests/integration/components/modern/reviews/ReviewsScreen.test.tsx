import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { IntakeItem, Review } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import {
  fakeReviewsEndpoints,
  intakeItem as item,
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

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});

const ME = "dj-me";
const mockAuth = vi.hoisted(() => ({ authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: ME, authority: mockAuth.authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import { toast } from "sonner";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ReviewsScreen from "@/src/components/experiences/modern/reviews/ReviewsScreen";

function serveIntake(open: IntakeItem[], reviewed: IntakeItem[] = [], mine: Review[] = [], records: IntakeItem[] = open) {
  fakeReviewsEndpoints({ open, reviewed, mine, records });
}

const section = (name: string) => screen.findByRole("region", { name });

const SHELF = "The review shelf";
const RETURN = "Return to the review shelf";
const BROUGHT_BACK = "Have you brought this record back to the station?";
const FAILURE_LINE = "Couldn't do that. Please try again.";
const SHELF_RACE = "This record left the review shelf before your click went through. The lists have been reloaded.";
const REQUEST_RACE = "This request is no longer open; it may have expired. The lists have been reloaded.";
const RELEASE_RACE = "This record is no longer checked out to you. The lists have been reloaded.";

describe("ReviewsScreen", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    fakeReviewsEndpoints();
    router.push.mockClear();
    router.replace.mockClear();
    vi.mocked(toast).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lists the review shelf with Check out, and a checkout sends the POST", async () => {
    serveIntake([item({ id: 5 })]);
    let posted: string | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/checkout`, ({ request }) => {
        posted = new URL(request.url).pathname;
        return HttpResponse.json(item({ id: 5, state: "checked_out" }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const shelf = await section(SHELF);
    expect(within(shelf).getByText("Stereolab · Aluminum Tunes · Duophonic · CD")).toBeInTheDocument();
    await user.click(within(shelf).getByRole("button", { name: "Check out" }));

    await waitFor(() => expect(posted).toBe("/intake/5/checkout"));
  });

  it("shows my checked-out records with the overdue mark, and not someone else's", async () => {
    serveIntake([
      item({ id: 2, effective_state: "checked_out", checked_out_by: ME, checked_out_at: "2026-08-01T12:00:00Z", overdue: true }),
      item({ id: 3, artist_name: "Cat Power", effective_state: "checked_out", checked_out_by: "someone-else" }),
    ]);

    renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");
    await within(mine).findByText(/Stereolab/);
    expect(within(mine).getByText("Overdue")).toBeInTheDocument();
    expect(within(mine).queryByText(/Cat Power/)).not.toBeInTheDocument();
  });

  it("keeps a reviewed record I hold, marked, and the release sends and clears the row", async () => {
    let released = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => {
        return HttpResponse.json(
          !released
            ? [
                item({ id: 8, state: "reviewed", effective_state: "reviewed", checked_out_by: ME, overdue: true }),
                item({ id: 9, artist_name: "Cat Power", state: "reviewed", effective_state: "reviewed", checked_out_by: "someone-else" }),
                item({ id: 10, artist_name: "Jessica Pratt", state: "reviewed", effective_state: "reviewed", checked_out_by: null }),
              ]
            : [],
        );
      }),
      http.post(`${TEST_BACKEND_URL}/intake/8/release`, () => {
        released = true;
        return HttpResponse.json(item({ id: 8, state: "reviewed", effective_state: "reviewed" }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");
    await within(mine).findByText("Reviewed. Bring the record back to the music office.");
    expect(within(mine).getByText("Overdue")).toBeInTheDocument();
    expect(within(mine).queryByText(/Cat Power|Jessica Pratt/)).not.toBeInTheDocument();

    await user.click(within(mine).getByRole("button", { name: RETURN }));
    const reviewedDialog = await screen.findByRole("alertdialog", { name: RETURN });
    expect(within(reviewedDialog).getByText(BROUGHT_BACK)).toBeInTheDocument();
    await user.click(within(reviewedDialog).getByRole("button", { name: RETURN }));

    await waitFor(() => expect(released).toBe(true));
    await waitFor(() => expect(within(mine).queryByText(/Stereolab/)).not.toBeInTheDocument());
  });

  it("asks before returning an ordinary checkout, then releases that record and clears the row", async () => {
    let released: string | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () =>
        HttpResponse.json(
          released
            ? []
            : [item({ id: 2, state: "checked_out", effective_state: "checked_out", checked_out_by: ME })],
        ),
      ),
      http.post(`${TEST_BACKEND_URL}/intake/:id/release`, ({ request }) => {
        released = new URL(request.url).pathname;
        return HttpResponse.json(item({ id: 2 }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");
    await within(mine).findByText(/Stereolab/);

    await user.click(within(mine).getByRole("button", { name: RETURN }));
    const dialog = await screen.findByRole("alertdialog", { name: RETURN });
    expect(within(dialog).getByText(BROUGHT_BACK)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: RETURN }));

    await waitFor(() => expect(released).toBe("/intake/2/release"));
    await waitFor(() => expect(within(mine).queryByText(/Stereolab/)).not.toBeInTheDocument());
  });

  it("lets me accept or pass a request made of me, and hides one made of someone else", async () => {
    serveIntake([
      item({ id: 11, state: "requested", effective_state: "requested", requested_dj_id: ME, requested_at: "2026-09-30T12:00:00Z" }),
      item({ id: 12, artist_name: "Cat Power", state: "requested", effective_state: "requested", requested_dj_id: "other" }),
    ]);
    const paths: string[] = [];
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, ({ request }) => {
        paths.push(new URL(request.url).pathname);
        return HttpResponse.json(item({}));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const requests = await section("Requests for me");
    await within(requests).findByText(/Stereolab/);
    expect(within(requests).queryByText(/Cat Power/)).not.toBeInTheDocument();
    await user.click(within(requests).getByRole("button", { name: "Accept" }));
    await user.click(within(requests).getByRole("button", { name: "Pass" }));

    await waitFor(() => expect(paths).toEqual(["/intake/11/accept", "/intake/11/pass"]));
  });

  // The notice says the lists have been reloaded, so it waits until they have.
  it.each([
    ["Check out", SHELF, "checkout", item({ id: 5 }), SHELF_RACE],
    ["Accept", "Requests for me", "accept", item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME }), REQUEST_RACE],
    ["Pass", "Requests for me", "pass", item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME }), REQUEST_RACE],
    [RETURN, "My checkouts", "release", item({ id: 5, state: "checked_out", effective_state: "checked_out", checked_out_by: ME }), RELEASE_RACE],
  ] as const)(
    "answers a lost race on %s with its own neutral notice once the lists have reloaded, never an error toast or the server's message",
    async (button, title, action, row, notice) => {
      let raced = false;
      let reloaded = 0;
      let reloadedAtNotice: number | undefined;
      server.use(
        http.get(`${TEST_BACKEND_URL}/intake`, async () => {
          if (!raced) return HttpResponse.json([row]);
          await delay(300);
          reloaded += 1;
          return HttpResponse.json([]);
        }),
        http.post(`${TEST_BACKEND_URL}/intake/5/${action}`, () => {
          raced = true;
          return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        }),
      );
      vi.mocked(toast).mockImplementation(() => {
        reloadedAtNotice = reloaded;
        return "";
      });

      const { user } = renderWithProviders(<ReviewsScreen />);
      const region = await section(title);
      await within(region).findByText(/Stereolab/);
      await user.click(within(region).getByRole("button", { name: button }));
      if (action === "release") {
        await user.click(within(await screen.findByRole("alertdialog", { name: RETURN })).getByRole("button", { name: RETURN }));
      }
      await waitFor(() => expect(raced).toBe(true));
      await new Promise((r) => setTimeout(r, 100));
      expect(toast).not.toHaveBeenCalled();

      // The reload is delayed 300 ms; leave room for a loaded runner.
      await waitFor(() => expect(toast).toHaveBeenCalledWith(notice), { timeout: 3000 });
      expect(toast).toHaveBeenCalledTimes(1);
      expect(reloadedAtNotice).toBe(1);
      expect(toast).not.toHaveBeenCalledWith("server words");
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  // A DJ who clicks and then leaves the page: the write still settles, and its
  // reload and lock release must not reject into the global error handler.
  it.each([
    ["a successful write", 200],
    ["a lost race", 409],
  ] as const)("leaves nothing unhandled when the page unmounts during %s", async (_label, status) => {
    serveIntake([item({ id: 5 })]);
    let answered = false;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, async () => {
        await delay(150);
        answered = true;
        return status === 200
          ? HttpResponse.json(item({ id: 5, state: "checked_out" }))
          : HttpResponse.json({ message: "server words", reason: "state_changed" }, { status });
      }),
    );
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onRejection);

    try {
      const { user, unmount } = renderWithProviders(<ReviewsScreen />);
      const shelf = await section(SHELF);
      await within(shelf).findByText(/Stereolab/);
      await user.click(within(shelf).getByRole("button", { name: "Check out" }));
      unmount();

      await waitFor(() => expect(answered).toBe(true));
      await new Promise((r) => setTimeout(r, 300));
      expect(rejections).toEqual([]);
      expect(toast).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });

  it("answers a failed write with the generic line as an error toast, not the race line", async () => {
    serveIntake([item({ id: 5 })]);
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () =>
        HttpResponse.json({ message: "server words" }, { status: 500 }),
      ),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const shelf = await section(SHELF);
    await within(shelf).findByText(/Aluminum Tunes/);
    await user.click(within(shelf).getByRole("button", { name: "Check out" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(FAILURE_LINE));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    // The lists refetch and the row is still on the review shelf, so it unlocks.
    await waitFor(() => expect(within(shelf).getByRole("button", { name: "Check out" })).toBeEnabled());
  });

  // The row only leaves its section once the refetched lists land; until then
  // a second click would 409 and claim someone else took the record.
  it("keeps the row locked after a successful write until the refetched lists land", async () => {
    let moved = false;
    const posts: string[] = [];
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, async () => {
        if (moved) await delay(300);
        return HttpResponse.json(moved ? [] : [item({ id: 5 })]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () => {
        posts.push("checkout");
        if (moved) return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        moved = true;
        return HttpResponse.json(item({ id: 5, state: "checked_out" }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const shelf = await section(SHELF);
    await within(shelf).findByText(/Stereolab/);
    await user.click(within(shelf).getByRole("button", { name: "Check out" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));

    expect(within(shelf).getByText(/Stereolab/)).toBeInTheDocument();
    const again = within(shelf).getByRole("button", { name: "Check out" });
    expect(again).toBeDisabled();
    // user-event refuses a pointer on a locked button; a DJ's click still lands.
    fireEvent.click(again);

    await waitFor(() => expect(within(shelf).queryByText(/Stereolab/)).not.toBeInTheDocument(), { timeout: 3000 });
    expect(posts).toHaveLength(1);
    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  // The second POST of a double-click would find the record already moved and
  // answer 409 state_changed, telling the DJ someone else took the record they
  // just took.
  it.each([
    ["Check out", SHELF, item({ id: 5 }), "/intake/5/checkout"],
    [
      "Accept",
      "Requests for me",
      item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME }),
      "/intake/5/accept",
    ],
  ] as const)("sends one POST when %s is double-clicked, and shows no race line", async (button, title, row, path) => {
    let moved = false;
    const posts: string[] = [];
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(moved ? [] : [row]),
      ),
      http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, async ({ request }) => {
        posts.push(new URL(request.url).pathname);
        await delay(100);
        if (moved) return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        moved = true;
        return HttpResponse.json(row);
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const region = await section(title);
    await within(region).findByText(/Stereolab/);
    await user.dblClick(within(region).getByRole("button", { name: button }));

    await waitFor(() => expect(within(region).queryByText(/Stereolab/)).not.toBeInTheDocument());
    expect(posts).toEqual([path]);
    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says the review shelf could not load rather than showing it empty when the body is not JSON", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => new HttpResponse("<html>Bad Gateway</html>", { status: 200, headers: { "Content-Type": "text/html" } })),
    );

    renderWithProviders(<ReviewsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/^Couldn't load the review shelf\. Please try again\.$/);
  });

  it.each([
    [SHELF, "Nothing is waiting on the review shelf."],
    ["My checkouts", "You have no records checked out."],
    ["Requests for me", "No one has asked you for a review."],
  ])("says %s is empty in so many words", async (title, empty) => {
    serveIntake([]);

    renderWithProviders(<ReviewsScreen />);

    expect(await within(await section(title)).findByText(empty)).toBeInTheDocument();
  });

  it.each([
    ["logged", REVIEW_COPY.screen.logged, "Logged"],
    ["taken", REVIEW_COPY.screen.taken, "Taken"],
    ["asked", REVIEW_COPY.screen.asked, "Asked"],
    ["cancel", REVIEW_COPY.screen.cancel, "Cancel"],
  ])("words the row detail or button %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  const HELD = item({ id: 2, state: "checked_out", effective_state: "checked_out", checked_out_by: ME });

  it("starts a draft from a My checkouts row and opens it", async () => {
    serveIntake([HELD]);
    let body: unknown;
    server.use(
      http.post(`${TEST_BACKEND_URL}/reviews`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(review({ id: 41 }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");
    await user.click(await within(mine).findByRole("button", { name: REVIEW_COPY.writeReview }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/41"));
    expect(body).toEqual({ intake_item_id: 2 });
  });

  it("opens the existing draft of mine on Write a review and creates nothing", async () => {
    serveIntake([HELD], [], [review({ id: 40, intake_item_id: 2 })]);
    let posts = 0;
    server.use(http.post(`${TEST_BACKEND_URL}/reviews`, () => (posts++, HttpResponse.json(review({ id: 41 })))));

    const { user } = renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");
    await user.click(await within(mine).findByRole("button", { name: "Write a review" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/40"));
    expect(posts).toBe(0);
  });

  // Opening the existing draft still goes through the row's write lock, so the
  // row's buttons stay disabled while the click is handled and the lists reload.
  it("locks the row while Write a review opens the existing draft", async () => {
    serveIntake([HELD], [], [review({ id: 40, intake_item_id: 2 })]);
    const { user } = renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");
    const write = await within(mine).findByRole("button", { name: REVIEW_COPY.writeReview });
    const returnButton = within(mine).getByRole("button", { name: RETURN });
    expect(returnButton).toBeEnabled();

    let reloads = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, async () => {
        reloads += 1;
        await delay(300);
        return HttpResponse.json([HELD]);
      }),
    );
    await user.click(write);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/40"));
    expect(returnButton).toBeDisabled();
    expect(write).toBeDisabled();
    await waitFor(() => expect(returnButton).toBeEnabled(), { timeout: 3000 });
    expect(reloads).toBeGreaterThan(0);
  });

  it("shows the submitted line and Edit review in place of Write a review once I have submitted", async () => {
    serveIntake([HELD], [], [review({ id: 40, intake_item_id: 2, status: "submitted" })]);

    const { user } = renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");

    expect(await within(mine).findByText("Review submitted. A music director will choose the review for the cover.")).toBeInTheDocument();
    expect(within(mine).queryByRole("button", { name: "Write a review" })).not.toBeInTheDocument();
    await user.click(within(mine).getByRole("button", { name: "Edit review" }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/40");
  });

  it("sends one POST /reviews when Write a review is double-clicked", async () => {
    serveIntake([HELD]);
    let posts = 0;
    server.use(
      http.post(`${TEST_BACKEND_URL}/reviews`, async () => {
        posts += 1;
        await delay(100);
        return HttpResponse.json(review({ id: 41 }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");
    await user.dblClick(await within(mine).findByRole("button", { name: REVIEW_COPY.writeReview }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/41"));
    await new Promise((r) => setTimeout(r, 150));
    expect(posts).toBe(1);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("answers a 409 subject_not_held on a row with the approved line, once the lists have reloaded and the row is gone", async () => {
    let raced = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () =>
        HttpResponse.json(raced ? [] : [HELD]),
      ),
      http.post(`${TEST_BACKEND_URL}/reviews`, () => {
        raced = true;
        return HttpResponse.json(
          { message: "You do not hold this intake item, or the subject does not exist", reason: "subject_not_held" },
          { status: 409 },
        );
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    const mine = await section("My checkouts");
    await user.click(await within(mine).findByRole("button", { name: REVIEW_COPY.writeReview }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith("You no longer have this record checked out, so a review can't be started here.");
    expect(within(mine).queryByText(/Stereolab/)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("lists my drafts and submitted reviews as a fourth section with a link to each", async () => {
    serveIntake([HELD], [], [review({ id: 40 }), review({ id: 41, intake_item_id: null, status: "submitted" })]);

    renderWithProviders(<ReviewsScreen />);
    const reviews = await section(REVIEW_COPY.myReviews.title);

    expect(within(reviews).getByText(REVIEW_COPY.myReviews.draft)).toBeInTheDocument();
    expect(within(reviews).getByText(REVIEW_COPY.myReviews.submitted)).toBeInTheDocument();
    expect(await within(reviews).findByText(/Stereolab/)).toBeInTheDocument();
    expect(within(reviews).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard/reviews/40",
      "/dashboard/reviews/41",
    ]);
  });

  it("shows a review's record from its own subject, not from the lists", async () => {
    const filed = item({ id: 9, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", state: "filed", effective_state: "filed" });
    fakeReviewsEndpoints({
      mine: [review({ id: 40, intake_item_id: 9 }), review({ id: 41, intake_item_id: null, album_id: 7 }), review({ id: 42, intake_item_id: 404 })],
      records: [filed],
      releases: [{ id: 7, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos", format_name: "cd", legacy_release_id: 1 }],
    });

    renderWithProviders(<ReviewsScreen />);
    const reviews = await section(REVIEW_COPY.myReviews.title);

    expect(await within(reviews).findByText("Cat Power · Moon Pix · Matador · CD")).toBeInTheDocument();
    expect(await within(reviews).findByText("Juana Molina · DOGA · Sonamos · CD")).toBeInTheDocument();
    // A record whose read has not landed (here, never) is not mislabeled as a library release.
    expect(within(reviews).queryByText(REVIEW_COPY.myReviews.libraryRelease)).not.toBeInTheDocument();
    expect(within(reviews).getAllByRole("link")).toHaveLength(3);
  });

  it("labels a library-release review as such while its release read has not landed", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    fakeReviewsEndpoints({ mine: [review({ id: 41, intake_item_id: null, album_id: 7 })] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/info`, async () => {
        await held;
        return HttpResponse.json({ id: 7, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos", format_name: "cd", legacy_release_id: 1 });
      }),
    );

    renderWithProviders(<ReviewsScreen />);
    const reviews = await section(REVIEW_COPY.myReviews.title);

    expect(await within(reviews).findByText(REVIEW_COPY.myReviews.libraryRelease)).toBeInTheDocument();
    release();
    expect(await within(reviews).findByText("Juana Molina · DOGA · Sonamos · CD")).toBeInTheDocument();
    expect(within(reviews).queryByText(REVIEW_COPY.myReviews.libraryRelease)).not.toBeInTheDocument();
  });

  it("says my reviews are empty in so many words, and shows the load-failure line when that read fails", async () => {
    serveIntake([]);
    const first = renderWithProviders(<ReviewsScreen />);
    expect(await within(await section(REVIEW_COPY.myReviews.title)).findByText(REVIEW_COPY.myReviews.empty)).toBeInTheDocument();
    first.unmount();

    server.use(http.get(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<ReviewsScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Couldn't load the review shelf\. Please try again\.$/);
  });

  it.each([
    ["the flag is off", "", Authorization.MD],
    ["a DJ is under staff", "staff", Authorization.DJ],
  ])("renders nothing and reads nothing when %s", async (_label, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    serveIntake([item({})]);
    const requested: string[] = [];
    const log = ({ request }: { request: Request }) => {
      requested.push(new URL(request.url).pathname);
    };
    server.events.on("request:start", log);

    try {
      const { container } = renderWithProviders(<ReviewsScreen />);

      await new Promise((r) => setTimeout(r, 50));
      expect(requested.filter((p) => p.startsWith("/intake"))).toEqual([]);
      expect(container).toBeEmptyDOMElement();
    } finally {
      server.events.removeListener("request:start", log);
    }
  });
});

describe("ReviewsScreen — a failed background refetch", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the loaded lists and shows no load-failure line when the reload after Check out fails", async () => {
    serveIntake([item({ id: 5 })]);
    const { user } = renderWithProviders(<ReviewsScreen />);
    const shelf = await section(SHELF);
    const checkout = await within(shelf).findByRole("button", { name: "Check out" });

    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })),
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () => HttpResponse.json({ ...item({ id: 5 }), state: "checked_out" })),
    );
    await user.click(checkout);

    await waitFor(() => expect(checkout).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(shelf).getByText(/Aluminum Tunes/)).toBeInTheDocument();
  });
});

const REVIEWERS = [
  { id: "dj-sam", name: "Test Reviewer" },
  { id: "dj-pat", name: "Pat Placeholder" },
];
const REQUEST_REFUSED = "That DJ can't be asked to review: their account was removed, or it's no longer a DJ account. Pick someone else.";
const REQUEST_LOST_RACE =
  "This record has left the review shelf since the page loaded, so it can't be requested. The lists have been reloaded.";

const moonPix = (overrides = {}) =>
  item({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", ...overrides });

/** One review shelf row's controls, reached by the record they act on: the group is named by the row's record line. */
const rowControls = async (album: string) =>
  within(await within(await section(SHELF)).findByRole("group", { name: new RegExp(album) }));

const pick = async (user: ReturnType<typeof renderWithProviders>["user"], name: string, album = "Moon Pix") => {
  await user.click(await (await rowControls(album)).findByRole("combobox", { name: "DJ to ask" }));
  await user.click(await screen.findByRole("option", { name }));
};

describe("ReviewsScreen — the new lane order and music directors' controls", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    router.push.mockClear();
    vi.mocked(toast).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["a DJ under true", "true", Authorization.DJ, false],
    ["a music director under true", "true", Authorization.MD, true],
    ["a music director under staff", "staff", Authorization.MD, true],
    ["a station manager under true", "true", Authorization.SM, true],
    ["a station manager under staff", "staff", Authorization.SM, true],
  ])("%s: the log form, Request a review and the record link are present exactly for %s", async (_label, flag, who, directors) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = who;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });

    renderWithProviders(<ReviewsScreen />);
    const shelf = await section(SHELF);
    await within(shelf).findByText(/Moon Pix/);

    expect(screen.queryByRole("form", { name: "Log an item" }) !== null).toBe(directors);
    expect(within(shelf).queryAllByRole("button", { name: "Request a review" })).toHaveLength(directors ? 1 : 0);
    const link = within(shelf).queryByRole("link", { name: /Moon Pix/ });
    expect(link !== null).toBe(directors);
    if (link) expect(link).toHaveAttribute("href", "/dashboard/admin/intake/11");
    expect(within(shelf).getAllByRole("button", { name: "Check out" })).toHaveLength(1);
  });

  it.each([
    ["", Authorization.MD],
    ["", Authorization.SM],
    ["", Authorization.DJ],
    ["staff", Authorization.DJ],
  ])("renders nothing under flag %j for authority %s", async (flag, who) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = who;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });

    const { container } = renderWithProviders(<ReviewsScreen />);

    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["a DJ", Authorization.DJ, false],
    ["a music director", Authorization.MD, true],
  ])("lays the lanes out in the order %s works through them", async (_label, who, directors) => {
    mockAuth.authority = who;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });

    renderWithProviders(<ReviewsScreen />);
    await section(SHELF);

    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions).toEqual(["Requests for me", "My checkouts", SHELF, "My reviews"]);
    const form = screen.queryByRole("form", { name: "Log an item" });
    if (!directors) return expect(form).toBeNull();
    const shelf = screen.getByRole("region", { name: SHELF });
    expect(form!.compareDocumentPosition(shelf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const checkouts = screen.getByRole("region", { name: "My checkouts" });
    expect(checkouts.compareDocumentPosition(form!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("makes no reviewers request for a DJ, and exactly one for a music director, who picks from the reviewers by name", async () => {
    const reads: string[] = [];
    const count = http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => {
      reads.push("read");
      return HttpResponse.json({ reviewers: REVIEWERS });
    });

    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });
    server.use(count);
    const dj = renderWithProviders(<ReviewsScreen />);
    await within(await section(SHELF)).findByText(/Moon Pix/);
    await new Promise((r) => setTimeout(r, 50));
    expect(reads).toEqual([]);
    dj.unmount();

    mockAuth.authority = Authorization.MD;
    const { user } = renderWithProviders(<ReviewsScreen />);
    await user.click(await (await rowControls("Moon Pix")).findByRole("combobox", { name: "DJ to ask" }));
    expect(await screen.findByRole("option", { name: "Test Reviewer" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pat Placeholder" })).toBeInTheDocument();
    expect(reads).toHaveLength(1);
  });

  it("sends the chosen dj_id and the record leaves the review shelf lane for the held state", async () => {
    mockAuth.authority = Authorization.MD;
    const bodies: unknown[] = [];
    let asked = false;
    fakeReviewsEndpoints({
      open: () => [asked ? moonPix({ state: "requested", effective_state: "requested", requested_dj_id: "dj-pat", requested_dj_name: "Pat Placeholder" }) : moonPix()],
      reviewers: REVIEWERS,
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/request`, async ({ request }) => {
        bodies.push(await request.clone().json());
        asked = true;
        return HttpResponse.json(moonPix({ state: "requested", effective_state: "requested" }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    expect((await rowControls("Moon Pix")).getByRole("button", { name: "Request a review" })).toBeDisabled();
    await pick(user, "Pat Placeholder");
    await user.click(screen.getByRole("button", { name: "Request a review" }));

    await waitFor(() => expect(bodies).toEqual([{ dj_id: "dj-pat" }]));
    await waitFor(() => expect(within(screen.getByRole("region", { name: SHELF })).queryByText(/Moon Pix/)).not.toBeInTheDocument());
  });

  it("a double click sends one POST", async () => {
    mockAuth.authority = Authorization.MD;
    let posts = 0;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/request`, async () => {
        posts += 1;
        await delay(100);
        return HttpResponse.json(moonPix({ state: "requested", effective_state: "requested" }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    await pick(user, "Pat Placeholder");
    const button = screen.getByRole("button", { name: "Request a review" });
    await user.dblClick(button);

    await waitFor(() => expect(posts).toBe(1));
  });

  it("shows the approved line on a 400, never the server's message, and reads the reviewers again", async () => {
    mockAuth.authority = Authorization.MD;
    let reads = 0;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/request`, () => HttpResponse.json({ message: "server words" }, { status: 400 })),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    await pick(user, "Pat Placeholder");
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => {
        reads += 1;
        return HttpResponse.json({ reviewers: REVIEWERS });
      }),
    );
    await user.click(screen.getByRole("button", { name: "Request a review" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REQUEST_REFUSED));
    expect(toast.error).not.toHaveBeenCalledWith("server words");
    await waitFor(() => expect(reads).toBe(1));
  });

  it("a lost race shows the approved line after the lists reload, never the server's message", async () => {
    mockAuth.authority = Authorization.MD;
    let reads = 0;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/request`, () =>
        HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
      ),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    await screen.findByRole("button", { name: "Request a review" });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => {
        reads += 1;
        return undefined;
      }),
    );
    await pick(user, "Test Reviewer");
    await user.click(screen.getByRole("button", { name: "Request a review" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(REQUEST_LOST_RACE));
    expect(reads).toBeGreaterThanOrEqual(1);
    expect(toast).not.toHaveBeenCalledWith("server words");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows one line above the shelf when the reviewers fail to load, and the lanes still render", async () => {
    mockAuth.authority = Authorization.MD;
    fakeReviewsEndpoints({ open: [moonPix({ id: 1 }), moonPix({ id: 2 })] });
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => HttpResponse.json({ message: "down" }, { status: 500 })));

    renderWithProviders(<ReviewsScreen />);

    const shelf = await section(SHELF);
    expect(within(shelf).getAllByText(/Moon Pix/)).toHaveLength(2);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(REVIEW_COPY.intake.reviewersLoadFailed);
    expect(alerts[0].compareDocumentPosition(shelf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("logs an item from the form and the record appears in The review shelf lane", async () => {
    mockAuth.authority = Authorization.MD;
    let logged = false;
    fakeReviewsEndpoints({
      open: () => (logged ? [moonPix()] : []),
      reviewers: REVIEWERS,
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, () => {
        logged = true;
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<ReviewsScreen />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "cd" }));
    await user.click(screen.getByRole("button", { name: "Log item" }));

    expect(await within(await section(SHELF)).findByText(/Moon Pix/)).toBeInTheDocument();
  });
});
