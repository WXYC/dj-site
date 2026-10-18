import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
import { ACTIVE_ITEMS, MY_REVIEWS, useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
import { useGetMyReviewsQuery } from "@/lib/features/reviews/reviewApi";
import type { ComponentProps } from "react";
import type { IntakeItem, Review } from "@wxyc/shared";

// The screen takes the shared write wiring from its caller, as ReviewsScreen supplies it.
function WithWrite(props: Omit<ComponentProps<typeof MyReviewsScreen>, "write" | "lock">) {
  const { write, lock } = useReviewWrite();
  return <MyReviewsScreen {...props} write={write} lock={lock} />;
}

// The screen over the lists as the server answers them, so a row a write takes away leaves the list once the write's reload lands.
function Live() {
  const items = useGetIntakeItemsQuery(ACTIVE_ITEMS).data;
  const mine = useGetMyReviewsQuery(MY_REVIEWS).data;
  const { write, lock } = useReviewWrite();
  if (!items || !mine) {
    return null;
  }
  return <MyReviewsScreen items={items} myReviews={mine} me={ME} write={write} lock={lock} />;
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
// Pass and Open draft are named by their own words, then the row's artist and album.
const PASS_BUTTON = /^Pass /;
const OPEN_DRAFT_NAMED = /^Open draft/;
// Exactly the button's own words, then the record's artist and album: it proves the record naming survives a wrapper, which a bare "Open draft" would not.
const openDraftNamed = (artist: string, album: string) => `${REVIEW_COPY.myReviews.openDraft} ${artist} ${album}`;
const asked = (id: number) => intakeItem({ id, state: "requested", effective_state: "requested", ...requestedFor(ME, "DJ Me") });
const held = (id: number, overrides = {}) => intakeItem({ id, state: "checked_out", effective_state: "checked_out", ...heldBy(ME, "DJ Me"), ...overrides });
const submitted = (id: number, overrides = {}) =>
  review({ id, intake_item_id: null, album_id: 7, status: "submitted", in_use: false, submitted_at: `2026-10-${String(id % 28 + 1).padStart(2, "0")}T12:00:00Z`, ...overrides });

beforeEach(() => {
  url.search = "";
  router.replace.mockClear();
  router.push.mockClear();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.success).mockClear();
});

const renderScreen = (items: IntakeItem[], myReviews: Review[], options: Parameters<typeof fakeReviewsEndpoints>[0] = {}) => {
  fakeReviewsEndpoints(options);
  return renderWithProviders(<WithWrite items={items} myReviews={myReviews} me={ME} />);
};

describe("MyReviewsScreen", () => {
  it.each([
    ["the held record the link names", "stage=open&highlight=7", ["Stereolab"]],
    ["nothing without the param", "stage=open", []],
    ["nothing for a record the DJ does not hold", "stage=open&highlight=99", []],
  ])("highlights %s", async (_name, search, marked) => {
    url.search = search;
    renderScreen([held(7, { artist_name: "Stereolab" }), held(8, { artist_name: "Cat Power" })], []);

    await screen.findByText("Stereolab");
    const rows = screen.getAllByRole("listitem");
    expect(rows.filter((row) => row.dataset.highlighted === "true").map((row) => ["Stereolab", "Cat Power"].find((a) => row.textContent?.includes(a)))).toEqual(marked);
  });

  describe("bringing the highlighted row into view", () => {
    let scroll: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    });
    afterEach(() => {
      scroll.mockRestore();
    });
    const scrolledTo = () => scroll.mock.contexts.map((el: unknown) => (el as HTMLElement).closest("li")?.textContent ?? "");

    it("scrolls the highlighted row into view, and no other", async () => {
      url.search = "stage=open&highlight=7";
      renderScreen([held(7, { artist_name: "Stereolab" }), held(8, { artist_name: "Cat Power" })], []);

      await screen.findByText("Stereolab");

      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scrolledTo()[0]).toContain("Stereolab");
    });

    it("scrolls to the row when it only arrives after the first draw, as the reload that follows a checkout brings it", async () => {
      url.search = "stage=open&highlight=7";
      fakeReviewsEndpoints();
      const { rerender } = renderWithProviders(<WithWrite items={[held(8, { artist_name: "Cat Power" })]} myReviews={[]} me={ME} />);
      await screen.findByText("Cat Power");
      expect(scroll).not.toHaveBeenCalled();

      rerender(<WithWrite items={[held(8, { artist_name: "Cat Power" }), held(7, { artist_name: "Stereolab" })]} myReviews={[]} me={ME} />);

      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
      expect(scrolledTo()[0]).toContain("Stereolab");
    });

    describe("marking the row only once", () => {
      // The address the screen reads follows `history.replaceState`, as the App Router syncs it to `useSearchParams`.
      const realReplace = window.history.replaceState.bind(window.history);
      let replace: ReturnType<typeof vi.spyOn>;
      beforeEach(() => {
        replace = vi.spyOn(window.history, "replaceState").mockImplementation((state, unused, target) => {
          realReplace(state, unused, target);
          url.search = window.location.search;
        });
      });
      afterEach(() => {
        replace.mockRestore();
        realReplace(null, "", "/");
      });
      const marked = () => screen.queryAllByRole("listitem").filter((row) => row.dataset.highlighted === "true");
      type Again = { user: ReturnType<typeof renderScreen>["user"]; redraw: () => void };

      it.each([
        [
          "a Back from the editor or a reload, which draws the screen again from the address",
          async ({ redraw }: Again) => {
            redraw();
            await screen.findByText("Stereolab");
          },
        ],
        [
          "a switch to Submitted and back to Open reviews",
          async ({ user }: Again) => {
            await user.click(screen.getByRole("tab", { name: `${STAGES.submitted}, 0` }));
            await user.click(screen.getByRole("tab", { name: `${STAGES.open}, 2` }));
            await screen.findByText("Stereolab");
          },
        ],
      ])("marks and scrolls to the row once, not again after %s", async (_name, again) => {
        realReplace(null, "", "/dashboard/reviews/mine?stage=open&highlight=7");
        url.search = window.location.search;
        const items = [held(7, { artist_name: "Stereolab" }), held(8, { artist_name: "Cat Power" })];
        const { unmount, user } = renderScreen(items, []);
        await screen.findByText("Stereolab");
        expect(marked()).toHaveLength(1);
        // The address drops the record once its row is drawn, and the row keeps its mark.
        expect(url.search).toBe("?stage=open");

        await again({
          user,
          redraw: () => {
            unmount();
            renderScreen(items, []);
          },
        });

        expect(marked()).toHaveLength(0);
        expect(scroll).toHaveBeenCalledTimes(1);
      });
    });

    it("scrolls nothing when no row is highlighted", async () => {
      url.search = "stage=open";
      renderScreen([held(7, { artist_name: "Stereolab" })], []);

      await screen.findByText("Stereolab");

      expect(scroll).not.toHaveBeenCalled();
    });
  });

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
    expect(within(open).getAllByRole("button", { name: PASS_BUTTON })).toHaveLength(2);
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
    ["the Open draft link, from the tab with no stage and something open", "", [], [submitted(33), draft34], { link: OPEN_DRAFT_NAMED }, 34, "open"],
    ["the Open link, from the tab with no stage and nothing open", "", [], [submitted(33)], { link: REVIEW_COPY.myReviews.open }, 33, "submitted"],
    ["the Open draft link on Open reviews", "?stage=open", [], [submitted(33), draft34], { link: OPEN_DRAFT_NAMED }, 34, "open"],
    ["the Open link on Submitted", "?stage=submitted", [], [submitted(33), draft34], { link: REVIEW_COPY.myReviews.open }, 33, "submitted"],
    ["the Open link on Published", "?stage=published", [], [submitted(35, { in_use: true }), draft34], { link: REVIEW_COPY.myReviews.open }, 35, "published"],
    ["the Open link, from a stage the URL names wrongly", "?stage=elsewhere", [], [submitted(33)], { link: REVIEW_COPY.myReviews.open }, 33, "submitted"],
    ["Open draft on a record with a draft, from the tab with no stage", "", [held(8)], [review({ id: 31, intake_item_id: 8, status: "draft" })], { button: OPEN_DRAFT_NAMED }, 31, "open"],
    ["Open draft on a record with a draft, on Open reviews", "?stage=open", [held(8)], [review({ id: 31, intake_item_id: 8, status: "draft" })], { button: OPEN_DRAFT_NAMED }, 31, "open"],
    ["Open draft on a record with a draft, from a stage the URL names wrongly", "?stage=elsewhere", [held(8)], [review({ id: 31, intake_item_id: 8, status: "draft" })], { button: OPEN_DRAFT_NAMED }, 31, "open"],
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
      // A draft on a record the DJ no longer has reads the same whichever way the record left: the lists cannot tell a pass from a return.
      ["a draft on a record back on the review shelf", "?stage=open", [intakeItem({ id: 1 })], [draftOf(1)], [OPEN_DRAFT], [REVIEW_COPY.myReviews.draftSaved, lastSaved(draftOf(1))], [WRITE, PASS, MARK]],
      ["a draft on a reviewed record I marked as returned", "?stage=open", [intakeItem({ id: 1, state: "reviewed", effective_state: "reviewed", submitted_review_count: 1 })], [draftOf(1)], [OPEN_DRAFT], [REVIEW_COPY.myReviews.draftSaved, lastSaved(draftOf(1))], [WRITE, PASS, MARK]],
      ["a draft on a filed record", "?stage=open", [intakeItem({ id: 1, state: "filed", effective_state: "filed" })], [draftOf(1)], [OPEN_DRAFT], [REVIEW_COPY.myReviews.draftSaved, lastSaved(draftOf(1))], [WRITE, PASS, MARK]],
      ["a request", "?stage=open", [asked(1)], [], [WRITE, PASS], [REVIEW_COPY.screen.requestedNoAsker(day(asked(1).requested_at))], [OPEN_DRAFT, MARK]],
    ])("draws %s", async (_name, search, items, reviews, buttons, lines, absent) => {
      url.search = search;

      renderScreen(items, reviews);

      const panel = await screen.findByRole("tabpanel");
      const texts = within(panel).getAllByRole("button").map((b) => b.textContent);
      expect(texts).toEqual(buttons);
      for (const line of lines) {
        expect(within(panel).getByText(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeInTheDocument();
      }
      for (const name of absent) {
        expect(texts).not.toContain(name);
      }
      // Only a pass says the DJ passed, and the lists never show which way a record left.
      expect(panel).not.toHaveTextContent(/You passed/);
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

        await user.click(await screen.findByRole("button", { name: OPEN_DRAFT_NAMED }));

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

        await user.click(await screen.findByRole("button", { name: PASS_BUTTON }));
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

        await user.click(await screen.findByRole("button", { name: PASS_BUTTON }));
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: PASS }));

        await waitFor(() => expect(toast).toHaveBeenCalledWith(REVIEW_COPY.screen.raceRelease));
      });

      // Only a DJ with a submitted review hears that the review is with the music directors; any other return says nothing once it lands, as Return to the review shelf did.
      it.each([
        ["with a submitted review", "?stage=submitted", [sentOf(1)], `${REVIEW_COPY.screen.returnQuestion} ${REVIEW_COPY.screen.markReturnedKeep}`, REVIEW_COPY.screen.returnedWaiting],
        ["with no review of mine", "?stage=open", [], REVIEW_COPY.screen.returnQuestion, null],
        ["with only a draft of mine", "?stage=open", [draftOf(1)], `${REVIEW_COPY.screen.returnQuestion} ${REVIEW_COPY.screen.passDraftSaved}`, null],
      ])("asks Mark as returned's question %s, and confirming returns the record", async (_name, search, reviews, body, toasted) => {
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

        await waitFor(() => expect(released).toEqual(["release"]));
        await waitFor(() => expect(screen.getByRole("button", { name: MARK })).toBeEnabled());
        if (toasted) {
          expect(toast.success).toHaveBeenCalledWith(toasted);
        } else {
          expect(toast.success).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe("a review's own row", () => {
    const filed = (id: number, artist: string, album: string) => intakeItem({ id, artist_name: artist, album_title: album, state: "filed", effective_state: "filed" });
    const release = (id: number, artist: string, album: string) => ({ id, artist_name: artist, album_title: album, record_label: "Drag City", format_name: "cd", legacy_release_id: id });
    const records = [filed(1, "Juana Molina", "DOGA"), filed(2, "Cat Power", "Moon Pix")];
    const releases = [release(7, "Jessica Pratt", "On Your Own Love Again"), release(8, "Stereolab", "Dots and Loops")];

    // Every draft opens with Open draft, whatever its subject; a draft on a record keeps its button and a library release's draft keeps its link. A submitted review keeps Open.
    it.each([
      ["a draft on a record I no longer have", "?stage=open", (id: number) => review({ id: 50 + id, intake_item_id: id, status: "draft" }), "button", REVIEW_COPY.myReviews.openDraft],
      ["a draft of a library release", "?stage=open", (id: number) => review({ id: 50 + id, intake_item_id: null, album_id: id + 6, status: "draft" }), "link", REVIEW_COPY.myReviews.openDraft],
      ["a submitted review of a record I no longer have", "?stage=submitted", (id: number) => submitted(50 + id, { intake_item_id: id, album_id: null }), "link", REVIEW_COPY.myReviews.open],
      ["a submitted review of a library release", "?stage=submitted", (id: number) => submitted(50 + id, { album_id: id + 6 }), "link", REVIEW_COPY.myReviews.open],
    ] as const)("opens %s with its own words", async (_name, search, make, role, words) => {
      url.search = search;

      renderScreen([], [make(1)], { records, releases });

      const panel = await screen.findByRole("tabpanel");
      const opener = await within(panel).findByRole(role, { name: words === REVIEW_COPY.myReviews.open ? words : OPEN_DRAFT_NAMED });
      expect(opener).toHaveTextContent(new RegExp(`^${words}$`));
      expect(within(panel).queryAllByRole("link", { name: words === REVIEW_COPY.myReviews.open ? OPEN_DRAFT_NAMED : REVIEW_COPY.myReviews.open })).toEqual([]);
      expect(within(panel).queryAllByRole("button", { name: words === REVIEW_COPY.myReviews.open ? OPEN_DRAFT_NAMED : REVIEW_COPY.myReviews.open })).toEqual([]);
    });

    // A screen reader's list of buttons tells each row's Pass and Open draft apart by the record, as the review shelf names Ask a DJ….
    const two = (rows: IntakeItem[]) => rows.map((i, n) => ({ ...i, ...[{ artist_name: "Juana Molina", album_title: "DOGA" }, { artist_name: "Cat Power", album_title: "Moon Pix" }][n] }));
    const ON_RECORDS = ["Juana Molina DOGA", "Cat Power Moon Pix"];
    const ON_RELEASES = ["Jessica Pratt On Your Own Love Again", "Stereolab Dots and Loops"];
    it.each([
      ["a request", two([asked(1), asked(2)]), [], "button", REVIEW_COPY.screen.pass, ON_RECORDS],
      ["a record I have", two([held(1), held(2)]), [], "button", REVIEW_COPY.screen.pass, ON_RECORDS],
      ["a record I have with a draft", two([held(1), held(2)]), [review({ id: 51, intake_item_id: 1 }), review({ id: 52, intake_item_id: 2 })], "button", REVIEW_COPY.myReviews.openDraft, ON_RECORDS],
      ["a draft on a record I no longer have", [], [review({ id: 51, intake_item_id: 1 }), review({ id: 52, intake_item_id: 2 })], "button", REVIEW_COPY.myReviews.openDraft, ON_RECORDS],
      ["a draft of a library release", [], [review({ id: 51, intake_item_id: null, album_id: 7 }), review({ id: 52, intake_item_id: null, album_id: 8 })], "link", REVIEW_COPY.myReviews.openDraft, ON_RELEASES],
    ] as const)("names each %s row's button by its record", async (_name, items, reviews, role, words, names) => {
      url.search = "?stage=open";

      renderScreen([...items], [...reviews], { records, releases });

      const panel = await screen.findByRole("tabpanel");
      for (const record of names) {
        expect(await within(panel).findByRole(role, { name: `${words} ${record}` })).toBeInTheDocument();
      }
    });
  });

  describe("the focus once a row's write takes the row away", () => {
    // Each record carries Preview links, drawn before the row's buttons, so the focus has to pass them to reach the row's main button.
    const named = (i: IntakeItem, n: number) => ({
      ...i,
      ...[{ artist_name: "Juana Molina", album_title: "DOGA" }, { artist_name: "Cat Power", album_title: "Moon Pix" }][n],
      spotify_url: `https://open.spotify.com/album/${n + 1}`,
      discogs_release_id: 40 + n,
    });
    const reviewedDisc = (id: number) => held(id, { state: "reviewed", effective_state: "reviewed", submitted_review_count: 1 });
    const sent = (id: number) => [review({ id: 70 + id, intake_item_id: id, status: "submitted", in_use: false, submitted_at: `2026-10-0${id}T12:00:00Z` })];

    // Each action over each row kind it is drawn on: the row's first button, then the confirmation's.
    const ACTIONS = [
      ["Pass on a request", "?stage=open", asked, (): Review[] => [], "pass", REVIEW_COPY.screen.pass],
      ["Pass on a record I have", "?stage=open", held, (): Review[] => [], "pass", REVIEW_COPY.screen.pass],
      ["Mark as returned on a reviewed disc", "?stage=submitted", reviewedDisc, sent, "release", REVIEW_COPY.intake.returned],
    ] as const;

    const serve = (rows: IntakeItem[], reviews: Review[], action: string) => {
      let left = rows;
      // A submitted review outlives the return: it stays in the DJ's list, as its own row.
      fakeReviewsEndpoints({ open: () => left, mine: reviews });
      server.use(http.post(`${TEST_BACKEND_URL}/intake/:id/${action}`, ({ params }) => {
        left = left.filter((i) => String(i.id) !== params.id);
        return HttpResponse.json(intakeItem({ id: Number(params.id) }));
      }));
    };

    const act = async (user: ReturnType<typeof renderWithProviders>["user"], row: HTMLElement, words: string) => {
      await user.click(within(row).getByRole("button", { name: new RegExp(`^${words}`) }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: words }));
    };

    describe.each(ACTIONS)("%s", (_name, search, make, reviewsOf, action, words) => {
      // Indexes are the rows' order on the screen.
      it.each([
        ["the next row's first button, when a row follows", 0, 1],
        ["the previous row's first button, when it was the last row", 1, 0],
      ])("moves the focus to %s", async (_where, acted, kept) => {
        url.search = search;
        serve([make(1), make(2)].map(named), [...reviewsOf(1), ...reviewsOf(2)], action);
        const { user } = renderWithProviders(<Live />);
        const panel = await screen.findByRole("tabpanel");
        await within(panel).findByText("Moon Pix");
        const rows = within(panel).getAllByRole("listitem");
        const album = within(rows[acted]).getByText(/^(DOGA|Moon Pix)$/).textContent!;
        const keptFirst = within(rows[kept]).getAllByRole("button")[0];
        expect(within(rows[kept]).getAllByRole("link", { name: /opens in a new tab/i }).length).toBeGreaterThan(0);

        await act(user, rows[acted], words);

        await waitFor(() => expect(within(panel).queryByText(album)).not.toBeInTheDocument());
        await waitFor(() => expect(keptFirst).toHaveFocus());
      });

      it("moves the focus to the stage's panel when it was the only row", async () => {
        url.search = search;
        serve([named(make(1), 0)], [...reviewsOf(1)], action);
        const { user } = renderWithProviders(<Live />);
        const panel = await screen.findByRole("tabpanel");
        await within(panel).findByText("DOGA");

        await act(user, within(panel).getByRole("listitem"), words);

        await waitFor(() => expect(within(panel).queryByText("DOGA")).not.toBeInTheDocument());
        await waitFor(() => expect(panel).toHaveFocus());
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

describe("MyReviewsScreen tooltips", () => {
  const DOGA = intakeItem({ id: 1, artist_name: "Juana Molina", album_title: "DOGA", state: "filed", effective_state: "filed" });

  it.each([
    ["Write a review on a request", [asked(7)], [], {}, REVIEW_COPY.writeReview, REVIEW_COPY.tooltips.writeRequest],
    ["Pass on a request", [asked(7)], [], {}, PASS_BUTTON, REVIEW_COPY.tooltips.passRequest],
    ["Write a review on a record the DJ has", [held(8)], [], {}, REVIEW_COPY.writeReview, REVIEW_COPY.tooltips.openEditor],
    ["Pass on a record the DJ has", [held(8)], [], {}, PASS_BUTTON, REVIEW_COPY.tooltips.passHeld],
    ["Open draft on a record the DJ has", [held(8)], [review({ id: 3, intake_item_id: 8, status: "draft" })], {}, openDraftNamed("Stereolab", "Aluminum Tunes"), REVIEW_COPY.tooltips.openEditor],
    ["Open draft on a record the DJ no longer has", [], [review({ id: 3, intake_item_id: 1, status: "draft" })], { records: [DOGA] }, openDraftNamed("Juana Molina", "DOGA"), REVIEW_COPY.tooltips.openEditor],
  ])("describes %s with its approved text and leaves its name alone", async (_button, items, mine, options, name, description) => {
    url.search = "?stage=open";
    renderScreen(items, mine, options);

    expect(await screen.findByRole("button", { name, description })).toBeInTheDocument();
  });

  // Mark as returned on this screen is the DJ's own button. The station approved row 58's line for the music directors' button only.
  it("gives the DJ's own Mark as returned no tooltip and no description", async () => {
    renderScreen([held(8, { effective_state: "reviewed", submitted_review_count: 1 })], [review({ id: 3, intake_item_id: 8, status: "submitted" })]);

    const button = await screen.findByRole("button", { name: REVIEW_COPY.intake.returned });
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(button).toHaveAccessibleDescription("");
  });
});
