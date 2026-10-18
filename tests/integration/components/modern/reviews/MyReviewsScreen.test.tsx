import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { fakeReviewsEndpoints, heldBy, intakeItem, renderWithProviders, requestedFor, review } from "@/tests/helpers";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import MyReviewsScreen from "@/src/components/experiences/modern/reviews/MyReviewsScreen";
import { useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";
import type { ComponentProps } from "react";
import type { IntakeItem, Review } from "@wxyc/shared";

// The screen takes the shared write wiring from its caller, as ReviewsScreen supplies it.
function WithWrite(props: Omit<ComponentProps<typeof MyReviewsScreen>, "write" | "lock">) {
  const { write, lock } = useReviewWrite(props.items);
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
  it("draws the chips with their counts, and Open reviews holds requests and records I have", async () => {
    renderScreen([asked(7), held(8)], [submitted(40), submitted(41, { in_use: true })]);

    const tabs = await screen.findAllByRole("tab");
    expect([`${STAGES.open}, 2`, `${STAGES.submitted}, 1`, `${STAGES.published}, 1`].map((name) => screen.getByRole("tab", { name }))).toEqual(tabs);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    const open = screen.getByRole("tabpanel", { name: STAGES.open });
    expect(within(open).getAllByRole("button", { name: REVIEW_COPY.writeReview })).toHaveLength(2);
    expect(within(open).getByRole("button", { name: REVIEW_COPY.screen.pass })).toBeInTheDocument();
    expect(within(open).getByRole("button", { name: REVIEW_COPY.screen.returnToShelf })).toBeInTheDocument();
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

  it("puts a disc I have whose review was chosen under Published, with its approved line and Return to the review shelf", async () => {
    url.search = "?stage=published";
    const disc = held(2, { state: "reviewed", effective_state: "reviewed" });

    renderScreen([disc], [submitted(40, { intake_item_id: 2, album_id: null, in_use: true })]);

    const published = await screen.findByRole("tabpanel", { name: STAGES.published });
    expect(within(published).getByText(REVIEW_COPY.screen.reviewedReturn)).toBeInTheDocument();
    expect(within(published).getByRole("button", { name: REVIEW_COPY.screen.returnToShelf })).toBeInTheDocument();
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

  // Every way out of this tab to the editor says where it was opened from, and keeps the stage the DJ was looking at.
  describe.each([
    ["", "?from=mine"],
    ["?stage=open", "?from=mine&stage=open"],
    ["?stage=submitted", "?from=mine&stage=submitted"],
    ["?stage=elsewhere", "?from=mine"],
  ])("with %j in the URL", (search, query) => {
    it("the Open link carries it", async () => {
      url.search = search;
      renderScreen([], [submitted(33), review({ id: 34, intake_item_id: null, album_id: 7, status: "draft" })]);
      const links = await screen.findAllByRole("link", { name: REVIEW_COPY.myReviews.open });
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute("href")).toMatch(new RegExp(`^/dashboard/reviews/3[34]${query.replace("?", "\\?")}$`));
    });

    it.each([
      ["Write review on a record with a draft", ["", "?stage=open", "?stage=elsewhere"], [held(8)], [review({ id: 31, intake_item_id: 8, status: "draft" })], REVIEW_COPY.writeReview, 31],
      ["Edit review on a record with a submitted review", ["", "?stage=submitted", "?stage=elsewhere"], [held(9)], [review({ id: 32, intake_item_id: 9, status: "submitted" })], REVIEW_COPY.screen.editReview, 32],
    ])("%s carries it", async (_name, shownOn, items, reviews, button, id) => {
      // Only the chosen stage's rows are drawn: a record with a draft is under Open reviews, one with a submitted review under Submitted.
      if (!shownOn.includes(search)) {
        return;
      }
      url.search = search;
      const { user } = renderScreen(items, reviews);
      await user.click(await screen.findByRole("button", { name: button }));
      await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dashboard/reviews/${id}${query}`));
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
