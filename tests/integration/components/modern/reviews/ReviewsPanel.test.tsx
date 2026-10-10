import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, renderWithProviders, review, reviewRevision, reviewsSettled, server } from "@/tests/helpers";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { delay, http, HttpResponse } from "msw";
import type { AlbumReview } from "@wxyc/shared";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

// The print link is gated by the real RequireMD, which resolves the music director tier from the session and the organization role.
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "me", email: "me@wxyc.org", name: "Me", username: "me", role: null, emailVerified: true } },
      isPending: false,
      error: null,
    }),
  },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));
const mockAuth = vi.hoisted(() => ({ authority: 1 as number }));
vi.mock("@/lib/features/authentication/organization-utils", async () => {
  const { Authorization: Role } = await import("@/lib/features/admin/types");
  return {
    fetchOrganizationRoleForUserClient: vi.fn(async () => (mockAuth.authority >= Role.MD ? "musicDirector" : "dj")),
  };
});
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: mockAuth.authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import ReviewsPanel, { Group } from "@/src/components/experiences/modern/reviews/ReviewsPanel";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const RECORD = { artist: "Juana Molina", album: "DOGA", label: "Sonamos" };
const ALBUM_ID = 7;
const submitted = (id: number, overrides = {}) =>
  review({ id, album_id: ALBUM_ID, intake_item_id: null, status: "submitted", on_cover: false, revision_count: 1, medium: "typed", author: `Reviewer ${id}`, review: `Text ${id}`, ...overrides });

const serve = (reviews: ReturnType<typeof submitted>[], archive: Partial<AlbumReview>[] = []) =>
  fakeReviewsEndpoints({
    mine: [submitted(999)],
    forRelease: { [ALBUM_ID]: reviews },
    archive: { [ALBUM_ID]: archive as AlbumReview[] },
  });

const renderPanel = () => renderWithProviders(<ReviewsPanel albumId={ALBUM_ID} record={RECORD} />);
const headings = () => screen.getAllByRole("heading").map((h) => h.textContent);

describe("ReviewsPanel", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
  });

  it("lists the review on the cover, then the others, in the server's order", async () => {
    serve([submitted(1, { on_cover: true }), submitted(3), submitted(2)]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    expect(headings()).toEqual(["The review on the cover", "Other reviews"]);
    const others = screen.getByText("Other reviews").closest("section")!;
    expect(within(others).getAllByRole("listitem").map((li) => /Reviewer \d+/.exec(li.textContent ?? "")?.[0])).toEqual(["Reviewer 3", "Reviewer 2"]);
    expect(screen.queryByText("Reviewer 999", { exact: false })).not.toBeInTheDocument();
  });

  it("uses the plural heading for two reviews on the cover", async () => {
    serve([submitted(1, { on_cover: true }), submitted(2, { on_cover: true })]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    expect(headings()).toEqual(["The reviews on the cover"]);
  });

  it("lists everything under Reviews when none is on the cover", async () => {
    serve([submitted(1), submitted(2)]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    expect(headings()).toEqual(["Reviews"]);
  });

  it("lists a review that is in use but not on this cover with the others", async () => {
    serve([submitted(1, { in_use: true, on_cover: false })]);
    renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    expect(headings()).toEqual(["Reviews"]);
  });

  it("shows a handwritten review without text as on the sleeve, with its author", async () => {
    serve([submitted(1, { medium: "handwritten", review: null, author: "Reviewer One" })]);
    renderPanel();

    expect(await screen.findByText("Reviewer One · on the sleeve")).toBeInTheDocument();
  });

  it("shows the FCC line of a handwritten review without text beside its on the sleeve line", async () => {
    serve([submitted(1, { medium: "handwritten", review: null, author: "Reviewer One", fcc: "Contains no obscenity" })]);
    renderPanel();

    expect(await screen.findByText("Reviewer One · on the sleeve")).toBeInTheDocument();
    expect(screen.getByText("Contains no obscenity")).toBeInTheDocument();
  });

  it("does not name this page's record on the slip of a review of a cited release", async () => {
    serve([submitted(1, { album_id: ALBUM_ID + 1 }), submitted(2)]);
    renderPanel();

    const slips = await screen.findAllByRole("group", { name: REVIEW_COPY.slip.name });
    const cited = slips.find((slip) => within(slip).queryByText("Text 1"))!;
    const own = slips.find((slip) => within(slip).queryByText("Text 2"))!;
    expect(within(cited).queryByText(RECORD.album)).not.toBeInTheDocument();
    expect(within(cited).queryByText(RECORD.artist)).not.toBeInTheDocument();
    expect(within(cited).queryByText(RECORD.label)).not.toBeInTheDocument();
    expect(within(own).getByText(RECORD.album)).toBeInTheDocument();
  });

  it.each([
    ["a music director", Authorization.MD, {}, true],
    ["a DJ", Authorization.DJ, {}, false],
    ["a music director, on a handwritten review without text", Authorization.MD, { medium: "handwritten", review: null }, false],
    ["a music director, on a handwritten review with text", Authorization.MD, { medium: "handwritten", review: "Some text" }, false],
    ["a music director, on a printed review", Authorization.MD, { medium: "printed" }, false],
    ["a music director, on a draft", Authorization.MD, { status: "draft" }, false],
  ])("offers the print link to %s: %s", async (_who, authority, overrides, offered) => {
    mockAuth.authority = authority;
    serve([submitted(1, overrides)]);
    const { store } = renderPanel();

    await screen.findByText("Reviewer 1", { exact: false });
    if (offered) {
      expect(await screen.findByRole("link", { name: "Print the slip" })).toHaveAttribute("href", `/dashboard/admin/library/${ALBUM_ID}/slip/1`);
    } else {
      // Let the gate resolve the role before asserting the link is absent.
      await reviewsSettled(store);
      expect(screen.queryByRole("link", { name: "Print the slip" })).not.toBeInTheDocument();
    }
  });

  it("does not offer a print link on the archive's form-era takes", async () => {
    mockAuth.authority = Authorization.MD;
    serve([], [{ id: 1, reviewer: "Reviewer One", review: "Old take" }]);
    const { store } = renderPanel();

    await screen.findByText("Reviewer One: Old take");
    await reviewsSettled(store);
    expect(screen.queryByRole("link", { name: "Print the slip" })).not.toBeInTheDocument();
  });

  it("links to the history only for a review edited after submitting", async () => {
    serve([submitted(1, { revision_count: 2 }), submitted(2, { revision_count: 1 })]);
    renderPanel();

    const link = await screen.findByRole("link", { name: "Edited · see history" });
    expect(link).toHaveAttribute("href", "/dashboard/reviews/1/history");
    expect(screen.getAllByRole("link", { name: "Edited · see history" })).toHaveLength(1);
  });

  it.each([
    ["archiveTitle", REVIEW_COPY.albumPanel.archiveTitle, "Earlier takes"],
    ["loadFailed", REVIEW_COPY.albumPanel.loadFailed, "Couldn't load the reviews. Please try again."],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it("lists the archive's reviews for the release as earlier takes", async () => {
    serve([], [{ id: 1, reviewer: "Reviewer Old", review: "Archived words" }]);
    renderPanel();

    const section = (await screen.findByText(REVIEW_COPY.albumPanel.archiveTitle)).closest("section")!;
    expect(within(section).getByText("Reviewer Old: Archived words")).toBeInTheDocument();
  });

  it("offers Review this release with the approved nudge beside it", async () => {
    serve([]);
    renderPanel();

    const button = await screen.findByRole("link", { name: "Review this release" });
    expect(button).toHaveAttribute("href", `/dashboard/reviews/new?album_id=${ALBUM_ID}`);
    expect(screen.getByText("New to reviewing? New arrivals on the review shelf need reviews most.")).toBeInTheDocument();
  });

  it("fills the album's FCC notes region with the FCC notes panel", async () => {
    serve([]);
    renderPanel();

    const slot = await screen.findByTestId("fcc-notes-slot");
    expect(await within(slot).findByText("No FCC notes for this record.")).toBeInTheDocument();
    expect(slot).toHaveAttribute("data-album-id", String(ALBUM_ID));
  });

  it.each([
    ["the flag is off", "", Authorization.MD],
    ["a DJ is under staff", "staff", Authorization.DJ],
  ])("renders nothing and reads nothing when %s", async (_label, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    serve([submitted(1)]);
    const requested: string[] = [];
    const log = ({ request }: { request: Request }) => void requested.push(new URL(request.url).pathname);
    server.events.on("request:start", log);

    try {
      const { container, store } = renderPanel();
      await reviewsSettled(store);
      expect(requested).toEqual([]);
      expect(container).toBeEmptyDOMElement();
    } finally {
      server.events.removeListener("request:start", log);
    }
  });

  it("renders for a music director under staff", async () => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    mockAuth.authority = Authorization.MD;
    serve([]);
    renderPanel();

    expect(await screen.findByTestId("fcc-notes-slot")).toBeInTheDocument();
  });

  it.each<[string, boolean, ReturnType<typeof reviewRevision>[], string | null]>([
    ["on the cover, newest revision printed", true, [reviewRevision({ id: 11, review_id: 1, revision: 1 })], "This is the version printed on the cover."],
    ["on the cover, edited after printing", true, [reviewRevision({ id: 11, review_id: 1, revision: 1 }), reviewRevision({ id: 12, review_id: 1, revision: 2 })], "See the printed version"],
    ["not on the cover, newest revision printed", false, [reviewRevision({ id: 11, review_id: 1, revision: 1 })], null],
    ["not on the cover, edited after printing", false, [reviewRevision({ id: 11, review_id: 1, revision: 1 }), reviewRevision({ id: 12, review_id: 1, revision: 2 })], null],
  ])("printed-version note for a printed review %s", async (_name, onCover, list, expected) => {
    const requested = vi.fn();
    fakeReviewsEndpoints({
      forRelease: {
        [ALBUM_ID]: [
          submitted(1, { on_cover: onCover, printed_revision_id: 11, printed_at: "2026-10-02T16:00:00Z" }),
          submitted(2),
        ],
      },
    });
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => { requested(); return HttpResponse.json(list); }));
    const { store } = renderPanel();

    await screen.findByText("Text 1");
    if (expected) {
      expect(await screen.findByText(expected)).toBeInTheDocument();
      expect(requested).toHaveBeenCalledTimes(1);
    } else {
      expect(reviewApi.endpoints.getReviewRevisions.select(1)(store.getState()).isUninitialized).toBe(true);
      await reviewsSettled(store);
      expect(screen.queryByText(/printed on the cover|earlier version of this review|printed version/)).not.toBeInTheDocument();
      expect(requested).not.toHaveBeenCalled();
    }
  });

  describe("the print link's name", () => {
    const two = [reviewRevision({ id: 11, review_id: 1, revision: 1 }), reviewRevision({ id: 12, review_id: 1, revision: 2 })];
    const PRINTED = { printed_revision_id: 11, printed_at: "2026-10-02T16:00:00Z" };
    const { isCurrent, seePrinted, loadFailed } = REVIEW_COPY.printedNote;
    type Revisions = "list" | "fail" | "never";
    // `settled` is text that only shows once the revisions read has resolved, so the name is asserted on the settled state and not on the loading one (which reads "Print the slip" whatever the settled state would read).
    it.each<{ case: string; onCover: boolean; overrides: Record<string, unknown>; revisions: Revisions; expected: string; asked: boolean; settled: string | null }>([
      { case: "never printed", onCover: true, overrides: {}, revisions: "list", expected: "Print the slip", asked: false, settled: null },
      { case: "printed and unchanged, on the cover", onCover: true, overrides: { printed_revision_id: 12, printed_at: PRINTED.printed_at }, revisions: "list", expected: "Print the slip", asked: true, settled: isCurrent },
      { case: "printed and edited since, on the cover", onCover: true, overrides: PRINTED, revisions: "list", expected: "Print a new slip", asked: true, settled: seePrinted },
      { case: "printed and edited since, not on the cover", onCover: false, overrides: PRINTED, revisions: "list", expected: "Print the slip", asked: false, settled: null },
      { case: "printed, on the cover, revisions failing to load", onCover: true, overrides: PRINTED, revisions: "fail", expected: "Print the slip", asked: true, settled: loadFailed },
      { case: "printed, on the cover, revisions still loading", onCover: true, overrides: PRINTED, revisions: "never", expected: "Print the slip", asked: true, settled: null },
      { case: "printed with an unusable printed_at, on the cover, newer revision", onCover: true, overrides: { printed_revision_id: 11, printed_at: "not a date" }, revisions: "list", expected: "Print the slip", asked: true, settled: null },
    ])("reads exactly the approved wording for a review $case", async ({ onCover, overrides, revisions, expected, asked, settled }) => {
      mockAuth.authority = Authorization.MD;
      const requested = vi.fn();
      fakeReviewsEndpoints({ forRelease: { [ALBUM_ID]: [submitted(1, { on_cover: onCover, ...overrides }), submitted(2)] } });
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, async () => {
          requested();
          if (revisions === "never") await delay("infinite");
          return revisions === "fail" ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(two);
        }),
      );
      const { store } = renderPanel();

      const entry = (await screen.findByText("Text 1")).closest("li")!;
      if (asked) await waitFor(() => expect(requested).toHaveBeenCalled());
      if (settled) await within(entry).findByText(settled);
      // Without text to wait for, give a resolved read time to render before asserting.
      else if (asked && revisions === "list") await reviewsSettled(store);
      const link = await within(entry).findByRole("link", { name: expected });
      expect(link).toHaveAttribute("href", `/dashboard/admin/library/${ALBUM_ID}/slip/1`);
      expect(within(entry).getAllByRole("link", { name: /^Print (the|a new) slip$/ })).toHaveLength(1);
      if (!asked) {
        expect(reviewApi.endpoints.getReviewRevisions.select(1)(store.getState()).isUninitialized).toBe(true);
        await reviewsSettled(store);
        expect(requested).not.toHaveBeenCalled();
      }
    });

    it("decides from the onCover it is given, not from the review's own on_cover", async () => {
      mockAuth.authority = Authorization.MD;
      const requested = vi.fn();
      server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => { requested(); return HttpResponse.json(two); }));
      // The record page's other reviews are told they are not on a cover, whatever the review says.
      const { store } = renderWithProviders(
        <Group title="Other reviews" reviews={[submitted(1, { on_cover: true, ...PRINTED })]} recordOf={() => RECORD} printable onCover={() => false} />,
      );

      const entry = (await screen.findByText("Text 1")).closest("li")!;
      expect(await within(entry).findByRole("link", { name: "Print the slip" })).toBeInTheDocument();
      expect(reviewApi.endpoints.getReviewRevisions.select(1)(store.getState()).isUninitialized).toBe(true);
      await reviewsSettled(store);
      expect(requested).not.toHaveBeenCalled();
      expect(within(entry).queryByText(isCurrent)).not.toBeInTheDocument();
    });
  });
});
