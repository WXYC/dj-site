import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { IntakeItem, Review } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import {
  CDR_FORMAT,
  digitalItem,
  fakeReviewsEndpoints,
  heldBy,
  holdResponse,
  intakeItem as item,
  pendingCount,
  renderedFrame,
  renderWithProviders,
  review,
  reviewsSettled,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

// The page never reads the roster; a spy on the admin client's account list proves it.
const listUsers = vi.hoisted(() => vi.fn());

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  const mock = createAuthClientModuleMock();
  return { ...mock, authClient: { ...mock.authClient, admin: { listUsers } } };
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
// `late` mimics the real hook, which seeds each caller's own state from the session
// alone (no station role yet) and only switches to the resolved role after an effect and a microtask.
const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number, late: false }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { toast } from "sonner";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ReviewsScreen from "@/src/components/experiences/modern/reviews/ReviewsScreen";

// The two tabs side by side: these specs cover the lanes and the writes between them, and each tab's own content is pinned in ReviewsScreen.tabs.test.tsx.
function BothTabs() {
  return (
    <>
      <ReviewsScreen tab="shelf" />
      <ReviewsScreen tab="mine" />
    </>
  );
}

function serveIntake(open: IntakeItem[], reviewed: IntakeItem[] = [], mine: Review[] = [], records: IntakeItem[] = open) {
  fakeReviewsEndpoints({ open, reviewed, mine, records });
}

/** Counts the `GET /reviews` reads that arrive from now on (the my-reviews reload), answering each with an empty list. */
function countReviewReads() {
  const reads = { count: 0 };
  server.use(
    http.get(`${TEST_BACKEND_URL}/reviews`, () => {
      reads.count += 1;
      return HttpResponse.json([]);
    }),
  );
  return reads;
}

const section = (name: string) => screen.findByRole("region", { name });

const SHELF = "The review shelf";
const RETURN = "Return to the review shelf";
const BROUGHT_BACK = "Have you brought this record back to the station?";
const FAILURE_LINE = "Couldn't do that. Please try again.";
const SHELF_RACE = "This record left the review shelf before your click went through. The lists have been reloaded.";
const REQUEST_RACE = "This request is no longer open; it may have expired. The lists have been reloaded.";
const PASS = "Pass on Aluminum Tunes by Stereolab?";
const RELEASE_RACE = "This record is no longer checked out to you. The lists have been reloaded.";

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

describe("ReviewsScreen", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    fakeReviewsEndpoints();
    router.push.mockClear();
    router.replace.mockClear();
    listUsers.mockClear();
    vi.mocked(toast).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    mockAuth.late = false;
  });

  it.each([
    ["a DJ", Authorization.DJ, [REVIEW_COPY.screen.requestsTitle, REVIEW_COPY.screen.checkoutsTitle, REVIEW_COPY.screen.shelfTitle, REVIEW_COPY.myReviews.title]],
    ["a music director", Authorization.MD, [REVIEW_COPY.screen.requestsTitle, REVIEW_COPY.screen.checkoutsTitle, REVIEW_COPY.screen.shelfTitle, REVIEW_COPY.myReviews.title]],
  ])("gives %s each lane a level-3 heading", async (_who, authority, titles) => {
    mockAuth.authority = authority;
    renderWithProviders(<BothTabs />);

    await section(SHELF);
    for (const name of titles) expect(await screen.findByRole("heading", { level: 3, name })).toBeInTheDocument();
  });

  it("lists the review shelf with Check out, and a checkout sends the POST", async () => {
    serveIntake([item({ id: 5 })]);
    let posted: string | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/checkout`, ({ request }) => {
        posted = new URL(request.url).pathname;
        return HttpResponse.json(item({ id: 5, state: "checked_out" }));
      }),
    );

    const { user } = renderWithProviders(<BothTabs />);
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

    renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");
    await within(mine).findByText(/Stereolab/);
    expect(within(mine).getByText("Overdue")).toBeInTheDocument();
    expect(within(mine).queryByText(/Cat Power/)).not.toBeInTheDocument();
  });

  it.each([
    ["on the review shelf", "The review shelf", { id: 2 }],
    ["in the DJ's own list", "Records I'm reviewing", { id: 2, effective_state: "checked_out", checked_out_by: ME, checked_out_at: "2026-08-01T12:00:00Z" }],
  ] as const)("reads an unfiled digital record as exactly Digital %s, not by the CD-R format it is stored under", async (_where, region, overrides) => {
    fakeReviewsEndpoints({ open: [digitalItem(overrides)], records: [digitalItem(overrides)], formats: [{ id: 1, format_name: "cd" }, CDR_FORMAT] });

    renderWithProviders(<BothTabs />);

    const lane = await section(region);
    expect(await within(lane).findByText("Stereolab · Aluminum Tunes · Duophonic · Digital")).toBeInTheDocument();
    expect(within(lane).queryByText(/cdr/i)).not.toBeInTheDocument();
  });

  // 03:30Z is still the previous evening in station time, and 2025 is always an
  // earlier year than the run's, so the expected text holds in any zone or year.
  it("prints Logged, Taken and Asked dates in station time with the year", async () => {
    serveIntake([
      item({ id: 21, state: "pool", effective_state: "pool", logged_at: "2025-10-09T03:30:00Z" }),
      item({ id: 22, effective_state: "checked_out", checked_out_by: ME, checked_out_at: "2025-08-02T03:30:00Z" }),
      item({ id: 23, state: "requested", effective_state: "requested", requested_dj_id: ME, requested_at: "2025-09-01T03:30:00Z" }),
    ]);

    renderWithProviders(<BothTabs />);

    expect(await screen.findByText("Logged Oct 8, 2025")).toBeInTheDocument();
    expect(screen.getByText("Taken Aug 1, 2025")).toBeInTheDocument();
    expect(screen.getByText("Asked Aug 31, 2025")).toBeInTheDocument();
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

    const { user } = renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");
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

    const { user } = renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");
    await within(mine).findByText(/Stereolab/);

    await user.click(within(mine).getByRole("button", { name: RETURN }));
    const dialog = await screen.findByRole("alertdialog", { name: RETURN });
    expect(within(dialog).getByText(BROUGHT_BACK)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: RETURN }));

    await waitFor(() => expect(released).toBe("/intake/2/release"));
    await waitFor(() => expect(within(mine).queryByText(/Stereolab/)).not.toBeInTheDocument());
  });

  it("shows a request made of me and hides one made of someone else", async () => {
    serveIntake([
      item({ id: 11, state: "requested", effective_state: "requested", requested_dj_id: ME, requested_at: "2026-09-30T12:00:00Z" }),
      item({ id: 12, artist_name: "Cat Power", state: "requested", effective_state: "requested", requested_dj_id: "other" }),
    ]);

    renderWithProviders(<BothTabs />);
    const requests = await section("Requests for me");
    await within(requests).findByText(/Stereolab/);
    expect(within(requests).queryByText(/Cat Power/)).not.toBeInTheDocument();
    expect(within(requests).getAllByRole("button").map((b) => b.textContent)).toEqual(["Write a review", "Pass"]);
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  describe("Write a review on a request", () => {
    const REQUESTED = (overrides = {}) =>
      item({ id: 11, state: "requested", effective_state: "requested", requested_dj_id: ME, requested_at: "2026-09-30T12:00:00Z", ...overrides });

    /** Records each POST in order and answers the accept and the create. */
    const serveWrites = (answer: { create?: () => Response } = {}) => {
      const posts: string[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/:id/accept`, ({ request }) => {
          posts.push(new URL(request.url).pathname);
          return HttpResponse.json(item({}));
        }),
        http.post(`${TEST_BACKEND_URL}/reviews`, () => {
          posts.push("/reviews");
          return answer.create?.() ?? HttpResponse.json(review({ id: 41 }));
        }),
      );
      return posts;
    };

    const KINDS = [
      ["a disc", false],
      ["a digital album", true],
    ] as const;
    const requested = (digital: boolean) => (digital ? digitalItem(REQUESTED()) : REQUESTED());

    it.each(
      KINDS.flatMap(([kind, digital]) => [
        [kind, digital, "no draft", [], ["/intake/11/accept", "/reviews"], 41],
        [kind, digital, "a draft of mine", [review({ id: 40, intake_item_id: 11 })], ["/intake/11/accept"], 40],
      ] as const),
    )("accepts %s with %s, then opens the editor at that review with the arrival marker", async (_kind, digital, _draft, mine, expected, id) => {
      serveIntake([requested(digital)], [], [...mine]);
      const posts = serveWrites();

      const { user } = renderWithProviders(<BothTabs />);
      await user.click(await within(await section("Requests for me")).findByRole("button", { name: "Write a review" }));

      await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dashboard/reviews/${id}?arrived=request`));
      expect(posts).toEqual(expected);
    });

    it("answers a lost race on the accept with the request notice, stays on the page and creates nothing", async () => {
      serveIntake([REQUESTED()]);
      const posts = serveWrites();
      server.use(http.post(`${TEST_BACKEND_URL}/intake/11/accept`, () => HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 })));

      const { user } = renderWithProviders(<BothTabs />);
      await user.click(await within(await section("Requests for me")).findByRole("button", { name: "Write a review" }));

      await waitFor(() => expect(toast).toHaveBeenCalledWith(REQUEST_RACE));
      expect(posts).toEqual([]);
      expect(router.push).not.toHaveBeenCalled();
    });

    it.each(
      KINDS.flatMap(([kind, digital]) => [
        [kind, digital, "a 409 subject_not_held", { message: "server words", reason: "subject_not_held" }, 409],
        [kind, digital, "a server error", { message: "down" }, 500],
      ] as const),
    )("toasts that the review couldn't start and leaves %s among mine when the create fails with %s after the accept went through", async (_kind, digital, _why, body, status) => {
      serveIntake([requested(digital)]);
      const posts = serveWrites({ create: () => HttpResponse.json(body, { status }) });
      // Once the accept has gone through, the record is the DJ's.
      const held = { ...requested(digital), state: "checked_out", effective_state: "checked_out", checked_out_by: ME, checked_out_at: "2026-10-01T12:00:00Z" } as const;
      server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([posts.length > 0 ? held : requested(digital)])));

      const { user } = renderWithProviders(<BothTabs />);
      await user.click(await within(await section("Requests for me")).findByRole("button", { name: "Write a review" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REVIEW_COPY.couldNotStart));
      expect(await within(await section("Records I'm reviewing")).findByText(/Stereolab/)).toBeInTheDocument();
      expect(toast).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(router.push).not.toHaveBeenCalled();
    });

    // A DJ who clicks and then leaves the page is not pulled into the editor, nor shown a toast on an unrelated page.
    it.each([
      ["goes through", () => HttpResponse.json(review({ id: 41 }))],
      ["fails", () => HttpResponse.json({ message: "down" }, { status: 500 })],
    ])("neither opens the editor nor toasts when the page unmounts before the create %s", async (_outcome, respond) => {
      serveIntake([REQUESTED()]);
      serveWrites();
      const create = holdResponse("post", `${TEST_BACKEND_URL}/reviews`, respond);

      const { user, unmount, store } = renderWithProviders(<BothTabs />);
      await user.click(await within(await section("Requests for me")).findByRole("button", { name: "Write a review" }));
      await waitFor(() => expect(create.calls.count).toBe(1));
      unmount();
      create.release();
      await create.answered;
      await reviewsSettled(store);

      expect(router.push).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("Pass on a request", () => {
    const open = async () => {
      serveIntake([item({ id: 11, state: "requested", effective_state: "requested", requested_dj_id: ME, requested_at: "2026-09-30T12:00:00Z" })]);
      const paths: string[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(item({}));
        }),
      );
      const { user } = renderWithProviders(<BothTabs />);
      await user.click(await within(await section("Requests for me")).findByRole("button", { name: "Pass" }));
      const dialog = await screen.findByRole("alertdialog", { name: PASS });
      return { user, dialog, paths };
    };

    it("asks first, naming the record, and sends nothing on Cancel", async () => {
      const { user, dialog, paths } = await open();

      expect(within(dialog).getByText(REVIEW_COPY.screen.passConfirm)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(paths).toEqual([]);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("sends the pass on confirming, reloads and toasts", async () => {
      const { user, dialog, paths } = await open();
      // The pass invalidates only the intake list, so a my-reviews read is the write's own reload.
      const reload = countReviewReads();

      await user.click(within(dialog).getByRole("button", { name: "Pass" }));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Passed. The record is back on the review shelf."));
      expect(paths).toEqual(["/intake/11/pass"]);
      await waitFor(() => expect(reload.count).toBeGreaterThan(0));
    });
  });

  it("draws each request as a record row: the parts separately, Asked beside them, and Write a review and Pass together in the actions region", async () => {
    serveIntake([item({ id: 11, state: "requested", effective_state: "requested", requested_dj_id: ME, requested_at: "2026-09-30T12:00:00Z" })]);
    renderWithProviders(<BothTabs />);
    const requests = await section("Requests for me");
    for (const part of ["Stereolab", "Aluminum Tunes", "Duophonic"]) {
      expect((await within(requests).findByText(part)).textContent).toBe(part);
    }
    expect(within(requests).queryByText(/·/)).not.toBeInTheDocument();
    expect(within(requests).getByText(/^Asked /)).toBeInTheDocument();
    expect(within(requests).getAllByRole("listitem")).toHaveLength(1);
    const write = within(requests).getByRole("button", { name: "Write a review" });
    const pass = within(requests).getByRole("button", { name: "Pass" });
    expect(write.parentElement).toBe(pass.parentElement);
    expect(write.parentElement).not.toContainElement(within(requests).getByText("Stereolab"));
    expect(write.parentElement).not.toContainElement(within(requests).getByText(/^Asked /));
  });

  // The notice says the lists have been reloaded, so it waits until they have.
  it.each([
    ["Check out", SHELF, "checkout", item({ id: 5 }), SHELF_RACE],
    ["Write a review", "Requests for me", "accept", item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME }), REQUEST_RACE],
    ["Pass", "Requests for me", "pass", item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME }), REQUEST_RACE],
    [RETURN, "Records I'm reviewing", "release", item({ id: 5, state: "checked_out", effective_state: "checked_out", checked_out_by: ME }), RELEASE_RACE],
  ] as const)(
    "answers a lost race on %s with its own neutral notice once the lists have reloaded, never an error toast or the server's message",
    async (button, title, action, row, notice) => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([row])),
        http.post(`${TEST_BACKEND_URL}/intake/5/${action}`, () =>
          HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
        ),
      );

      const { user, store } = renderWithProviders(<BothTabs />);
      const region = await section(title);
      await within(region).findByText(/Stereolab/);
      // The reload after the refusal is held, so the notice is asserted absent while it is outstanding.
      const reload = holdResponse("get", `${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([]));
      const otherReads = countReviewReads();
      await user.click(within(region).getByRole("button", { name: button }));
      if (action === "release") {
        await user.click(within(await screen.findByRole("alertdialog", { name: RETURN })).getByRole("button", { name: RETURN }));
      }
      if (action === "pass") {
        await user.click(within(await screen.findByRole("alertdialog", { name: PASS })).getByRole("button", { name: "Pass" }));
      }
      // Assert during the hold, once every read the case depends on has started and only the held one is outstanding:
      // the my-reviews read has answered, so a notice that waited for it alone would already show. The review shelf tab does not draw that list, so a write there never reads it.
      await waitFor(() => expect(reload.calls.count).toBeGreaterThan(0));
      if (title === SHELF) {
        expect(otherReads.count).toBe(0);
      } else {
        await waitFor(() => expect(otherReads.count).toBeGreaterThan(0));
      }
      await waitFor(() => expect(pendingCount(store)).toBe(1));
      await renderedFrame();
      expect(toast).not.toHaveBeenCalled();

      reload.release();
      await reload.answered;
      await waitFor(() => expect(toast).toHaveBeenCalledWith(notice));
      expect(toast).toHaveBeenCalledTimes(1);
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
      const { user, unmount, store } = renderWithProviders(<BothTabs />);
      const shelf = await section(SHELF);
      await within(shelf).findByText(/Stereolab/);
      await user.click(within(shelf).getByRole("button", { name: "Check out" }));
      unmount();

      await waitFor(() => expect(answered).toBe(true));
      await reviewsSettled(store);
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

    const { user } = renderWithProviders(<BothTabs />);
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
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([item({ id: 5 })])),
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () => {
        posts.push("checkout");
        if (moved) return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        moved = true;
        return HttpResponse.json(item({ id: 5, state: "checked_out" }));
      }),
    );

    const { user, store } = renderWithProviders(<BothTabs />);
    const shelf = await section(SHELF);
    await within(shelf).findByText(/Stereolab/);
    const reload = holdResponse("get", `${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([]));
    const otherReads = countReviewReads();
    await user.click(within(shelf).getByRole("button", { name: "Check out" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    // Assert during the hold, once every read the case depends on has started and only the held one is outstanding.
    await waitFor(() => expect(reload.calls.count).toBeGreaterThan(0));
    await waitFor(() => expect(pendingCount(store)).toBe(1));
    await renderedFrame();
    // The review shelf tab does not draw My reviews, so its write never reads it.
    expect(otherReads.count).toBe(0);

    expect(within(shelf).getByText(/Stereolab/)).toBeInTheDocument();
    const again = within(shelf).getByRole("button", { name: "Check out" });
    expect(again).toBeDisabled();
    // user-event refuses a pointer on a locked button; a DJ's click still lands.
    fireEvent.click(again);

    reload.release();
    await reload.answered;
    expect(within(shelf).queryByText(/Stereolab/)).not.toBeInTheDocument();
    expect(posts).toHaveLength(1);
    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  // The second POST of a double-click would find the record already moved and
  // answer 409 state_changed, telling the DJ someone else took the record they
  // just took. Write a review also creates the review, and a second create
  // would give one request two drafts.
  it.each([
    ["Check out", SHELF, item({ id: 5 }), ["/intake/5/checkout"]],
    [
      "Write a review",
      "Requests for me",
      item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME }),
      ["/intake/5/accept", "/reviews"],
    ],
  ] as const)("sends each POST once when %s is double-clicked, and shows no race line", async (button, title, row, expected) => {
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
      http.post(`${TEST_BACKEND_URL}/reviews`, () => {
        posts.push("/reviews");
        return HttpResponse.json(review({ id: 41 }));
      }),
    );

    const { user } = renderWithProviders(<BothTabs />);
    const region = await section(title);
    await within(region).findByText(/Stereolab/);
    await user.dblClick(within(region).getByRole("button", { name: button }));

    await waitFor(() => expect(within(region).queryByText(/Stereolab/)).not.toBeInTheDocument());
    await waitFor(() => expect(posts).toEqual(expected));
    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says the review shelf could not load rather than showing it empty when the body is not JSON", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => new HttpResponse("<html>Bad Gateway</html>", { status: 200, headers: { "Content-Type": "text/html" } })),
    );

    renderWithProviders(<ReviewsScreen tab="shelf" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/^Couldn't load the review shelf\. Please try again\.$/);
  });

  it.each([
    ["a DJ", "true", Authorization.DJ, false],
    ["a music director", "true", Authorization.MD, true],
    ["a music director", "staff", Authorization.MD, true],
    ["a station manager", "true", Authorization.SM, true],
    ["a station manager", "staff", Authorization.SM, true],
  ])("%s under the flag %j: Request a review and the record link are present only for a music director or above", async (_label, flag, who, directors) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = who;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });

    renderWithProviders(<BothTabs />);
    const shelf = await section(SHELF);
    await within(shelf).findByText(/Moon Pix/);

    expect(screen.queryByRole("form", { name: "Log an item" })).not.toBeInTheDocument();
    expect(within(shelf).queryAllByRole("button", { name: "Request a review" })).toHaveLength(directors ? 1 : 0);
    const link = within(shelf).queryByRole("link", { name: /Moon Pix/ });
    expect(link !== null).toBe(directors);
    if (link) expect(link).toHaveAttribute("href", "/dashboard/admin/intake/11");
    expect(within(shelf).getAllByRole("button", { name: "Check out" })).toHaveLength(1);
  });

  it("makes no reviewers request for a DJ, and exactly one for a music director, who picks from the reviewers by name", async () => {
    const reads: string[] = [];
    const count = http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => {
      reads.push("read");
      return HttpResponse.json({ reviewers: REVIEWERS });
    });

    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });
    server.use(count);
    const dj = renderWithProviders(<BothTabs />);
    await within(await section(SHELF)).findByText(/Moon Pix/);
    // The read is a skip for a DJ, decided at render: it is never started.
    expect(reviewApi.endpoints.getReviewers.select(undefined)(dj.store.getState()).isUninitialized).toBe(true);
    await reviewsSettled(dj.store);
    expect(reads).toEqual([]);
    dj.unmount();

    mockAuth.authority = Authorization.MD;
    const { user } = renderWithProviders(<BothTabs />);
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

    const { user } = renderWithProviders(<BothTabs />);
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

    const { user } = renderWithProviders(<BothTabs />);
    await pick(user, "Pat Placeholder");
    const button = screen.getByRole("button", { name: "Request a review" });
    await user.dblClick(button);

    await waitFor(() => expect(posts).toBe(1));
  });

  it("locks the row's Request a review while its request is in flight, sends no second request, and leaves the other rows usable", async () => {
    mockAuth.authority = Authorization.MD;
    const paths: string[] = [];
    fakeReviewsEndpoints({ open: [moonPix({ id: 11 }), moonPix({ id: 12, album_title: "Jaubert" })], reviewers: REVIEWERS });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/request`, async ({ request }) => {
        paths.push(new URL(request.url).pathname);
        await delay(300);
        return HttpResponse.json(moonPix({ state: "requested", effective_state: "requested" }));
      }),
    );

    const { user } = renderWithProviders(<BothTabs />);
    await pick(user, "Pat Placeholder");
    const first = (await rowControls("Moon Pix")).getByRole("button", { name: "Request a review" });
    await user.click(first);
    await waitFor(() => expect(paths).toEqual(["/intake/11/request"]));

    expect(first).toBeDisabled();
    // user-event refuses a pointer on a locked button; a DJ's click still lands.
    fireEvent.click(first);

    const other = await rowControls("Jaubert");
    expect(other.getByRole("combobox", { name: "DJ to ask" })).toBeEnabled();
    await pick(user, "Test Reviewer", "Jaubert");
    expect(other.getByRole("button", { name: "Request a review" })).toBeEnabled();
    await user.click(other.getByRole("button", { name: "Request a review" }));

    await waitFor(() => expect(paths).toContain("/intake/12/request"));
    expect(paths.filter((x) => x === "/intake/11/request")).toHaveLength(1);
  });

  it("shows the approved line on a 400, never the server's message, and reads the reviewers again", async () => {
    mockAuth.authority = Authorization.MD;
    let reads = 0;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/request`, () => HttpResponse.json({ message: "server words" }, { status: 400 })),
    );

    const { user } = renderWithProviders(<BothTabs />);
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

    const { user } = renderWithProviders(<BothTabs />);
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

  it("makes no roster request, and offers the request on the review shelf lane only", async () => {
    mockAuth.authority = Authorization.MD;
    const held = item({ id: 7, album_title: "Waiting Album", effective_state: "checked_out", checked_out_by: ME });
    // Each other lane holds a real row, so its absence checks run against a row that could have carried the picker.
    const asked = item({ id: 8, album_title: "Asked Album", state: "requested", effective_state: "requested", requested_dj_id: ME });
    fakeReviewsEndpoints({
      open: [moonPix({ id: 1 }), moonPix({ id: 2, album_title: "Dark Side" }), held, asked],
      reviewers: REVIEWERS,
      mine: [review({ id: 40 })],
    });

    const { user } = renderWithProviders(<BothTabs />);
    const shelf = await section(SHELF);
    expect(await within(shelf).findAllByRole("button", { name: "Request a review" })).toHaveLength(2);
    await user.click(await (await rowControls("Moon Pix")).findByRole("combobox", { name: "DJ to ask" }));
    await screen.findByRole("option", { name: "Test Reviewer" });

    expect(listUsers).not.toHaveBeenCalled();
    const rowMarkers = {
      "Requests for me": () => within(screen.getByRole("region", { name: "Requests for me" })).getByRole("button", { name: "Write a review" }),
      "Records I'm reviewing": () => within(screen.getByRole("region", { name: "Records I'm reviewing" })).getByRole("button", { name: RETURN }),
      "My reviews": () => within(screen.getByRole("region", { name: "My reviews" })).getByRole("link", { name: REVIEW_COPY.myReviews.open }),
    };
    for (const other of ["Requests for me", "Records I'm reviewing", "My reviews"] as const) {
      expect(rowMarkers[other]()).toBeInTheDocument();
      expect(within(await section(other)).queryByRole("button", { name: "Request a review" })).not.toBeInTheDocument();
      expect(within(await section(other)).queryByRole("combobox", { name: "DJ to ask" })).not.toBeInTheDocument();
    }
  });

  it("leaves another row's Request a review disabled when a DJ is picked in one row", async () => {
    mockAuth.authority = Authorization.MD;
    fakeReviewsEndpoints({
      open: [moonPix({ id: 1 }), moonPix({ id: 2, album_title: "Dark Side" })],
      reviewers: REVIEWERS,
    });

    const { user } = renderWithProviders(<BothTabs />);
    await pick(user, "Pat Placeholder", "Dark Side");

    expect((await rowControls("Dark Side")).getByRole("button", { name: "Request a review" })).toBeEnabled();
    expect((await rowControls("Moon Pix")).getByRole("button", { name: "Request a review" })).toBeDisabled();
  });

  // `isIntakeRequestRefused` is true for any 400 under `intakeWriteError`, so only the action tells a refused request apart.
  it.each([
    ["Check out", SHELF, "checkout", item({ id: 5 })],
    ["Write a review", "Requests for me", "accept", item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME })],
    ["Pass", "Requests for me", "pass", item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME })],
  ] as const)("a 400 on %s is a plain write failure, not the request's line", async (button, title, action, row) => {
    serveIntake([row]);
    server.use(http.post(`${TEST_BACKEND_URL}/intake/5/${action}`, () => HttpResponse.json({ message: "server words" }, { status: 400 })));

    const { user } = renderWithProviders(<BothTabs />);
    await user.click(await within(await section(title)).findByRole("button", { name: button }));
    if (action === "pass") {
      await user.click(within(await screen.findByRole("alertdialog", { name: PASS })).getByRole("button", { name: "Pass" }));
    }

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REVIEW_COPY.screen.writeFailed));
    expect(toast.error).not.toHaveBeenCalledWith(REQUEST_REFUSED);
  });

  it("a 400 on Return to the review shelf is a plain write failure, not the request's line", async () => {
    serveIntake([item({ id: 5, state: "checked_out", effective_state: "checked_out", checked_out_by: ME })]);
    server.use(http.post(`${TEST_BACKEND_URL}/intake/5/release`, () => HttpResponse.json({ message: "server words" }, { status: 400 })));

    const { user } = renderWithProviders(<BothTabs />);
    await user.click(await within(await section("Records I'm reviewing")).findByRole("button", { name: RETURN }));
    await user.click(within(await screen.findByRole("alertdialog", { name: RETURN })).getByRole("button", { name: RETURN }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REVIEW_COPY.screen.writeFailed));
    expect(toast.error).not.toHaveBeenCalledWith(REQUEST_REFUSED);
  });

  it("never paints the review shelf lane without Request a review when the role resolves after the first paint", async () => {
    mockAuth.authority = Authorization.MD;
    mockAuth.late = true;
    fakeReviewsEndpoints({ open: [moonPix()], reviewers: REVIEWERS });
    const states: string[] = [];
    const observer = new MutationObserver(() => {
      const shelf = screen.queryByRole("region", { name: SHELF });
      if (!shelf) return;
      const row = within(shelf).queryByText(/Moon Pix/) !== null;
      const request = within(shelf).queryByRole("button", { name: "Request a review" }) !== null;
      states.push(`${row ? (request ? "R" : "-") : "."}`);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    renderWithProviders(<BothTabs />);
    await within(await section(SHELF)).findByRole("button", { name: "Request a review" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    observer.disconnect();

    expect(states).toContain("R");
    expect(states.filter((state) => state === "-")).toEqual([]);
  });

  it("shows one line above the shelf when the reviewers fail to load, and the lanes still render", async () => {
    mockAuth.authority = Authorization.MD;
    fakeReviewsEndpoints({ open: [moonPix({ id: 1 }), moonPix({ id: 2 })] });
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => HttpResponse.json({ message: "down" }, { status: 500 })));

    renderWithProviders(<BothTabs />);

    const shelf = await section(SHELF);
    expect(within(shelf).getAllByText(/Moon Pix/)).toHaveLength(2);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(REVIEW_COPY.intake.reviewersLoadFailed);
    expect(alerts[0].compareDocumentPosition(shelf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    [SHELF, "Nothing is waiting on the review shelf."],
    ["Records I'm reviewing", "You aren't reviewing any records."],
    ["Requests for me", "No one has asked you for a review."],
  ])("says %s is empty in so many words", async (title, empty) => {
    serveIntake([]);

    renderWithProviders(<BothTabs />);

    expect(await within(await section(title)).findByText(empty)).toBeInTheDocument();
  });

  it.each([
    ["shelf", [SHELF]],
    ["mine", ["Requests for me", "Records I'm reviewing", "My reviews"]],
  ] as const)("lays the %s tab's lanes out in the order a DJ works through them", async (tab, lanes) => {
    fakeReviewsEndpoints({ open: [moonPix()] });

    renderWithProviders(<ReviewsScreen tab={tab} />);
    await screen.findByRole("region", { name: lanes[0] });

    const regions = screen.getAllByRole("region").map((r) => document.getElementById(r.getAttribute("aria-labelledby")!)?.textContent);
    expect(regions).toEqual(lanes);
  });

  it.each([
    ["artist", REVIEW_COPY.intake.artist, "Artist"],
    ["album", REVIEW_COPY.intake.album, "Album"],
    ["label", REVIEW_COPY.intake.label, "Label"],
    ["format", REVIEW_COPY.intake.format, "Format"],
    ["djToAsk", REVIEW_COPY.intake.djToAsk, "DJ to ask"],
    ["request", REVIEW_COPY.intake.request, "Request a review"],
    ["reviewersLoadFailed", REVIEW_COPY.intake.reviewersLoadFailed, "Couldn't load the DJs who can be asked to review. Please try again."],
    ["logged", REVIEW_COPY.screen.logged, "Logged"],
    ["taken", REVIEW_COPY.screen.taken, "Taken"],
    ["asked", REVIEW_COPY.screen.asked, "Asked"],
    ["cancel", REVIEW_COPY.screen.cancel, "Cancel"],
    ["passTitle", REVIEW_COPY.screen.passTitle("DOGA", "Juana Molina"), "Pass on DOGA by Juana Molina?"],
    ["passConfirm", REVIEW_COPY.screen.passConfirm, "It goes back on the review shelf, and the music directors see that you passed."],
    ["passed", REVIEW_COPY.screen.passed, "Passed. The record is back on the review shelf."],
    ["arrived.disc", REVIEW_COPY.arrived.disc, "It's yours to review now, so other DJs can see that you have it. Write when you've listened; your draft saves here."],
    ["arrived.digital", REVIEW_COPY.arrived.digital, "It's yours to review now, and the music directors have been told to send you the files. Write when you've listened; your draft saves here."],
  ])("words the row detail or button %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  const HELD = item({ id: 2, state: "checked_out", effective_state: "checked_out", ...heldBy(ME, "DJ Me", null) });

  it("starts a draft from a Records I'm reviewing row and opens it", async () => {
    serveIntake([HELD]);
    let body: unknown;
    server.use(
      http.post(`${TEST_BACKEND_URL}/reviews`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(review({ id: 41 }));
      }),
    );

    const { user } = renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");
    await user.click(await within(mine).findByRole("button", { name: REVIEW_COPY.writeReview }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/41"));
    expect(body).toEqual({ intake_item_id: 2 });
  });

  it("opens the existing draft of mine on Write a review and creates nothing", async () => {
    serveIntake([HELD], [], [review({ id: 40, intake_item_id: 2 })]);
    let posts = 0;
    server.use(http.post(`${TEST_BACKEND_URL}/reviews`, () => (posts++, HttpResponse.json(review({ id: 41 })))));

    const { user } = renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");
    await user.click(await within(mine).findByRole("button", { name: "Write a review" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/40"));
    expect(posts).toBe(0);
  });

  // Opening the existing draft still goes through the row's write lock, so the
  // row's buttons stay disabled while the click is handled and the lists reload.
  it("locks the row while Write a review opens the existing draft", async () => {
    serveIntake([HELD], [], [review({ id: 40, intake_item_id: 2 })]);
    const { user } = renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");
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

    const { user } = renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");

    expect(await within(mine).findByText("Review submitted. A music director will choose the review for the cover.")).toBeInTheDocument();
    expect(within(mine).queryByRole("button", { name: "Write a review" })).not.toBeInTheDocument();
    await user.click(within(mine).getByRole("button", { name: "Edit review" }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/40");
  });

  const REVIEWED_RETURN = "Reviewed. Bring the record back to the music office.";
  const SUBMITTED_LINE = "Review submitted. A music director will choose the review for the cover.";

  it.each([
    { name: "checked out, no review", state: "checked_out", mine: [], line: null, main: "Write a review", other: RETURN },
    { name: "checked out, draft", state: "checked_out", mine: [{ status: "draft" }], line: null, main: "Write a review", other: RETURN },
    { name: "checked out, submitted", state: "checked_out", mine: [{ status: "submitted" }], line: SUBMITTED_LINE, main: "Edit review", other: RETURN },
    { name: "reviewed, submitted", state: "reviewed", mine: [{ status: "submitted" }], line: REVIEWED_RETURN, main: RETURN, other: "Edit review" },
    { name: "reviewed, no review", state: "reviewed", mine: [], line: REVIEWED_RETURN, main: RETURN, other: "Write a review" },
    { name: "reviewed, draft", state: "reviewed", mine: [{ status: "draft" }], line: REVIEWED_RETURN, main: RETURN, other: "Write a review" },
  ])("shows one state line and one solid main action on a $name row", async ({ state, mine, line, main, other }) => {
    serveIntake(
      [item({ id: 2, state, effective_state: state, checked_out_by: ME } as Partial<IntakeItem>)],
      [],
      mine.map((m, n) => review({ id: 40 + n, intake_item_id: 2, status: m.status } as Partial<Review>)),
    );

    renderWithProviders(<BothTabs />);
    const lane = await section("Records I'm reviewing");
    const mainButton = await within(lane).findByRole("button", { name: main });
    const otherButton = within(lane).getByRole("button", { name: other });

    expect(mainButton).toHaveClass("MuiButton-variantSolid");
    expect(otherButton).toHaveClass("MuiButton-variantOutlined");
    for (const text of [REVIEWED_RETURN, SUBMITTED_LINE]) {
      if (text === line) expect(within(lane).getByText(text)).toBeInTheDocument();
      else expect(within(lane).queryByText(text)).not.toBeInTheDocument();
    }
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

    const { user, store } = renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");
    await user.dblClick(await within(mine).findByRole("button", { name: REVIEW_COPY.writeReview }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/41"));
    await reviewsSettled(store);
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

    const { user } = renderWithProviders(<BothTabs />);
    const mine = await section("Records I'm reviewing");
    await user.click(await within(mine).findByRole("button", { name: REVIEW_COPY.writeReview }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith("You no longer have this record checked out, so a review can't be started here.");
    expect(within(mine).queryByText(/Stereolab/)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("lists my drafts and submitted reviews as a fourth section with a link to each", async () => {
    serveIntake([HELD], [], [review({ id: 40 }), review({ id: 41, intake_item_id: null, status: "submitted" })]);

    renderWithProviders(<BothTabs />);
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

    renderWithProviders(<BothTabs />);
    const reviews = await section(REVIEW_COPY.myReviews.title);

    expect(await within(reviews).findByText("Cat Power")).toBeInTheDocument();
    expect(await within(reviews).findByText("Moon Pix")).toBeInTheDocument();
    expect(await within(reviews).findByText("Juana Molina")).toBeInTheDocument();
    expect(await within(reviews).findByText("DOGA")).toBeInTheDocument();
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

    renderWithProviders(<BothTabs />);
    const reviews = await section(REVIEW_COPY.myReviews.title);

    expect(await within(reviews).findByText(REVIEW_COPY.myReviews.libraryRelease)).toBeInTheDocument();
    release();
    expect(await within(reviews).findByText("DOGA")).toBeInTheDocument();
    expect(within(reviews).queryByText(REVIEW_COPY.myReviews.libraryRelease)).not.toBeInTheDocument();
  });

  it.each([
    ["a logged record", "draft", false],
    ["a logged record", "submitted", false],
    ["a library release", "draft", true],
    ["a library release", "submitted", true],
  ] as const)("names the record of %s review (%s) in parts, with its status chip and last-saved date", async (_kind, status, fromLibrary) => {
    const logged = item({ id: 9, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", state: "filed", effective_state: "filed" });
    // A filed logged record carries both ids: the backend sets album_id on its reviews when the item is filed.
    const subject = fromLibrary ? { intake_item_id: null, album_id: 7 } : { intake_item_id: 9, album_id: 7 };
    fakeReviewsEndpoints({
      mine: [review({ id: 40, status, last_modified: "2025-10-08T18:00:00Z", ...subject })],
      records: [logged],
      releases: [{ id: 7, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos", format_name: "cd", legacy_release_id: 1 }],
    });

    renderWithProviders(<BothTabs />);
    const reviews = await section(REVIEW_COPY.myReviews.title);
    const [artist, album, label] = fromLibrary ? ["Juana Molina", "DOGA", "Sonamos"] : ["Cat Power", "Moon Pix", "Matador"];

    expect(await within(reviews).findByText(artist)).toBeInTheDocument();
    expect(within(reviews).getByText(album)).toBeInTheDocument();
    expect(within(reviews).getByText(label)).toBeInTheDocument();
    expect(reviews.textContent).not.toContain("·");
    expect(within(reviews).queryAllByText("from the library")).toHaveLength(fromLibrary ? 1 : 0);
    expect(within(reviews).getByText(status === "draft" ? "Draft" : "Submitted")).toBeInTheDocument();
    expect(within(reviews).getByText("Last saved Oct 8, 2025")).toBeInTheDocument();
    expect(within(reviews).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/dashboard/reviews/40");
  });

  it.each([
    ["a logged record", "draft", false],
    ["a logged record", "submitted", false],
    ["a library release", "draft", true],
    ["a library release", "submitted", true],
  ] as const)("keeps the status chip, last-saved date and Open on the placeholder row of %s review (%s) until its record lands", async (_kind, status, fromLibrary) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const subject = fromLibrary ? { intake_item_id: null, album_id: 7 } : { intake_item_id: 404, album_id: 7 };
    fakeReviewsEndpoints({ mine: [review({ id: 40, status, last_modified: "2025-10-08T18:00:00Z", ...subject })] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/info`, async () => {
        await held;
        return HttpResponse.json({ id: 7, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos", format_name: "cd", legacy_release_id: 1 });
      }),
    );

    renderWithProviders(<BothTabs />);
    const reviews = await section(REVIEW_COPY.myReviews.title);

    expect(await within(reviews).findByText("Last saved Oct 8, 2025")).toBeInTheDocument();
    expect(within(reviews).queryAllByText(REVIEW_COPY.myReviews.libraryRelease)).toHaveLength(fromLibrary ? 1 : 0);
    expect(within(reviews).getByText(status === "draft" ? "Draft" : "Submitted")).toBeInTheDocument();
    expect(within(reviews).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/dashboard/reviews/40");
    release();
    if (fromLibrary) expect(await within(reviews).findByText("DOGA")).toBeInTheDocument();
  });

  it("shows a review of a logged record's format tag, read from the library's formats", async () => {
    const logged = item({ id: 9, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", format_id: 2, state: "filed", effective_state: "filed" });
    fakeReviewsEndpoints({ mine: [review({ id: 40, intake_item_id: 9 })], records: [logged], formats: [{ id: 2, format_name: "vinyl" }] });

    renderWithProviders(<BothTabs />);

    expect(await within(await section(REVIEW_COPY.myReviews.title)).findByText("Vinyl")).toBeInTheDocument();
  });

  it("says my reviews are empty in so many words, and shows the load-failure line when that read fails", async () => {
    serveIntake([]);
    const first = renderWithProviders(<BothTabs />);
    expect(await within(await section(REVIEW_COPY.myReviews.title)).findByText(REVIEW_COPY.myReviews.empty)).toBeInTheDocument();
    first.unmount();

    server.use(http.get(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<BothTabs />);
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
      const { container, store } = renderWithProviders(<BothTabs />);

      await reviewsSettled(store);
      expect(requested.filter((p) => p.startsWith("/intake"))).toEqual([]);
      expect(container).toBeEmptyDOMElement();
    } finally {
      server.events.removeListener("request:start", log);
    }
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

    const { container, store } = renderWithProviders(<BothTabs />);

    await reviewsSettled(store);
    expect(container).toBeEmptyDOMElement();
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
    const { user } = renderWithProviders(<BothTabs />);
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

describe("ReviewsScreen — a digital album reads its own lines, a disc keeps today's", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    fakeReviewsEndpoints();
    router.push.mockClear();
    vi.mocked(toast).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  const LIST = "Records I'm reviewing";
  const TAKEN = { effective_state: "checked_out", checked_out_by: ME, checked_out_at: "2026-09-25T12:00:00Z" } as const;
  const FILES = "A music director will send you the files.";
  const REVIEWED_RETURN = "Reviewed. Bring the record back to the music office.";
  const SUBMITTED = "Review submitted. A music director will choose the review for the cover.";
  const make = (digital: boolean, overrides: Partial<IntakeItem> = {}) => (digital ? digitalItem(overrides) : item(overrides));

  it.each([
    ["a disc", false, "Check out", "Take"],
    ["a digital album", true, "Take", "Check out"],
  ])("labels the review shelf button for %s", async (_kind, digital, label, other) => {
    serveIntake([make(digital, { id: 2 })]);
    renderWithProviders(<BothTabs />);
    const shelf = await section(SHELF);
    expect(await within(shelf).findByRole("button", { name: label })).toBeInTheDocument();
    expect(within(shelf).queryByRole("button", { name: other })).not.toBeInTheDocument();
  });

  it.each([
    ["an overdue disc", false, "Overdue"],
    ["an overdue digital album with no submitted review", true, "Not reviewed yet"],
  ])("marks %s", async (_kind, digital, mark) => {
    serveIntake([make(digital, { id: 2, ...TAKEN, overdue: true })]);
    renderWithProviders(<BothTabs />);
    const mine = await section(LIST);
    expect(await within(mine).findByText(mark)).toBeInTheDocument();
    expect(within(mine).queryByText(mark === "Overdue" ? "Not reviewed yet" : "Overdue")).not.toBeInTheDocument();
  });

  it("marks an overdue disc with a submitted review Overdue, and an overdue digital album with one not at all", async () => {
    serveIntake(
      [
        make(false, { id: 2, ...TAKEN, overdue: true, submitted_review_count: 1 }),
        make(true, { id: 3, artist_name: "Cat Power", ...TAKEN, overdue: true, submitted_review_count: 1 }),
      ],
      [],
      [review({ id: 40, intake_item_id: 2, status: "submitted" }), review({ id: 41, intake_item_id: 3, status: "submitted" })],
    );
    renderWithProviders(<BothTabs />);
    const mine = await section(LIST);
    await within(mine).findByText(/Cat Power/);
    expect(within(mine).getAllByText("Overdue")).toHaveLength(1);
    expect(within(mine).queryByText("Not reviewed yet")).not.toBeInTheDocument();
  });

  it.each([
    ["a disc", false, "Have you brought this record back to the station?"],
    ["a digital album", true, "Put this record back on the review shelf? Another DJ can take it."],
  ])("asks the return question for %s", async (_kind, digital, question) => {
    serveIntake([make(digital, { id: 2, ...TAKEN })]);
    const { user } = renderWithProviders(<BothTabs />);
    await user.click(await within(await section(LIST)).findByRole("button", { name: RETURN }));
    expect(await within(await screen.findByRole("alertdialog", { name: RETURN })).findByText(question)).toBeInTheDocument();
  });

  it.each([
    ["a disc", false, true],
    ["a digital album", true, false],
  ])("shows the reviewed line for %s only when it is a disc", async (_kind, digital, shown) => {
    serveIntake([], [make(digital, { id: 2, ...TAKEN, state: "reviewed", effective_state: "reviewed" })]);
    renderWithProviders(<BothTabs />);
    const mine = await section(LIST);
    await within(mine).findByText(/Stereolab/);
    expect(within(mine).queryByText(REVIEWED_RETURN) !== null).toBe(shown);
  });

  it.each([
    ["a disc with no submitted review", false, [], null],
    ["a digital album with no submitted review", true, [], FILES],
    ["a digital album with a submitted review", true, [review({ id: 40, intake_item_id: 2, status: "submitted" })], null],
  ])("shows the files line for %s", async (_kind, digital, mine, line) => {
    serveIntake([make(digital, { id: 2, ...TAKEN, submitted_review_count: mine.length })], [], mine);
    renderWithProviders(<BothTabs />);
    const lane = await section(LIST);
    await within(lane).findByText(/Stereolab/);
    await waitFor(() => expect(within(lane).queryByText(SUBMITTED) !== null).toBe(mine.length > 0));
    expect(within(lane).queryByText(FILES) !== null).toBe(line !== null);
  });

  it("shows a digital album taken 20 days ago with a submitted review as submitted, not as Not reviewed yet", async () => {
    const taken = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    serveIntake(
      [digitalItem({ id: 2, ...TAKEN, checked_out_at: taken, overdue: true, submitted_review_count: 1 })],
      [],
      [review({ id: 40, intake_item_id: 2, status: "submitted" })],
    );
    renderWithProviders(<BothTabs />);
    const lane = await section(LIST);
    expect(await within(lane).findByText(SUBMITTED)).toBeInTheDocument();
    expect(within(lane).queryByText("Not reviewed yet")).not.toBeInTheDocument();
  });

  it.each([
    ["a disc", false, RETURN, "release", "This record is no longer checked out to you. The lists have been reloaded."],
    ["a digital album", true, RETURN, "release", "This record isn't yours to review any more. The lists have been reloaded."],
  ])("answers a lost return of %s with its own notice", async (_kind, digital, button, action, notice) => {
    const row = make(digital, { id: 5, ...TAKEN });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([row])),
      http.post(`${TEST_BACKEND_URL}/intake/5/${action}`, () => HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 })),
    );
    const { user } = renderWithProviders(<BothTabs />);
    await user.click(await within(await section(LIST)).findByRole("button", { name: button }));
    await user.click(within(await screen.findByRole("alertdialog", { name: RETURN })).getByRole("button", { name: RETURN }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(notice));
  });

  it.each([
    ["a disc", false, "You no longer have this record checked out, so a review can't be started here."],
    ["a digital album", true, "This record isn't yours to review any more, so a review can't be started here."],
  ])("answers a review started on %s that stopped being the DJ's with its own refusal", async (_kind, digital, notice) => {
    const row = make(digital, { id: 5, ...TAKEN });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([row])),
      http.post(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json({ message: "server words", reason: "subject_not_held" }, { status: 409 })),
    );
    const { user } = renderWithProviders(<BothTabs />);
    await user.click(await within(await section(LIST)).findByRole("button", { name: REVIEW_COPY.writeReview }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(notice));
  });
});
