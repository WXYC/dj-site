import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { server } from "@/tests/fakes/server";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { day } from "@/src/components/experiences/modern/reviews/useReviewWrite";
import { fakeReviewsEndpoints, heldBy, intakeItem, renderWithProviders, requestedFor, review } from "@/tests/helpers";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import { editorBack, parseEditorOrigin } from "@/lib/features/reviews/paths";
import MyReviewsScreen from "@/src/components/experiences/modern/reviews/MyReviewsScreen";
import { useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";
import type { ComponentProps } from "react";
import type { IntakeItem, Review } from "@wxyc/shared";

// The screen takes the shared write wiring from its caller, as ReviewsScreen supplies it.
function WithWrite(props: Omit<ComponentProps<typeof MyReviewsScreen>, "write" | "lock">) {
  const { write, lock } = useReviewWrite();
  return <MyReviewsScreen {...props} write={write} lock={lock} />;
}

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router, { pathname: "/dashboard/reviews/mine", search: () => url.search });
});

const ME = "dj-me";
const STAGES = REVIEW_COPY.myReviews.stages;
const asked = (id: number) => intakeItem({ id, state: "requested", effective_state: "requested", ...requestedFor(ME, "DJ Me") });
const held = (id: number, overrides = {}) => intakeItem({ id, state: "checked_out", effective_state: "checked_out", ...heldBy(ME, "DJ Me"), ...overrides });
const submitted = (id: number, overrides = {}) =>
  review({ id, intake_item_id: null, album_id: 7, status: "submitted", in_use: false, submitted_at: `2026-10-${String(id % 28 + 1).padStart(2, "0")}T12:00:00Z`, ...overrides });

beforeEach(() => {
  url.search = "";
  router.replace.mockClear();
  router.push.mockClear();
});

const renderScreen = (items: IntakeItem[], myReviews: Review[]) => {
  fakeReviewsEndpoints();
  return renderWithProviders(<WithWrite items={items} myReviews={myReviews} me={ME} />);
};

describe("MyReviewsScreen", () => {
  // An earlier year than the clock's, so the day carries its year.
  it.each([
    ["an asker", "Mike", "Mike requested your review on Oct 16, 2025."],
    ["no asker", null, "Your review was requested on Oct 16, 2025."],
  ])("words the request row for %s", async (_label, askedBy, expected) => {
    const item = { ...asked(7), requested_at: "2025-10-16T12:00:00Z", requested_by_name: askedBy };
    renderScreen([item], []);

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it("draws the chips with their counts, and Open reviews holds requests and records I have", async () => {
    renderScreen([asked(7), held(8)], [submitted(40), submitted(41, { in_use: true })]);

    const tabs = await screen.findAllByRole("tab");
    expect([`${STAGES.open}, 2`, `${STAGES.submitted}, 1`, `${STAGES.published}, 1`].map((name) => screen.getByRole("tab", { name }))).toEqual(tabs);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    const open = screen.getByRole("tabpanel", { name: STAGES.open });
    expect(within(open).getAllByRole("button", { name: REVIEW_COPY.writeReview })).toHaveLength(2);
    expect(within(open).getAllByRole("button", { name: REVIEW_COPY.screen.pass })).toHaveLength(2);
  });

  it.each([
    ["Open reviews when anything is open", "", [held(8)], [submitted(40)], STAGES.open],
    ["Submitted when nothing is open", "", [], [submitted(40)], STAGES.submitted],
    ["Submitted when nothing is open, even with published reviews", "", [], [submitted(40, { in_use: true })], STAGES.submitted],
    ["the stage the URL names, over the opening rule", "?stage=published", [held(8)], [submitted(40, { in_use: true })], STAGES.published],
    ["Submitted when the URL names it", "?stage=submitted", [held(8)], [submitted(40)], STAGES.submitted],
    ["Open reviews when the URL names it and it is empty", "?stage=open", [], [submitted(40)], STAGES.open],
    ["the opening rule when the URL names no stage", "?stage=nonsense", [held(8)], [], STAGES.open],
    ["the opening rule for a token that is not a stage's, such as the chip's old name", "?stage=cover", [], [submitted(40, { in_use: true })], STAGES.submitted],
    ["the opening rule for a stage named in capitals, since tokens are lowercase", "?stage=Published", [held(8)], [submitted(40, { in_use: true })], STAGES.open],
  ])("opens on %s", async (_name, search, items, reviews, stage) => {
    url.search = search;

    renderScreen(items, reviews);

    expect(await screen.findByRole("tabpanel", { name: stage })).toBeInTheDocument();
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(stage);
  });

  it.each([
    [STAGES.open, "?stage=open", "Nothing is waiting on you right now."],
    [STAGES.submitted, "?stage=submitted", "Nothing here."],
    [STAGES.published, "?stage=published", "Nothing here."],
  ])("says %s is empty in so many words", async (stage, search, words) => {
    url.search = search;

    renderScreen([], []);

    expect(await within(await screen.findByRole("tabpanel", { name: stage })).findByText(words)).toBeInTheDocument();
  });

  it("puts a disc I have whose review was chosen under Published, with its approved line and Mark as returned", async () => {
    url.search = "?stage=published";
    const disc = held(2, { state: "reviewed", effective_state: "reviewed" });

    renderScreen([disc], [submitted(40, { intake_item_id: 2, album_id: null, in_use: true })]);

    const published = await screen.findByRole("tabpanel", { name: STAGES.published });
    expect(within(published).getByText(REVIEW_COPY.screen.reviewedReturn)).toBeInTheDocument();
    expect(within(published).getByRole("button", { name: REVIEW_COPY.intake.returned })).toBeInTheDocument();
  });

  it.each([
    [STAGES.submitted, "?stage=submitted", false],
    [STAGES.published, "?stage=published", true],
  ])("shows %s 20 at a time, newest first, and \"Show older reviews\" reveals the next 20", async (stage, search, inUse) => {
    url.search = search;
    const reviews = Array.from({ length: 45 }, (_, n) => submitted(n + 1, { in_use: inUse, submitted_at: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString() }));

    const { user } = renderScreen([], reviews);
    const panel = await screen.findByRole("tabpanel", { name: stage });
    const links = () => within(panel).getAllByRole("link").map((a) => a.getAttribute("href"));

    expect(links()).toHaveLength(20);
    expect(links()[0]).toBe(`/dashboard/reviews/45?from=mine&${search.slice(1)}`);
    expect(links()[19]).toBe(`/dashboard/reviews/26?from=mine&${search.slice(1)}`);

    await user.click(within(panel).getByRole("button", { name: REVIEW_COPY.myReviews.showOlder }));
    expect(links()).toHaveLength(40);

    await user.click(within(panel).getByRole("button", { name: REVIEW_COPY.myReviews.showOlder }));
    expect(links()).toHaveLength(45);
    expect(within(panel).queryByRole("button", { name: REVIEW_COPY.myReviews.showOlder })).not.toBeInTheDocument();
  });

  // Every way out of this tab to the editor says where it was opened from, and carries the stage the DJ is looking at: the one the chips show, which is the opening rule's choice when the URL names no stage. The editor's back link then returns to that same stage.
  const draft34 = review({ id: 34, intake_item_id: null, album_id: 7, status: "draft" });
  const reviewedDisc = held(2, { state: "reviewed", effective_state: "reviewed" });
  describe.each([
    ["the Open link, from the tab with no stage and something open", "", [], [submitted(33), draft34], { link: REVIEW_COPY.myReviews.open }, 34, "open"],
    ["the Open link, from the tab with no stage and nothing open", "", [], [submitted(33)], { link: REVIEW_COPY.myReviews.open }, 33, "submitted"],
    ["the Open link on Open reviews", "?stage=open", [], [submitted(33), draft34], { link: REVIEW_COPY.myReviews.open }, 34, "open"],
    ["the Open link on Submitted", "?stage=submitted", [], [submitted(33), draft34], { link: REVIEW_COPY.myReviews.open }, 33, "submitted"],
    ["the Open link on Published", "?stage=published", [], [submitted(35, { in_use: true }), draft34], { link: REVIEW_COPY.myReviews.open }, 35, "published"],
    ["the Open link, from a stage the URL names wrongly", "?stage=elsewhere", [], [submitted(33)], { link: REVIEW_COPY.myReviews.open }, 33, "submitted"],
    ["Open draft on a record with a draft, from the tab with no stage", "", [held(8)], [review({ id: 31, intake_item_id: 8, status: "draft" })], { button: REVIEW_COPY.myReviews.openDraft }, 31, "open"],
    ["Open draft on a record with a draft, on Open reviews", "?stage=open", [held(8)], [review({ id: 31, intake_item_id: 8, status: "draft" })], { button: REVIEW_COPY.myReviews.openDraft }, 31, "open"],
    ["Open draft on a record with a draft, from a stage the URL names wrongly", "?stage=elsewhere", [held(8)], [review({ id: 31, intake_item_id: 8, status: "draft" })], { button: REVIEW_COPY.myReviews.openDraft }, 31, "open"],
    ["Edit review on a record with a submitted review, from the tab with no stage", "", [held(9)], [review({ id: 32, intake_item_id: 9, status: "submitted" })], { button: REVIEW_COPY.screen.editReview }, 32, "submitted"],
    ["Edit review on a record with a submitted review, on Submitted", "?stage=submitted", [held(9)], [review({ id: 32, intake_item_id: 9, status: "submitted" })], { button: REVIEW_COPY.screen.editReview }, 32, "submitted"],
    ["Edit review on a disc whose review was chosen, on Published", "?stage=published", [reviewedDisc], [submitted(40, { intake_item_id: 2, album_id: null, in_use: true })], { button: REVIEW_COPY.screen.editReview }, 40, "published"],
  ] as const)("%s", (_name, search, items, reviews, opener, id, stage) => {
    const href = `/dashboard/reviews/${id}?from=mine&stage=${stage}`;

    it(`opens the editor at ${href}, under the stage that is showing`, async () => {
      url.search = search;
      const { user } = renderScreen([...items], [...reviews]);
      expect(await screen.findByRole("tab", { selected: true })).toHaveTextContent(STAGES[stage]);
      if ("link" in opener) {
        const links = screen.getAllByRole("link", { name: opener.link });
        expect(links.map((a) => a.getAttribute("href"))).toEqual([href]);
      } else {
        await user.click(screen.getByRole("button", { name: opener.button }));
        await waitFor(() => expect(router.push).toHaveBeenCalledWith(href));
      }
    });

    it("gives the editor a back link to that stage", () => {
      const query = Object.fromEntries(new URL(href, "https://dj.wxyc.org").searchParams);
      expect(editorBack(parseEditorOrigin(query)).href).toBe(`/dashboard/reviews/mine?stage=${stage}`);
    });
  });

  describe("the held-record row's buttons and facts line", () => {
    const WRITE = REVIEW_COPY.writeReview;
    const { pass: PASS, editReview: EDIT, reviewingSince: REVIEWING_SINCE } = REVIEW_COPY.screen;
    const MARK = REVIEW_COPY.intake.returned;
    const OPEN_DRAFT = REVIEW_COPY.myReviews.openDraft;
    const draftOf = (id: number) => review({ id: 60 + id, intake_item_id: id, album_id: null, status: "draft" });
    const sentOf = (id: number, overrides = {}) => review({ id: 70 + id, intake_item_id: id, album_id: null, status: "submitted", in_use: false, ...overrides });
    const reviewedDisc2 = (id: number) => held(id, { state: "reviewed", effective_state: "reviewed", submitted_review_count: 1 });
    const digital = (id: number, overrides = {}) => held(id, { digital: true, ...overrides });
    const lastSaved = (r: Review) => `${REVIEW_COPY.myReviews.lastSaved} ${day(r.last_modified)}`;

    it.each([
      ["a disc with no review and no draft", "?stage=open", [held(1)], [], [WRITE, PASS], [REVIEWING_SINCE], [OPEN_DRAFT, MARK]],
      ["a disc with my draft", "?stage=open", [held(1)], [draftOf(1)], [OPEN_DRAFT, PASS], [lastSaved(draftOf(1)), REVIEW_COPY.myReviews.draft], [WRITE, MARK]],
      ["a disc with my submitted review", "?stage=submitted", [held(1, { submitted_review_count: 1 })], [sentOf(1)], [EDIT, MARK], [REVIEW_COPY.screen.reviewSubmitted], [WRITE, PASS]],
      ["a digital album with my submitted review", "?stage=submitted", [digital(1, { submitted_review_count: 1 })], [sentOf(1)], [EDIT], [REVIEW_COPY.screen.reviewSubmitted], [WRITE, PASS, MARK]],
      ["a digital album with no review", "?stage=open", [digital(1)], [], [WRITE, PASS], [REVIEW_COPY.screen.filesComing], [OPEN_DRAFT, MARK]],
      ["a reviewed disc", "?stage=published", [reviewedDisc2(1)], [sentOf(1, { in_use: true })], [EDIT, MARK], [REVIEW_COPY.screen.reviewedReturn], [WRITE, PASS]],
      ["a draft on a record I passed", "?stage=open", [intakeItem({ id: 1 })], [draftOf(1)], [OPEN_DRAFT], [REVIEW_COPY.myReviews.draftKept, lastSaved(draftOf(1))], [WRITE, PASS, MARK]],
      ["a request", "?stage=open", [asked(1)], [], [WRITE, PASS], [REVIEW_COPY.screen.requestedNoAsker(day(asked(1).requested_at))], [OPEN_DRAFT, MARK]],
    ])("draws %s", async (_name, search, items, reviews, buttons, lines, absent) => {
      url.search = search;

      renderScreen(items, reviews);

      const panel = await screen.findByRole("tabpanel");
      expect(within(panel).getAllByRole("button").map((b) => b.textContent)).toEqual(buttons);
      for (const line of lines) {
        expect(within(panel).getByText(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeInTheDocument();
      }
      for (const name of absent) {
        expect(within(panel).queryByRole("button", { name })).not.toBeInTheDocument();
      }
    });

    it("makes the reviewed disc's Mark as returned the solid button and Edit review the outlined one", async () => {
      url.search = "?stage=published";
      renderScreen([reviewedDisc2(1)], [sentOf(1, { in_use: true })]);

      const panel = await screen.findByRole("tabpanel");
      expect(within(panel).getByRole("button", { name: MARK })).toHaveClass("MuiButton-variantSolid");
      expect(within(panel).getByRole("button", { name: EDIT })).toHaveClass("MuiButton-variantOutlined");
    });

    describe("the writes", () => {
      const calls = () => {
        const posts: string[] = [];
        let reads = 0;
        server.use(
          http.get(`${TEST_BACKEND_URL}/intake`, () => {
            reads += 1;
            return HttpResponse.json([]);
          }),
          http.post(`${TEST_BACKEND_URL}/reviews`, () => {
            posts.push("POST /reviews");
            return HttpResponse.json(draftOf(1));
          }),
        );
        return { posts, reads: () => reads };
      };

      it("opens the draft from Open draft and sends no POST /reviews", async () => {
        url.search = "?stage=open";
        const { posts } = calls();
        const { user } = renderScreen([held(1)], [draftOf(1)]);

        await user.click(await screen.findByRole("button", { name: OPEN_DRAFT }));

        await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/reviews/61?from=mine&stage=open"));
        expect(posts).toEqual([]);
      });

      it.each([
        ["a disc", held(1), [], [REVIEW_COPY.screen.passConfirm, REVIEW_COPY.screen.passBringDisc]],
        ["a disc with a draft", held(1), [draftOf(1)], [REVIEW_COPY.screen.passConfirm, REVIEW_COPY.screen.passBringDisc, REVIEW_COPY.screen.passDraftSaved]],
        ["a digital album with a draft", digital(1), [draftOf(1)], [REVIEW_COPY.screen.passConfirm, REVIEW_COPY.screen.passDraftSaved]],
      ])("asks the Pass question for %s, and confirming passes, reloads and toasts", async (_name, item, reviews, sentences) => {
        url.search = "?stage=open";
        const passed: string[] = [];
        server.use(http.post(`${TEST_BACKEND_URL}/intake/1/pass`, () => {
          passed.push("pass");
          return HttpResponse.json(intakeItem({ id: 1 }));
        }));
        const { user } = renderScreen([item], [...reviews]);
        const { reads } = calls();

        await user.click(await screen.findByRole("button", { name: PASS }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(sentences.join(" "))).toBeInTheDocument();
        await user.click(within(dialog).getByRole("button", { name: PASS }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith(REVIEW_COPY.screen.passed));
        expect(passed).toEqual(["pass"]);
        expect(reads()).toBeGreaterThan(0);
      });

      it("shows the not-yours line after the reload when passing a held record loses a race", async () => {
        url.search = "?stage=open";
        server.use(http.post(`${TEST_BACKEND_URL}/intake/1/pass`, () => HttpResponse.json({ message: "changed", reason: "state_changed" }, { status: 409 })));
        const { user } = renderScreen([held(1)], []);

        await user.click(await screen.findByRole("button", { name: PASS }));
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: PASS }));

        await waitFor(() => expect(toast).toHaveBeenCalledWith(REVIEW_COPY.screen.raceRelease));
      });

      it.each([
        ["with a submitted review", "?stage=submitted", [sentOf(1)], `${REVIEW_COPY.screen.returnQuestion} ${REVIEW_COPY.screen.markReturnedKeep}`],
        ["with no review of mine", "?stage=open", [], REVIEW_COPY.screen.returnQuestion],
      ])("asks Mark as returned's question %s, and confirming returns the record and toasts", async (_name, search, reviews, body) => {
        url.search = search;
        const released: string[] = [];
        server.use(http.post(`${TEST_BACKEND_URL}/intake/1/release`, () => {
          released.push("release");
          return HttpResponse.json(intakeItem({ id: 1 }));
        }));
        const { user } = renderScreen([reviewedDisc2(1)], [...reviews]);

        await user.click(await screen.findByRole("button", { name: MARK }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(body)).toBeInTheDocument();
        await user.click(within(dialog).getByRole("button", { name: MARK }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith(REVIEW_COPY.screen.returnedWaiting));
        expect(released).toEqual(["release"]);
      });
    });
  });

  it("offers no Show older reviews for a list of 20 or fewer, and never pages Open reviews", async () => {
    url.search = "?stage=open";
    const drafts = Array.from({ length: 25 }, (_, n) => review({ id: n + 1, intake_item_id: null, album_id: 7 }));

    renderScreen([], drafts);
    const panel = await screen.findByRole("tabpanel", { name: STAGES.open });

    expect(within(panel).getAllByRole("link")).toHaveLength(25);
    expect(within(panel).queryByRole("button", { name: REVIEW_COPY.myReviews.showOlder })).not.toBeInTheDocument();
  });

  // Rows 5, 6 and 7 of the copy round the station approved on 2026-10-16 (WXYC/Backend-Service#3382).
  it.each([
    ["stages.open", STAGES.open, "Open reviews"],
    ["stages.submitted", STAGES.submitted, "Submitted"],
    ["stages.published", STAGES.published, "Published"],
    ["openEmpty", REVIEW_COPY.myReviews.openEmpty, "Nothing is waiting on you right now."],
    ["showOlder", REVIEW_COPY.myReviews.showOlder, "Show older reviews"],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  // The station has not approved this wording yet, so this pins it without claiming it is signed off.
  it.each([
    ["stagesLabel", REVIEW_COPY.myReviews.stagesLabel, "Which of my reviews to show"],
  ])("words %s as currently proposed (not yet approved)", (_key, actual, expected) => {
    expect(actual).toBe(expected);
  });
});
