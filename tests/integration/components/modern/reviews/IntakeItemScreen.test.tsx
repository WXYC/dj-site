import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, fccNote, heldBy, holdResponse, intakeItem, pendingCount, removedHolder, renderedFrame, renderWithProviders, requestedFor, returned, review, reviewRevision, reviewsSettled, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { fakeRotationCardsEndpoints } from "@/tests/fakes/rotation";
import { fakeLibraryFilingsEndpoint, filingConflictResponse } from "@/tests/fakes/libraryFilings";
import { Authorization } from "@/lib/features/admin/types";
import { reviewsApi } from "@/lib/features/reviews/api";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { intakeApi } from "@/lib/features/reviews/intakeApi";

// The bench's artist field is gated by AuthorizedView, which resolves the music director tier from the session.
const listUsers = vi.hoisted(() => vi.fn());
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: { listUsers },
    useSession: () => ({
      data: { user: { id: "md-me", email: "md@wxyc.org", name: "MD", username: "md", role: null, emailVerified: true } },
      isPending: false,
      error: null,
    }),
  },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));
vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn().mockResolvedValue("musicDirector"),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock("next/font/google", () => ({ Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }) }));
vi.mock("next/font/local", () => ({ default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }) }));

vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() });
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { toast } from "sonner";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import type { NewReviewRequest, Review } from "@wxyc/shared";
import { CssVarsProvider } from "@mui/joy/styles";
import modernTheme from "@/lib/features/experiences/modern/theme";
import RecordReviewForm from "@/src/components/experiences/modern/reviews/RecordReviewForm";
import { PAPER_START, formReviewStart } from "@/lib/features/reviews/formReviewStart";
import IntakeItemScreen, { nextRecording } from "@/src/components/experiences/modern/reviews/IntakeItemScreen";
import { useGetRotationListQuery } from "@/lib/features/rotation/api";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { useGetReviewsForReleaseQuery } from "@/lib/features/reviews/reviewApi";
import { useGetFccNotesQuery } from "@/lib/features/reviews/fccNoteApi";

const ITEM_ID = 11;
const GENRE_ID = 1;
const ARTIST_ID = 5;

const dogaItem = (overrides = {}) =>
  intakeItem({
    id: ITEM_ID,
    artist_name: "Juana Molina",
    album_title: "DOGA",
    record_label: "Sonamos",
    state: "reviewed",
    effective_state: "reviewed",
    submitted_review_count: 2,
    accepted_review_id: 40,
    ...overrides,
  });

const submitted = (id: number, overrides = {}) =>
  review({ id, intake_item_id: ITEM_ID, status: "submitted", author: `DJ ${id}`, review: `Take ${id}.`, add_date: "2026-10-01", ...overrides });

const draft = (id: number, overrides = {}) => submitted(id, { status: "draft", ...overrides });

const FILED_ITEM_PATH = `${TEST_BACKEND_URL}/intake/${ITEM_ID}`;
const ACCEPT_URL = `${TEST_BACKEND_URL}/intake/${ITEM_ID}/accept-review`;
/** Every Use this review and Delete review button on the page. Throws when there is none, so a check that they are enabled cannot pass on a page that lost them. */
const guarded = () => [...screen.getAllByRole("button", { name: /^Use this review/ }), ...screen.getAllByRole("button", { name: /^Delete review by/ })];

/** Serves accept-review by putting review 41 on the cover of the box's item. */
const acceptingReview = (box: { item: ReturnType<typeof dogaItem> }) =>
  http.post(ACCEPT_URL, () => {
    box.item = { ...box.item, accepted_review_id: 41 };
    return HttpResponse.json(box.item);
  });

/** Serves the item through a mutable box, so a spec can change the answer between reads, or hold a read in flight. */
function serveItem(initial: ReturnType<typeof dogaItem>) {
  const box = { item: initial, reads: 0, fail: false, hold: null as Promise<void> | null };
  server.use(
    http.get(FILED_ITEM_PATH, async () => {
      box.reads += 1;
      if (box.hold) await box.hold;
      return box.fail ? HttpResponse.json({ message: "boom" }, { status: 500 }) : HttpResponse.json(box.item);
    }),
  );
  return box;
}

/**
 * Serves this item's reviews (`GET /reviews?intake_item_id=`) through a mutable box: `list` is what the next read
 * answers, `reads` counts reads of this item's reviews only, `fail` answers a 500, `gone` answers the 404 of a deleted
 * record, and `hold` is a promise every read awaits. Any other review query (`album_id`, `mine`, ...) is left to the
 * handlers `fakeReviewsEndpoints` registered, so the spec's `forRelease`, `mine` and `reviews` options still apply.
 */
function serveItemReviews(initial: Review[]) {
  const box = { list: initial, reads: 0, fail: false, gone: false, hold: null as Promise<void> | null };
  server.use(
    http.get(`${TEST_BACKEND_URL}/reviews`, async ({ request }) => {
      if (new URL(request.url).searchParams.get("intake_item_id") !== String(ITEM_ID)) return undefined;
      box.reads += 1;
      if (box.hold) await box.hold;
      if (box.gone) return HttpResponse.json({ message: "Intake item not found" }, { status: 404 });
      return box.fail ? HttpResponse.json({ message: "boom" }, { status: 500 }) : HttpResponse.json(box.list);
    }),
  );
  return box;
}

const tapedSlips = () =>
  screen.getAllByRole("group", { name: "Slip preview" }).filter((g) => g.querySelector(":scope > [aria-hidden='true']"));

const listsAndCards = () => {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () => HttpResponse.json([{ id: GENRE_ID, genre_name: "Rock" }])),
    http.get(`${TEST_BACKEND_URL}/library/artists/search`, () =>
      HttpResponse.json({ artists: [{ id: ARTIST_ID, artist_name: "Juana Molina", code_letters: "JM", code_number: 1 }] }),
    ),
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () => HttpResponse.json({ next_code_number: 7 })),
  );
  fakeRotationCardsEndpoints([{ id: 32, bin: "H", number: 2, name: null }]);
};

// The bench reads the modern theme's rotation palette.
const renderScreen = (ui: React.ReactElement) =>
  renderWithProviders(<CssVarsProvider theme={modernTheme}>{ui}</CssVarsProvider>);

type User = ReturnType<typeof renderWithProviders>["user"];

const NEW_ARM = "New to the library";
const EXISTING_ARM = "Already in the library?";
const DELETE_HINT = "Delete this record only if it was logged by mistake. Its reviews and drafts go with it.";

/** Chooses one of the filing section's two arms; a filing form is not on the page until then. */
const chooseArm = async (user: User, name: string) => {
  await user.click(await screen.findByRole("radio", { name }));
};

/** Gets the prefilled bench to a submittable state, with the one choice the item cannot supply. */
async function readyBench(user: User) {
  await chooseArm(user, NEW_ARM);
  await user.click(await screen.findByRole("combobox", { name: "Genre" }));
  await user.click(await screen.findByRole("option", { name: "Rock" }));
  const artist = await screen.findByDisplayValue("Juana Molina");
  await user.clear(artist);
  await user.type(artist, "Juana");
  await user.click(await screen.findByRole("option", { name: "Juana Molina" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-pressed", "true"));
}

const RELEASE_ROW = { id: 5, album_title: "DOGA", artist_name: "Juana Molina", label: "Sonamos", genre_name: "Rock", format_name: "cd", code_letters: "MO", code_artist_number: 1, code_number: 1, add_date: "2026-01-01", plays: 0 };
const VINYL_ROW = { ...RELEASE_ROW, id: 6, format_name: "vinyl", code_number: 2 };
const ROW_NAME = "Juana Molina · DOGA · CD";
const FILE_URL = `${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`;

const search = async (user: User, term: string) => {
  await chooseArm(user, EXISTING_ARM);
  const box = await screen.findByRole("searchbox", { name: "Search the library" });
  await user.clear(box);
  await user.type(box, term);
  await user.click(screen.getByRole("button", { name: "Search" }));
};

const pick = async (user: User, name = ROW_NAME) => {
  await search(user, "Juana");
  await user.click(await screen.findByRole("button", { name }));
};

const pickDoga = async (user: User) => {
  await pick(user);
  await user.click(screen.getByRole("button", { name: "File it as this one" }));
};

/** What each refusal's line is, and what the page shows once the record has reloaded after it. */
const REFUSALS = [
  ["state_changed", "This record has already been filed. The page has been reloaded.", "filed"],
  ["not_reviewed", "This record has no review chosen for the cover, so it can't be filed yet.", "unchosen"],
] as const;

describe("IntakeItemScreen", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    listsAndCards();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["printSlip", REVIEW_COPY.intakeItem.printSlip, "Print the slip"],
    ["fromHolder", REVIEW_COPY.intake.fromHolder("Jessica Pratt"), "From Jessica Pratt, who has this record."],
    ["fromWith", REVIEW_COPY.intake.fromWith("Jessica Pratt", "Sessa"), "From Jessica Pratt. The record is with Sessa."],
    ["fromHeldFor", REVIEW_COPY.intake.fromHeldFor("Jessica Pratt", "Sessa"), "From Jessica Pratt. The record is being held for Sessa."],
    ["fromShelf", REVIEW_COPY.intake.fromShelf("Jessica Pratt"), "From Jessica Pratt. The record is on the review shelf."],
    ["fromRemoved", REVIEW_COPY.intake.fromRemoved("Jessica Pratt"), "From Jessica Pratt. The record is checked out; holder removed."],
    ["useThisReview", REVIEW_COPY.intakeItem.useThisReview, "Use this review"],
    ["useThisReviewInstead", REVIEW_COPY.intakeItem.useThisReviewInstead, "Use this review instead"],
    [
      "replaceCover",
      REVIEW_COPY.intakeItem.replaceCover,
      "Replace the review on the cover with this one? If a slip is already taped to the record, print the slip again to replace it.",
    ],
    ["stillOutWith", REVIEW_COPY.intakeItem.stillOutWith("Sessa"), "The record is still out with Sessa."],
    [
      "reviewGone",
      REVIEW_COPY.intakeItem.reviewGone,
      "That review can't be used for this record any more. It may have been deleted since the page opened. The page has been refreshed.",
    ],
    ["deleteReview", REVIEW_COPY.intakeItem.deleteReview, "Delete review"],
    ["deleteReviewBy", REVIEW_COPY.intakeItem.deleteReviewBy("Cat Power"), "Delete review by Cat Power"],
    [
      "deleteReviewConfirm",
      REVIEW_COPY.intakeItem.deleteReviewConfirm("Cat Power"),
      "Delete Cat Power's review? Its history goes with it. This cannot be undone.",
    ],
    [
      "deleteCoverHeld",
      REVIEW_COPY.intakeItem.deleteCoverHeld("Sessa"),
      "This is the review on the cover. Deleting it sends the record back to Sessa. Its history goes with it. This cannot be undone.",
    ],
    [
      "deleteCoverShelf",
      REVIEW_COPY.intakeItem.deleteCoverShelf,
      "This is the review on the cover. Deleting it sends the record back to the review shelf. Its history goes with it. This cannot be undone.",
    ],
    [
      "deleteCoverRemoved",
      REVIEW_COPY.intakeItem.deleteCoverRemoved,
      "This is the review on the cover. Deleting it puts the record back as checked out; its holder's account was removed.",
    ],
    [
      "coverFiled",
      REVIEW_COPY.intakeItem.deleteCoverFiled,
      "This is the record's review and the record is already filed. Choose another review for the cover first, then delete this one.",
    ],
    ["couldNotDelete", REVIEW_COPY.couldNotDelete, "Couldn't delete the review. Please try again."],
    ["writeFailed", REVIEW_COPY.screen.writeFailed, "Couldn't do that. Please try again."],
    [
      "handwritten",
      REVIEW_COPY.intakeSlip.handwritten,
      "The record's review is handwritten, so it is already on the sleeve. There is nothing to print.",
    ],
    ["recordTitle", REVIEW_COPY.record.title, "Record a review"],
    ["recordAuthor", REVIEW_COPY.record.author, "Author"],
    ["recordAuthorBlank", REVIEW_COPY.record.authorBlank, "Say who wrote the review."],
    ["recordTextBlank", REVIEW_COPY.record.textBlank, "Write the review before you save it."],
    ["recordAccount", REVIEW_COPY.record.account, "Link to an account (optional)"],
    ["recordNotLinked", REVIEW_COPY.record.notLinked, "Not linked"],
    ["recordAccountsFailed", REVIEW_COPY.record.accountsFailed, "Couldn't load the accounts. Please try again."],
    ["recordMedium", REVIEW_COPY.record.medium, "Typed or handwritten?"],
    ["recordTyped", REVIEW_COPY.record.typed, "Typed"],
    ["recordHandwritten", REVIEW_COPY.record.handwritten, "Handwritten"],
    [
      "recordHandwrittenNote",
      REVIEW_COPY.record.handwrittenNote,
      "This review is handwritten, so it is already on the sleeve. Nothing will be printed.",
    ],
    [
      "recordNoConsent",
      REVIEW_COPY.record.noConsent,
      "Nothing is ticked for publishing: the author hasn't been asked where this review may be published.",
    ],
    ["recordCopiedFromForm", REVIEW_COPY.record.copiedFromForm, "Copied from the review form. Check it, then save."],
    ["recordCopiedAuthor", REVIEW_COPY.record.copiedAuthor, "Copied as the reviewer wrote it, so it may include a date."],
    ["recordCopiedNoName", REVIEW_COPY.record.copiedNoName, "Copied from the review form. Check it, add the reviewer's name, then save."],
    ["recordByHand", REVIEW_COPY.record.byHand, "This review exists only on paper. Copy this record's slip by hand, then record it here."],
    ["recordCoverNone", REVIEW_COPY.record.coverNone, "This will be the review on the cover."],
    [
      "recordCoverReplaces",
      REVIEW_COPY.record.coverReplaces,
      "This replaces the review now on the cover. If a slip is already taped to the record, print the slip again to replace it.",
    ],
    [
      "recordEmailed",
      REVIEW_COPY.record.emailed("Sam"),
      "Sam will be emailed that a review was recorded in their name. They can edit it and answer the publishing question themselves.",
    ],
    ["recordCouldNotRecord", REVIEW_COPY.record.couldNotRecord, "Couldn't record the review. Please try again."],
    ["recordRecorded", REVIEW_COPY.record.recorded, "Recorded."],
    ["recordUseAsCover", REVIEW_COPY.record.useAsCover, "Use this as the record's review"],
    [
      "recordOtherReview",
      REVIEW_COPY.record.otherReview,
      "Saved as one of the record's other reviews. You can choose it for the cover later.",
    ],
    [
      "recordDraftNotSubmitted",
      REVIEW_COPY.record.draftNotSubmitted,
      "The review was saved as a draft but couldn't be submitted. You'll find it under My reviews.",
    ],
    [
      "recordAccountGone",
      REVIEW_COPY.record.accountGone,
      "That account no longer exists. Pick another, or leave the review unlinked.",
    ],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it.each([
    ["off", "", Authorization.MD],
    ["staff-only for a DJ", "staff", Authorization.DJ],
  ])("renders nothing when the flag is %s", async (_label, flag, who) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = who;
    fakeReviewsEndpoints({ records: [dogaItem()] });

    const { container } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the record's format in the line, read from the library's formats", async () => {
    // The record's cover review (40, by default) is served: without it the cover read fails and the page swaps the whole record for its load-failed line, which the format line only outlives for a moment.
    fakeReviewsEndpoints({ records: [dogaItem({ format_id: 7 })], forItem: { [ITEM_ID]: [submitted(40)] } });
    server.use(http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([{ id: 7, format_name: "Vinyl" }])));

    renderScreen(<IntakeItemScreen id={ITEM_ID} />);

    expect(await screen.findByText("Juana Molina · DOGA · Sonamos · Vinyl")).toBeInTheDocument();
    await screen.findByText("Take 40.");
    expect(screen.getByText("Juana Molina · DOGA · Sonamos · Vinyl")).toBeInTheDocument();
  });

  it("shows the record's FCC notes on the page", async () => {
    fakeReviewsEndpoints({
      records: [dogaItem()],
      forItem: { [ITEM_ID]: [submitted(40)] },
      fccNotesForItem: { [ITEM_ID]: [fccNote({ intake_item_id: ITEM_ID, track: "B1", note: "A word." })] },
    });

    renderScreen(<IntakeItemScreen id={ITEM_ID} />);

    expect(await screen.findByText("B1: A word.")).toBeInTheDocument();
  });

  describe("the reviews", () => {
    it("serves only this item's reviews from serveItemReviews and leaves a release's review read to its own handler", async () => {
      fakeReviewsEndpoints({ records: [dogaItem()] });
      let releaseReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("album_id") !== "5") return undefined;
          releaseReads += 1;
          return HttpResponse.json([submitted(90, { intake_item_id: null, album_id: 5 })]);
        }),
      );
      const itemReviews = serveItemReviews([submitted(40), submitted(41)]);
      function Mounted() {
        const { data } = useGetReviewsForReleaseQuery(5);
        return (
          <>
            <output aria-label="release review count">{data?.length ?? "none"}</output>
            <IntakeItemScreen id={ITEM_ID} />
          </>
        );
      }

      renderScreen(<Mounted />);

      await waitFor(() => expect(screen.getByRole("status", { name: "release review count" })).toHaveTextContent("1"));
      await screen.findByText("Take 41.");
      expect(releaseReads).toBe(1);
      expect(itemReviews.reads).toBeGreaterThan(0);
    });

    it("shows the chosen review under the cover heading and the rest, newest first, under Other reviews", async () => {
      fakeReviewsEndpoints({
        records: [dogaItem()],
        forItem: {
          [ITEM_ID]: [
            submitted(41, { add_date: "2026-09-20" }),
            submitted(40),
            submitted(42, { add_date: "2026-10-03" }),
          ],
        },
      });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const cover = (await screen.findByRole("heading", { name: "The review on the cover" })).closest("section")!;
      expect(within(cover).getByText("Take 40.")).toBeInTheDocument();
      const others = screen.getByRole("heading", { name: "Other reviews" }).closest("section")!;
      const takes = within(others).getAllByText(/^Take \d+\.$/).map((el) => el.textContent);
      expect(takes).toEqual(["Take 42.", "Take 41."]);
      expect(within(cover).queryByText("Take 41.")).not.toBeInTheDocument();
    });

    it("fetches the review on the cover by id when it is not among the item's own", async () => {
      fakeReviewsEndpoints({
        records: [dogaItem({ accepted_review_id: 90 })],
        reviews: [submitted(90, { intake_item_id: null, album_id: 7, review: "From the cited release." })],
        forItem: { [ITEM_ID]: [submitted(41)] },
      });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const cover = (await screen.findByRole("heading", { name: "The review on the cover" })).closest("section")!;
      expect(await within(cover).findByText("From the cited release.")).toBeInTheDocument();
      expect(screen.getByText("Take 41.")).toBeInTheDocument();
    });

    it("offers no filing arm and says to choose a review when submitted reviews exist but none is chosen", async () => {
      fakeReviewsEndpoints({
        records: [dogaItem({ accepted_review_id: null })],
        forItem: { [ITEM_ID]: [submitted(41)] },
      });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByText("Choose a review for the cover before filing this record.")).toBeInTheDocument();
      expect(screen.getByText("No review chosen for the cover yet.")).toBeInTheDocument();
      expect(screen.getByText("Take 41.")).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Genre" })).not.toBeInTheDocument();
      expect(screen.queryByText("Already in the library?")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Print the slip" })).not.toBeInTheDocument();
    });

    it("links to the slip as soon as a review is on the cover, before the record is filed", async () => {
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40)] } });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("link", { name: "Print the slip" })).toHaveAttribute(
        "href",
        `/dashboard/admin/intake/${ITEM_ID}/slip`,
      );
    });

    const PRINTED = { printed_revision_id: 401, printed_at: "2026-10-02T16:00:00Z" };
    it.each<{
      case: string;
      printed: Record<string, unknown>;
      revisions: number;
      fails?: boolean;
      linkName: string;
      linkCount: number;
      settled: string | null;
    }>([
      { case: "never printed", printed: {}, revisions: 2, linkName: "Print the slip", linkCount: 1, settled: null },
      { case: "printed and unchanged", printed: PRINTED, revisions: 1, linkName: "Print the slip", linkCount: 1, settled: REVIEW_COPY.printedNote.isCurrent },
      { case: "printed and edited since", printed: PRINTED, revisions: 2, linkName: "Print a new slip", linkCount: 2, settled: null },
      { case: "printed with the revisions failing", printed: PRINTED, revisions: 0, fails: true, linkName: "Print the slip", linkCount: 1, settled: REVIEW_COPY.printedNote.loadFailed },
    ])("the record's print link, $case, reads $linkName", async ({ printed, revisions, fails, linkName, linkCount, settled }) => {
      const requested = vi.fn();
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40, printed)] } });
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, ({ params }) => {
          requested(params.id);
          return fails
            ? HttpResponse.json({ message: "boom" }, { status: 500 })
            : HttpResponse.json(Array.from({ length: revisions }, (_, i) => reviewRevision({ id: 401 + i, review_id: 40, revision: i + 1 })));
        }),
      );

      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByText("Take 40.");
      if (settled) await screen.findByText(settled);
      await waitFor(() => expect(screen.getAllByRole("link", { name: linkName })).toHaveLength(linkCount));
      for (const link of screen.getAllByRole("link", { name: linkName })) {
        expect(link).toHaveAttribute("href", `/dashboard/admin/intake/${ITEM_ID}/slip`);
      }
      if (printed.printed_revision_id === undefined) {
        // A never-printed cover review has revisions to serve but is never asked for them.
        expect(reviewApi.endpoints.getReviewRevisions.select(40)(store.getState()).isUninitialized).toBe(true);
        await reviewsSettled(store);
        expect(requested).not.toHaveBeenCalled();
        expect(screen.getAllByRole("link", { name: linkName })).toHaveLength(linkCount);
      }
    });

    it("links to the record's own slip once, and to no review's print page", async () => {
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40, { medium: "typed", album_id: null })] } });

      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByRole("link", { name: "Print the slip" });
      // Let the music director gate resolve before asserting the per-review link is absent.
      await reviewsSettled(store);
      const slipLinks = screen.getAllByRole("link", { name: "Print the slip" });
      expect(slipLinks).toHaveLength(1);
      expect(slipLinks[0]).toHaveAttribute("href", `/dashboard/admin/intake/${ITEM_ID}/slip`);
      const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
      expect(hrefs.filter((href) => /^\/dashboard\/admin\/library\/[^/]+\/slip\/[^/]+$/.test(href))).toEqual([]);
    });

    it.each([
      ["lists the names of DJs with an unfinished draft", { draft_authors: ["DJ Sam", "DJ Pat"] }, "Still writing: DJ Sam, DJ Pat."],
      ["is absent for an empty list", { draft_authors: [] }, null],
      ["is absent when the field is missing", {}, null],
    ])("the Still writing line %s", async (_name, overrides, line) => {
      fakeReviewsEndpoints({ records: [dogaItem(overrides)], forItem: { [ITEM_ID]: [submitted(40)] } });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByRole("heading", { name: "The review on the cover" });
      if (line) expect(screen.getByText(line)).toBeInTheDocument();
      else expect(screen.queryByText(/Still writing/)).not.toBeInTheDocument();
    });
  });

  describe("filing", () => {
    const setUp = (item = dogaItem()) => {
      fakeReviewsEndpoints({ records: [item], forItem: { [ITEM_ID]: [submitted(40)] } });
      return serveItem(item);
    };

    it("prefills the bench from the item and files as a new release with its kind", async () => {
      const box = setUp(dogaItem({ format_id: 1, discogs_release_id: 1234 }));
      const filings = fakeLibraryFilingsEndpoint({ existingArtists: [] });
      const fileBodies: unknown[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, async ({ request }) => {
          fileBodies.push(await request.json());
          box.item = dogaItem({ format_id: 1, discogs_release_id: 1234, state: "filed", effective_state: "filed" });
          return HttpResponse.json(box.item);
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await chooseArm(user, NEW_ARM);
      expect(await screen.findByLabelText("Album title")).toHaveValue("DOGA");
      expect(screen.getByLabelText("Label")).toHaveValue("Sonamos");
      expect(screen.getByLabelText("Release link URL 1")).toHaveValue("https://www.discogs.com/release/1234");
      await waitFor(() => expect(screen.getByRole("combobox", { name: "Format" })).toHaveTextContent("cd"));
      await user.click(await screen.findByRole("combobox", { name: "Genre" }));
      await user.click(await screen.findByRole("option", { name: "Rock" }));
      expect(await screen.findByDisplayValue("Juana Molina")).toBeInTheDocument();
      await readyBench(user);
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(fileBodies).toHaveLength(1));
      expect(fileBodies[0]).toMatchObject({
        kind: "new_release",
        artist: { kind: "existing", artist_id: ARTIST_ID },
        release: { album_title: "DOGA", label: "Sonamos", genre_id: GENRE_ID, format_id: 1 },
        rotation: { rotation_bin: "H", card_id: 32 },
      });
      expect(filings.bodies()).toEqual([]);
      // The confirmation repeats the slip link, which does not depend on filing.
      expect(await screen.findByText("Filed.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Print the slip" })).toHaveAttribute("href", `/dashboard/admin/intake/${ITEM_ID}/slip`);
    });

    it("still renders the bench and files through /intake/{id}/file once the review gate cutover has passed", async () => {
      vi.stubEnv("NEXT_PUBLIC_REVIEW_GATE_CUTOVER_DATE", "2000-01-01");
      const box = setUp();
      const fileBodies: unknown[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, async ({ request }) => {
          fileBodies.push(await request.json());
          box.item = dogaItem({ state: "filed", effective_state: "filed" });
          return HttpResponse.json(box.item);
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await chooseArm(user, NEW_ARM);
      expect(await screen.findByLabelText("Album title")).toHaveValue("DOGA");
      await readyBench(user);
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(fileBodies).toHaveLength(1));
      expect(await screen.findByText("Filed.")).toBeInTheDocument();
    });

    it("offers no filing arm for a cited record with no review chosen, and files once one is chosen", async () => {
      const cited = dogaItem({ format_id: 1, accepted_review_id: null, cited_album_id: 7 });
      fakeReviewsEndpoints({
        records: [cited],
        reviews: [submitted(90, { intake_item_id: null, album_id: 7, review: "From the cited release." })],
        forItem: { [ITEM_ID]: [] },
      });
      const box = serveItem(cited);
      const fileBodies: unknown[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, async ({ request }) => {
          fileBodies.push(await request.json());
          return HttpResponse.json(dogaItem({ state: "filed", effective_state: "filed" }));
        }),
      );
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByText("Choose a review for the cover before filing this record.")).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Genre" })).not.toBeInTheDocument();
      expect(screen.queryByRole("radio", { name: NEW_ARM })).not.toBeInTheDocument();
      expect(screen.queryByRole("radio", { name: EXISTING_ARM })).not.toBeInTheDocument();

      // The citation screen (WXYC/dj-site#1766) is not built; the choice arrives as the item's next answer.
      box.item = dogaItem({ format_id: 1, accepted_review_id: 90, cited_album_id: 7 });
      act(() => {
        store.dispatch(reviewsApi.util.invalidateTags(["Intake"]));
      });

      expect(await screen.findByText("From the cited release.")).toBeInTheDocument();
      expect(screen.queryByText("Choose a review for the cover before filing this record.")).not.toBeInTheDocument();
      await chooseArm(user, NEW_ARM);
      await waitFor(() => expect(screen.getByRole("combobox", { name: "Format" })).toHaveTextContent("cd"));
      await readyBench(user);
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(fileBodies).toHaveLength(1));
      expect(fileBodies[0]).toMatchObject({ kind: "new_release" });
    });

    it.each(REFUSALS)("keeps the bench's form as typed when a %s refusal files nothing", async (reason, line) => {
      setUp();
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () =>
          HttpResponse.json({ message: "server words", reason }, { status: 409 }),
        ),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      expect((await screen.findByRole("status")).textContent).toBe(line);
      expect(screen.getByLabelText("Album title")).toHaveValue("DOGA");
      expect(screen.getByDisplayValue("Juana Molina")).toBeInTheDocument();
      expect(screen.getByText("Nothing filed yet.")).toBeInTheDocument();
    });

    it("shows the bench's conflict panel, not its generic failure, for a call-number collision from /file", async () => {
      setUp();
      const fileBodies: unknown[] = [];
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => HttpResponse.json({ artists: [] })),
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, async ({ request }) => {
          fileBodies.push(await request.json());
          return filingConflictResponse("artist_code_conflict", {
            id: 5,
            artist_name: "Stereolab",
            code_letters: "CH",
            code_artist_number: 12,
            genre_id: GENRE_ID,
          });
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await chooseArm(user, NEW_ARM);
      await user.click(await screen.findByRole("combobox", { name: "Genre" }));
      await user.click(await screen.findByRole("option", { name: "Rock" }));
      const artist = await screen.findByPlaceholderText("Search artists...");
      await user.clear(artist);
      await user.type(artist, "Juana Molina");
      await user.click(await screen.findByRole("option", { name: 'Create new artist "Juana Molina"' }));
      await waitFor(() => expect(screen.getByLabelText("Code number")).toHaveValue("7"));
      await waitFor(() => expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-pressed", "true"));
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/is already taken by Stereolab\./);
      expect(fileBodies).toHaveLength(1);
      expect(screen.queryByText(/Filing failed/)).not.toBeInTheDocument();
    });
  });

  describe("the filing choice", () => {
    const setUp = () => {
      const item = dogaItem();
      fakeReviewsEndpoints({ records: [item], forItem: { [ITEM_ID]: [submitted(40)] } });
      server.use(http.get(`${TEST_BACKEND_URL}/library`, () => HttpResponse.json([RELEASE_ROW])));
      return serveItem(item);
    };

    it("asks which arm first, and shows neither form until one is chosen", async () => {
      setUp();
      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("heading", { name: "File it" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: NEW_ARM })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: EXISTING_ARM })).not.toBeChecked();
      expect(screen.queryByRole("combobox", { name: "Genre" })).not.toBeInTheDocument();
      expect(screen.queryByRole("searchbox", { name: "Search the library" })).not.toBeInTheDocument();
    });

    it("names the choice by its heading", async () => {
      setUp();
      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const group = await screen.findByRole("radiogroup", { name: "File it" });
      expect(within(group).getAllByRole("radio")).toHaveLength(2);
    });

    it("takes the closed arm out of the accessibility tree and the Tab order, not only out of sight", async () => {
      setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await chooseArm(user, NEW_ARM);
      await user.type(await screen.findByRole("textbox", { name: "Album title" }), "x");
      await chooseArm(user, EXISTING_ARM);
      await screen.findByRole("searchbox", { name: "Search the library" });
      expect(screen.queryByRole("textbox", { name: "Album title" })).toBeNull();
      expect(screen.queryByRole("combobox", { name: "Genre" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Add to rotation" })).toBeNull();

      await user.click(screen.getByRole("radio", { name: EXISTING_ARM }));
      for (let i = 0; i < 12; i += 1) {
        await user.tab();
        const at = document.activeElement as HTMLElement;
        expect(at.closest("[hidden]")).toBeNull();
        expect(at).not.toHaveAccessibleName("Album title");
      }

      await chooseArm(user, NEW_ARM);
      expect(screen.queryByRole("searchbox", { name: "Search the library" })).toBeNull();
      await user.click(screen.getByRole("radio", { name: NEW_ARM }));
      for (let i = 0; i < 12; i += 1) {
        await user.tab();
        expect(document.activeElement).not.toHaveAccessibleName("Search the library");
      }
    });

    it("shows only the chosen arm, and keeps what was typed in each when switching back", async () => {
      setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await chooseArm(user, NEW_ARM);
      const album = await screen.findByLabelText("Album title");
      await user.clear(album);
      await user.type(album, "Edits");
      expect(screen.queryByRole("searchbox", { name: "Search the library" })).not.toBeInTheDocument();

      await chooseArm(user, EXISTING_ARM);
      expect(screen.getByLabelText("Album title")).not.toBeVisible();
      await user.type(await screen.findByRole("searchbox", { name: "Search the library" }), "Juana");

      await chooseArm(user, NEW_ARM);
      expect(screen.getByRole("searchbox", { name: "Search the library", hidden: true })).not.toBeVisible();
      expect(screen.getByLabelText("Album title")).toHaveValue("Edits");

      await chooseArm(user, EXISTING_ARM);
      expect(screen.getByRole("searchbox", { name: "Search the library" })).toHaveValue("Juana");
    });
  });

  describe("filing onto a release already in the library", () => {
    const setUp = (item = dogaItem()) => {
      fakeReviewsEndpoints({ records: [item], forItem: { [ITEM_ID]: item.accepted_review_id ? [submitted(40)] : [] } });
      const searches: Record<string, string>[] = [];
      server.use(
        http.get(`${TEST_BACKEND_URL}/library`, ({ request }) => {
          searches.push(Object.fromEntries(new URL(request.url).searchParams));
          return HttpResponse.json([RELEASE_ROW]);
        }),
      );
      return { box: serveItem(item), searches };
    };

    it("files onto the picked release with the existing_release kind and shows the record filed", async () => {
      const { box } = setUp();
      const fileBodies: unknown[] = [];
      server.use(
        http.post(FILE_URL, async ({ request }) => {
          fileBodies.push(await request.json());
          box.item = dogaItem({ state: "filed", effective_state: "filed" });
          return HttpResponse.json(box.item);
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByText("Already in the library?")).toBeInTheDocument();
      await pickDoga(user);

      await waitFor(() => expect(fileBodies).toEqual([{ kind: "existing_release", album_id: 5 }]));
      expect(await screen.findByText("Filed.")).toBeInTheDocument();
      expect(screen.queryByText("Already in the library?")).not.toBeInTheDocument();
    });

    it("searches the term as both artist and title, as the classic catalog does, and asks for as many rows", async () => {
      const { searches } = setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await search(user, "Various Artists");

      await waitFor(() => expect(searches).toEqual([{ artist_name: "Various Artists", album_title: "Various Artists", n: "50" }]));
    });

    it("shows which release is picked, on its row and beside the file button, and tells a CD from a vinyl", async () => {
      const { searches } = setUp();
      server.use(http.get(`${TEST_BACKEND_URL}/library`, () => HttpResponse.json([RELEASE_ROW, VINYL_ROW])));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      expect(searches).toEqual([]);

      await search(user, "Juana");
      const cd = await screen.findByRole("button", { name: "Juana Molina · DOGA · CD" });
      const vinyl = screen.getByRole("button", { name: "Juana Molina · DOGA · Vinyl" });
      expect(screen.queryByRole("button", { name: "File it as this one" })).not.toBeInTheDocument();
      await user.click(vinyl);

      expect(vinyl).toHaveAttribute("aria-pressed", "true");
      expect(cd).toHaveAttribute("aria-pressed", "false");
      expect(screen.getAllByText("Juana Molina · DOGA · Vinyl")).toHaveLength(2);
    });

    it("drops the pick when a new search runs, so the file button never names a release that left the screen", async () => {
      setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await pick(user);
      expect(screen.getByRole("button", { name: "File it as this one" })).toBeInTheDocument();
      expect(screen.getAllByText(ROW_NAME)).toHaveLength(2);

      await search(user, "Stereolab");

      expect(screen.queryByRole("button", { name: "File it as this one" })).not.toBeInTheDocument();
    });

    it("sends one request when the file button is pressed twice", async () => {
      const { box } = setUp();
      let posts = 0;
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.post(FILE_URL, async () => {
          posts += 1;
          await held;
          box.item = dogaItem({ state: "filed", effective_state: "filed" });
          return HttpResponse.json(box.item);
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await pick(user);

      const button = screen.getByRole("button", { name: "File it as this one" });
      await user.click(button);
      fireEvent.click(button);
      release();

      expect(await screen.findByText("Filed.")).toBeInTheDocument();
      expect(posts).toBe(1);
    });

    it("offers neither arm, only the choose-a-review line, when no review is on the cover", async () => {
      setUp(dogaItem({ accepted_review_id: null }));
      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByText("Choose a review for the cover before filing this record.")).toBeInTheDocument();
      expect(screen.queryByText("Already in the library?")).not.toBeInTheDocument();
      expect(screen.queryByRole("searchbox", { name: "Search the library" })).not.toBeInTheDocument();
    });

    it("words its own line, not the server's, when the release cannot take the record", async () => {
      setUp();
      server.use(http.post(FILE_URL, () => HttpResponse.json({ message: "server words" }, { status: 400 })));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await screen.findByText("Already in the library?");

      await pickDoga(user);

      expect((await screen.findByRole("status")).textContent).toBe("That record is no longer in the library. Pick another, or file this one as new.");
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
    });

    it.each([
      [500, { message: "server words" }],
      [403, { message: "server words" }],
    ] as const)("says the filing failed, not that the release is wrong, when the server answers %s", async (status, body) => {
      const { box } = setUp();
      server.use(http.post(FILE_URL, () => HttpResponse.json(body, { status })));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await screen.findByText("Already in the library?");

      await pickDoga(user);

      expect((await screen.findByRole("status")).textContent).toBe("Couldn't file this record. Please try again.");
      expect(screen.queryByText(/no longer in the library/)).not.toBeInTheDocument();
      expect(box.reads).toBeGreaterThan(0);
    });

    it("shows its own load-failure line when the search fails", async () => {
      setUp();
      server.use(http.get(`${TEST_BACKEND_URL}/library`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await search(user, "Juana");

      expect(await screen.findByText("Couldn't search the library. Please try again.")).toBeInTheDocument();
      expect(screen.getByText("Already in the library?")).toBeInTheDocument();
    });

    it("shows the failure line, and not the previous term's rows, when a second search fails", async () => {
      setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await search(user, "Juana");
      await screen.findByRole("button", { name: ROW_NAME });
      server.use(http.get(`${TEST_BACKEND_URL}/library`, () => HttpResponse.json({ message: "down" }, { status: 500 })));

      await search(user, "Stereolab");

      expect(await screen.findByText("Couldn't search the library. Please try again.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: ROW_NAME })).not.toBeInTheDocument();
    });

    it("refetches the release's mounted reviews and FCC notes once each after a successful file, and not at all after a refusal", async () => {
      setUp();
      let releaseReviewReads = 0;
      let fccReads = 0;
      let refuse = true;
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("album_id") === "5") releaseReviewReads += 1;
          return HttpResponse.json([submitted(40)]);
        }),
        http.get(`${TEST_BACKEND_URL}/fcc-notes`, ({ request }) => {
          if (new URL(request.url).searchParams.get("album_id") === "5") fccReads += 1;
          return HttpResponse.json([]);
        }),
        http.post(FILE_URL, () =>
          refuse
            ? HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 })
            : HttpResponse.json(dogaItem({ state: "filed", effective_state: "filed" })),
        ),
      );
      function Mounted() {
        useGetReviewsForReleaseQuery(5);
        useGetFccNotesQuery({ album_id: 5 });
        return <IntakeItemScreen id={ITEM_ID} />;
      }
      const { user, store } = renderScreen(<Mounted />);
      await waitFor(() => expect([releaseReviewReads, fccReads]).toEqual([1, 1]));

      await pick(user);
      await user.click(screen.getByRole("button", { name: "File it as this one" }));
      await screen.findByRole("status");
      await reviewsSettled(store);
      expect([releaseReviewReads, fccReads]).toEqual([1, 1]);

      refuse = false;
      await user.click(screen.getByRole("button", { name: "File it as this one" }));

      await waitFor(() => expect([releaseReviewReads, fccReads]).toEqual([2, 2]));
    });

    describe("the page's hold while the filing's reread is outstanding", () => {
      const setUpTwoReviews = () => {
        const out = setUp();
        fakeReviewsEndpoints({ records: [out.box.item], forItem: { [ITEM_ID]: [submitted(40), submitted(41)] } });
        server.use(acceptingReview(out.box));
        return out;
      };
      const filedItem = () => dogaItem({ state: "filed", effective_state: "filed" });

      it("holds every review button until the reread that follows a successful filing settles, then lets a chosen cover stand", async () => {
        const { box } = setUpTwoReviews();
        server.use(
          http.post(FILE_URL, () => {
            box.item = filedItem();
            return HttpResponse.json(box.item);
          }),
        );
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await screen.findByText("Already in the library?");
        await pick(user);
        await reviewsSettled(store);
        const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

        await user.click(screen.getByRole("button", { name: "File it as this one" }));

        await waitFor(() => expect(reread.calls.count).toBe(1));
        await renderedFrame();
        expect(guarded().length).toBeGreaterThan(0);
        guarded().forEach((b) => expect(b).toBeDisabled());

        reread.release();
        await reread.answered;
        await reviewsSettled(store);
        // The cover's own Delete review stays disabled once the record is filed, so only the Use button is checked.
        await waitFor(() => expect(screen.getByRole("button", { name: "Use this review instead" })).toBeEnabled());

        await user.click(screen.getByRole("button", { name: "Use this review instead" }));
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Use this review instead" }));
        const cover = () => screen.getByRole("heading", { name: "The review on the cover" }).closest("section")!;
        await waitFor(() => expect(within(cover()).getByText("Take 41.")).toBeInTheDocument());
        await reviewsSettled(store);
        expect(within(cover()).getByText("Take 41.")).toBeInTheDocument();
      });

      it("holds every review button until the reread that follows a refused filing settles", async () => {
        const { box } = setUpTwoReviews();
        server.use(http.post(FILE_URL, () => HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 })));
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await screen.findByText("Already in the library?");
        await pick(user);
        await reviewsSettled(store);
        const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

        await user.click(screen.getByRole("button", { name: "File it as this one" }));

        await waitFor(() => expect(reread.calls.count).toBe(1));
        await renderedFrame();
        guarded().forEach((b) => expect(b).toBeDisabled());

        reread.release();
        await reread.answered;
        await reviewsSettled(store);
        await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
      });
    });
  });

  describe("using a review", () => {
    const SLIP_HREF = `/dashboard/admin/intake/${ITEM_ID}/slip`;
    const SERVER_WORDS = "review_id must name a submitted review of this record";
    const NOTHING_ON_COVER = { accepted_review_id: null };

    beforeEach(() => {
      vi.mocked(toast).mockClear();
      vi.mocked(toast.error).mockClear();
    });

    // Review 40 is on the cover when the item has one; review 41 is the other review.
    const setUp = (item = dogaItem(NOTHING_ON_COVER), reviews: Review[] = item.accepted_review_id ? [submitted(40), submitted(41)] : [submitted(41)]) => {
      fakeReviewsEndpoints({ records: [item], forItem: { [ITEM_ID]: reviews } });
      return serveItem(item);
    };

    /** Records each POST to /intake/{id}/{action}, and moves the served item's cover to the review sent. */
    const recordPosts = (box: ReturnType<typeof serveItem>) => {
      const posts: { path: string; body: unknown }[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, async ({ request }) => {
          const body = (await request.clone().json()) as { review_id: number };
          posts.push({ path: new URL(request.url).pathname, body });
          box.item = { ...box.item, accepted_review_id: body.review_id };
          return HttpResponse.json(box.item);
        }),
      );
      return posts;
    };

    const refuseWith400 = () =>
      server.use(http.post(ACCEPT_URL, () => HttpResponse.json({ message: SERVER_WORDS }, { status: 400 })));

    it("sends { review_id } to accept-review at once when nothing is on the cover, never to accept, and says nothing of its own", async () => {
      const box = setUp();
      const posts = recordPosts(box);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Use this review" }));

      const cover = (await screen.findByRole("heading", { name: "The review on the cover" })).closest("section")!;
      expect(await within(cover).findByText("Take 41.")).toBeInTheDocument();
      await reviewsSettled(store);
      expect(posts).toEqual([{ path: `/intake/${ITEM_ID}/accept-review`, body: { review_id: 41 } }]);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(toast).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("asks before replacing the review on the cover, and sends nothing when the question is cancelled", async () => {
      const box = setUp(dogaItem());
      const posts = recordPosts(box);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Use this review instead" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText(REVIEW_COPY.intakeItem.replaceCover)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      await reviewsSettled(store);
      expect(posts).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Use this review instead" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Use this review instead" }));

      await waitFor(() => expect(posts).toEqual([{ path: `/intake/${ITEM_ID}/accept-review`, body: { review_id: 41 } }]));
    });

    it("closes the question once the write succeeds and sends the write once while the item reread is outstanding", async () => {
      const box = setUp(dogaItem());
      const posts = recordPosts(box);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const button = await screen.findByRole("button", { name: "Use this review instead" });
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(button);
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Use this review instead" }));

      await waitFor(() => expect(reread.calls.count).toBe(1));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Use this review instead" })).toBeDisabled();
      expect(posts).toEqual([{ path: `/intake/${ITEM_ID}/accept-review`, body: { review_id: 41 } }]);

      reread.release();
      await reread.answered;
      await reviewsSettled(store);
      expect(posts).toHaveLength(1);
    });

    it("leaves the button pressable after a failed write, so it can be pressed again", async () => {
      setUp();
      server.use(http.post(ACCEPT_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Use this review" }));

      expect((await screen.findByRole("status")).textContent).toBe("Couldn't do that. Please try again.");
      await reviewsSettled(store);
      expect(screen.getByRole("button", { name: "Use this review" })).toBeEnabled();
    });

    it("leaves the button pressable once the reread settles when the reread fails", async () => {
      const box = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
      const posts = recordPosts(box);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const [button] = await screen.findAllByRole("button", { name: "Use this review" });
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json({ message: "boom" }, { status: 500 }));

      await user.click(button);

      await waitFor(() => expect(reread.calls.count).toBe(1));
      expect(posts).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: /^Use this review/ }).length).toBeGreaterThan(0);
      screen.getAllByRole("button", { name: /^Use this review/ }).forEach((b) => expect(b).toBeDisabled());

      reread.release();
      await reread.answered;
      await waitFor(() => screen.getAllByRole("button", { name: /^Use this review/ }).forEach((b) => expect(b).toBeEnabled()));
    });

    it("disables the other review's Use this review and every Delete review while the write is in flight, and enables them when it fails", async () => {
      setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
      const write = holdResponse("post", ACCEPT_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 }));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const [first] = await screen.findAllByRole("button", { name: "Use this review" });
      await reviewsSettled(store);

      await user.click(first);

      await waitFor(() => expect(write.calls.count).toBe(1));
      expect(guarded()).toHaveLength(4);
      guarded().forEach((b) => expect(b).toBeDisabled());

      write.release();
      await write.answered;
      expect((await screen.findByRole("status")).textContent).toBe("Couldn't do that. Please try again.");
      await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
    });

    it("keeps every other review button disabled until the refused write's own reload has answered", async () => {
      const box = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
      refuseWith400();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const [first] = await screen.findAllByRole("button", { name: "Use this review" });
      await reviewsSettled(store);
      const reload = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(first);

      await waitFor(() => expect(reload.calls.count).toBe(1));
      expect(guarded()).toHaveLength(4);
      guarded().forEach((b) => expect(b).toBeDisabled());

      reload.release();
      await reload.answered;
      await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
    });

    it("words every review's button as a replacement, and disables it, while the reread is outstanding", async () => {
      const box = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
      recordPosts(box);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const [first] = await screen.findAllByRole("button", { name: "Use this review" });
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(first);

      await waitFor(() => expect(reread.calls.count).toBe(1));
      // The chosen review has already moved up to the cover, from the write's own answer, so one button is left.
      const buttons = await screen.findAllByRole("button", { name: "Use this review instead" });
      expect(buttons).toHaveLength(1);
      buttons.forEach((b) => expect(b).toBeDisabled());
      expect(screen.queryByRole("button", { name: "Use this review" })).not.toBeInTheDocument();

      reread.release();
      await reread.answered;
      await reviewsSettled(store);
    });

    it("disables the chosen review's Delete review while the reread is outstanding, so it cannot skip the cover confirmation", async () => {
      const box = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41, { author: "Cat Power" })]);
      recordPosts(box);
      const deletes: string[] = [];
      server.use(http.delete(`${TEST_BACKEND_URL}/reviews/:id`, ({ params }) => {
        deletes.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const button = await screen.findByRole("button", { name: "Use this review" });
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(button);

      await waitFor(() => expect(reread.calls.count).toBe(1));
      const remove = screen.getByRole("button", { name: "Delete review by Cat Power" });
      expect(remove).toBeDisabled();
      fireEvent.click(remove);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(deletes).toEqual([]);

      reread.release();
      await reread.answered;
      await reviewsSettled(store);
    });

    describe("when the reread after choosing a review fails", () => {
      /** Chooses the newer of two reviews while every read of the item fails, and waits until the page's hold has cleared. */
      const chooseWithFailingReread = async () => {
        const box = setUp(dogaItem(NOTHING_ON_COVER), [
          submitted(41, { author: "Cat Power", add_date: "2026-10-02" }),
          submitted(42, { author: "Stereolab", add_date: "2026-10-01" }),
        ]);
        const posts = recordPosts(box);
        const view = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        const [newer] = await screen.findAllByRole("button", { name: "Use this review" });
        await reviewsSettled(view.store);
        box.fail = true;

        await view.user.click(newer);

        await waitFor(() => expect(posts).toEqual([{ path: `/intake/${ITEM_ID}/accept-review`, body: { review_id: 41 } }]));
        await reviewsSettled(view.store);
        await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
        return { ...view, box };
      };

      it("asks the replace question before another review takes the cover", async () => {
        const { user } = await chooseWithFailingReread();

        const other = screen.getByRole("button", { name: "Use this review instead" });
        expect(screen.queryByRole("button", { name: "Use this review" })).not.toBeInTheDocument();
        await user.click(other);

        expect(within(await screen.findByRole("alertdialog")).getByText(REVIEW_COPY.intakeItem.replaceCover)).toBeInTheDocument();
      });

      it("opens the cover confirmation on the chosen review's Delete review, and deletes it once confirmed", async () => {
        const deletes: string[] = [];
        const { user } = await chooseWithFailingReread();
        server.use(http.delete(`${TEST_BACKEND_URL}/reviews/:id`, ({ params }) => {
          deletes.push(String(params.id));
          return new HttpResponse(null, { status: 204 });
        }));

        await user.click(screen.getByRole("button", { name: "Delete review by Cat Power" }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(REVIEW_COPY.intakeItem.deleteCoverShelf)).toBeInTheDocument();
        await user.click(within(dialog).getByRole("button", { name: "Delete" }));

        await waitFor(() => expect(deletes).toEqual(["41"]));
        expect(screen.queryByText(REVIEW_COPY.intakeItem.loadFailed)).not.toBeInTheDocument();
      });

      it("offers the filing arms, and keeps the page when File it as new then succeeds", async () => {
        const fileBodies: unknown[] = [];
        const { user } = await chooseWithFailingReread();
        server.use(
          http.post(FILE_URL, async ({ request }) => {
            fileBodies.push(await request.json());
            return HttpResponse.json(dogaItem({ state: "filed", effective_state: "filed", accepted_review_id: 41 }));
          }),
        );
        expect(screen.queryByText(REVIEW_COPY.intakeItem.chooseFirst)).not.toBeInTheDocument();

        await readyBench(user);
        await user.click(screen.getByRole("button", { name: "Add to rotation" }));

        await waitFor(() => expect(fileBodies).toHaveLength(1));
        await renderedFrame();
        expect(screen.queryByText(REVIEW_COPY.intakeItem.loadFailed)).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "The review on the cover" })).toBeInTheDocument();
      });

      it("replaces the kept cover once a later read of the item succeeds", async () => {
        const { box, store } = await chooseWithFailingReread();
        const cover = () => screen.getByRole("heading", { name: "The review on the cover" }).closest("section")!;
        expect(within(cover()).getByText("Take 41.")).toBeInTheDocument();

        box.fail = false;
        box.item = { ...box.item, accepted_review_id: 42 };
        act(() => {
          store.dispatch(reviewsApi.util.invalidateTags(["Intake"]));
        });

        expect(await within(cover()).findByText("Take 42.")).toBeInTheDocument();
      });
    });

    it("shows the load-failure line when the item's own cover review cannot be read by id", async () => {
      fakeReviewsEndpoints({ records: [dogaItem({ accepted_review_id: 90 })], forItem: { [ITEM_ID]: [submitted(41)] } });
      server.use(http.get(`${TEST_BACKEND_URL}/reviews/90`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_COPY.intakeItem.loadFailed);
    });

    it.each([
      ["finalized", "finalized"],
      ["filed", "filed"],
    ] as const)("works on a %s record, which is how a review is replaced", async (state, effective) => {
      const box = setUp(dogaItem({ state, effective_state: effective }));
      const posts = recordPosts(box);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Use this review instead" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Use this review instead" }));

      await waitFor(() => expect(posts).toEqual([{ path: `/intake/${ITEM_ID}/accept-review`, body: { review_id: 41 } }]));
    });

    it.each([
      ["a holder who is not the author says the record is still out", { author_user_id: "dj-pat" }, true],
      ["the author as the holder says nothing", { author_user_id: "dj-sam" }, false],
    ])("%s: the still-out line is shown: %s", async (_label, authorOverrides, shown) => {
      const item = dogaItem({ state: "checked_out", effective_state: "checked_out", ...heldBy("dj-sam", "Sam", "2026-10-01T12:00:00Z") });
      setUp(item, [submitted(40, authorOverrides)]);

      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByRole("heading", { name: "The review on the cover" });
      await reviewsSettled(store);
      if (shown) expect(screen.getByText("The record is still out with Sam.")).toBeInTheDocument();
      else expect(screen.queryByText(/still out with/)).not.toBeInTheDocument();
    });

    it("says a handwritten review is already on the sleeve in place of the print link", async () => {
      setUp(dogaItem(), [submitted(40, { medium: "handwritten", review: null })]);

      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByText("The record's review is handwritten, so it is already on the sleeve. There is nothing to print.")).toBeInTheDocument();
      await reviewsSettled(store);
      const slipLinks = screen.queryAllByRole("link").filter((link) => link.getAttribute("href") === SLIP_HREF);
      expect(slipLinks).toEqual([]);
    });

    it("names the print link Print the slip after a replacement on a printed copy", async () => {
      const printedAt = "2026-10-02T16:00:00Z";
      const box = setUp(dogaItem({ printed_at: printedAt }), [submitted(40, { printed_revision_id: 401, printed_at: printedAt }), submitted(41)]);
      recordPosts(box);
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () =>
          HttpResponse.json([reviewRevision({ id: 401, review_id: 40, revision: 1 }), reviewRevision({ id: 402, review_id: 40, revision: 2 })]),
        ),
      );
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      expect(await screen.findAllByRole("link", { name: "Print a new slip" })).not.toHaveLength(0);

      await user.click(await screen.findByRole("button", { name: "Use this review instead" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Use this review instead" }));

      const link = await screen.findByRole("link", { name: "Print the slip" });
      await reviewsSettled(store);
      expect(link).toHaveAttribute("href", SLIP_HREF);
      expect(screen.getAllByRole("link", { name: "Print the slip" })).toHaveLength(1);
      expect(screen.queryByRole("link", { name: "Print a new slip" })).not.toBeInTheDocument();
    });

    it("shows its approved line after one reread of the item and its reviews on a 400, and never the server's words", async () => {
      const box = setUp();
      const reviewReads = serveItemReviews([submitted(41)]);
      refuseWith400();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const button = await screen.findByRole("button", { name: "Use this review" });
      await waitFor(() => expect(reviewReads.reads).toBe(1));
      const itemReads = box.reads;

      await user.click(button);

      expect((await screen.findByRole("status")).textContent).toBe(REVIEW_COPY.intakeItem.reviewGone);
      await reviewsSettled(store);
      expect(box.reads).toBe(itemReads + 1);
      expect(reviewReads.reads).toBe(2);
      expect(screen.queryByText(SERVER_WORDS)).not.toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalledWith(SERVER_WORDS);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("shows no line while the reload is outstanding", async () => {
      const box = setUp();
      const reviewReads = serveItemReviews([submitted(41)]);
      refuseWith400();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const button = await screen.findByRole("button", { name: "Use this review" });
      await waitFor(() => expect(reviewReads.reads).toBe(1));
      const reload = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(button);

      // Every other read the reload starts has begun, and the held item read is the only request left.
      await waitFor(() => expect(reload.calls.count).toBe(1));
      await waitFor(() => expect(reviewReads.reads).toBe(2));
      await waitFor(() => expect(pendingCount(store)).toBe(1));
      await renderedFrame();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      reload.release();
      await reload.answered;
      expect(screen.getByRole("status").textContent).toBe(REVIEW_COPY.intakeItem.reviewGone);
    });

    it("answers any other failure with the Reviews page's line", async () => {
      setUp();
      server.use(http.post(ACCEPT_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Use this review" }));

      expect((await screen.findByRole("status")).textContent).toBe("Couldn't do that. Please try again.");
      await reviewsSettled(store);
      expect(screen.queryByText(REVIEW_COPY.intakeItem.reviewGone)).not.toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalledWith("boom");
    });

    // The two writes are refused with the same status; only the call site tells them apart.
    describe.each([
      {
        write: "Use this review",
        item: dogaItem(NOTHING_ON_COVER),
        own: REVIEW_COPY.intakeItem.reviewGone,
        other: REVIEW_COPY.intakeItem.pickedGone,
        act: async (user: User) => {
          refuseWith400();
          await user.click(await screen.findByRole("button", { name: "Use this review" }));
        },
      },
      {
        write: "filing onto an existing release",
        item: dogaItem(),
        own: REVIEW_COPY.intakeItem.pickedGone,
        other: REVIEW_COPY.intakeItem.reviewGone,
        act: async (user: User) => {
          server.use(
            http.get(`${TEST_BACKEND_URL}/library`, () => HttpResponse.json([RELEASE_ROW])),
            http.post(FILE_URL, () => HttpResponse.json({ message: "server words" }, { status: 400 })),
          );
          await pick(user);
          await user.click(screen.getByRole("button", { name: "File it as this one" }));
        },
      },
    ])("a 400 on $write", ({ item, own, other, act }) => {
      it("shows its own line and not the other write's", async () => {
        setUp(item);
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await screen.findByRole("heading", { name: "Other reviews" });

        await act(user);

        await waitFor(() => expect(screen.getByRole("status").textContent).toBe(own));
        await reviewsSettled(store);
        expect(screen.queryByText(other)).not.toBeInTheDocument();
      });
    });
  });

  // A new filing arm adds a row here. Another write's refusal cases go in their own describe.
  const ARMS = [
    {
      arm: "the new-release bench",
      ready: readyBench,
      submit: async (user: User) => {
        await user.click(screen.getByRole("button", { name: "Add to rotation" }));
      },
    },
    {
      arm: "the existing-release picker",
      ready: async (user: User) => {
        await pick(user);
      },
      submit: async (user: User) => {
        await user.click(screen.getByRole("button", { name: "File it as this one" }));
      },
    },
  ];

  describe.each(ARMS)("filing through $arm", ({ ready, submit }) => {
    const setUp = (item = dogaItem()) => {
      fakeReviewsEndpoints({ records: [item], forItem: { [ITEM_ID]: item.accepted_review_id ? [submitted(40)] : [] } });
      server.use(http.get(`${TEST_BACKEND_URL}/library`, () => HttpResponse.json([RELEASE_ROW])));
      return serveItem(item);
    };

    it.each(REFUSALS)("shows the %s line after one reread of the item, and never the server's words", async (reason, line, reloaded) => {
      const box = setUp();
      server.use(
        http.post(FILE_URL, () => {
          box.item = reloaded === "filed" ? dogaItem({ state: "filed", effective_state: "filed" }) : dogaItem({ accepted_review_id: null });
          return HttpResponse.json({ message: "server words", reason }, { status: 409 });
        }),
      );
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await ready(user);
      const readsBefore = box.reads;
      await submit(user);

      expect((await screen.findByRole("status")).textContent).toBe(line);
      await reviewsSettled(store);
      expect(box.reads).toBe(readsBefore + 1);
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
      if (reloaded === "filed") {
        expect(screen.queryByRole("combobox", { name: "Genre" })).not.toBeInTheDocument();
        expect(screen.queryByText("Already in the library?")).not.toBeInTheDocument();
      } else {
        expect(screen.getByText("Choose a review for the cover before filing this record.")).toBeInTheDocument();
      }
    });

    it.each(REFUSALS)("shows the %s line only once the record has reloaded", async (reason, line) => {
      const box = setUp();
      let release!: () => void;
      server.use(
        http.post(FILE_URL, () => {
          box.hold = new Promise<void>((resolve) => {
            release = resolve;
          });
          return HttpResponse.json({ message: "server words", reason }, { status: 409 });
        }),
      );
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await ready(user);
      const readsBefore = box.reads;
      await submit(user);

      await waitFor(() => expect(box.reads).toBe(readsBefore + 1));
      // The held item read is the only request left, so the filing's refusal has been handled.
      await waitFor(() => expect(pendingCount(store)).toBe(1));
      await renderedFrame();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      release();
      expect((await screen.findByRole("status")).textContent).toBe(line);
    });

    it.each(REFUSALS)("rereads the item's reviews after a %s refusal", async (reason) => {
      setUp();
      const reviewReads = serveItemReviews([submitted(40)]);
      server.use(
        http.post(FILE_URL, () => HttpResponse.json({ message: "server words", reason }, { status: 409 })),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await waitFor(() => expect(reviewReads.reads).toBe(1));
      await ready(user);
      const readsBefore = reviewReads.reads;
      await submit(user);

      await screen.findByRole("status");
      expect(reviewReads.reads).toBe(readsBefore + 1);
    });

    it("rereads the cover review by id after a refusal when the item's own reviews lack it", async () => {
      const item = dogaItem({ accepted_review_id: 90 });
      fakeReviewsEndpoints({ records: [item], forItem: { [ITEM_ID]: [submitted(40)] }, reviews: [submitted(90, { intake_item_id: 99 })] });
      serveItem(item);
      server.use(http.get(`${TEST_BACKEND_URL}/library`, () => HttpResponse.json([RELEASE_ROW])));
      let coverReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews/90`, () => {
          coverReads += 1;
          return HttpResponse.json(submitted(90, { intake_item_id: 99 }));
        }),
        http.post(FILE_URL, () => HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 })),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await waitFor(() => expect(coverReads).toBe(1));
      await ready(user);
      await submit(user);

      await screen.findByRole("status");
      expect(coverReads).toBe(2);
    });

    it("refetches a mounted catalog query and a mounted rotation list once each after a successful file, and not at all after a refusal", async () => {
      setUp();
      let catalogReads = 0;
      let rotationReads = 0;
      let refuse = true;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library`, ({ request }) => {
          if (new URL(request.url).searchParams.get("artist_name") === "Stereolab") catalogReads += 1;
          return HttpResponse.json([RELEASE_ROW]);
        }),
        http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
          rotationReads += 1;
          return HttpResponse.json([]);
        }),
        http.post(FILE_URL, () =>
          refuse
            ? HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 })
            : HttpResponse.json(dogaItem({ state: "filed", effective_state: "filed" })),
        ),
      );
      function Mounted() {
        useSearchCatalogQuery({ artist_name: "Stereolab", album_title: undefined, n: 5 });
        useGetRotationListQuery();
        return <IntakeItemScreen id={ITEM_ID} />;
      }
      const { user, store } = renderScreen(<Mounted />);
      await ready(user);
      await waitFor(() => expect([catalogReads, rotationReads]).toEqual([1, 1]));

      await submit(user);
      await screen.findByRole("status");
      await reviewsSettled(store);
      expect([catalogReads, rotationReads]).toEqual([1, 1]);

      refuse = false;
      await submit(user);

      await waitFor(() => expect([catalogReads, rotationReads]).toEqual([2, 2]));
    });

    it("rereads the item and its reviews once, and throws nothing, when the page is gone before the filing is refused", async () => {
      setUp();
      const reviewReads = serveItemReviews([submitted(40)]);
      const { calls, release, answered } = holdResponse("post", FILE_URL, () =>
        HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
      );
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const { user, unmount } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await waitFor(() => expect(reviewReads.reads).toBe(1));

      await ready(user);
      await submit(user);
      await waitFor(() => expect(calls.count).toBe(1));
      const reviewReadsBefore = reviewReads.reads;
      // The reload's item read is held, so the spec sees it arrive and settle rather than sleeping.
      const reload = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(dogaItem()));

      unmount();
      release();
      await answered;
      // A hook refetch() throws here before any request goes out, so the read below never happens.
      await waitFor(() => expect(reload.calls.count).toBe(1));
      reload.release();
      await reload.answered;

      expect(reload.calls.count).toBe(1);
      expect(reviewReads.reads).toBe(reviewReadsBefore + 1);
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });
  });

  describe("load failures", () => {
    it("keeps the item and its reviews on the page when the refetch after a file fails", async () => {
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40), submitted(41)] } });
      const box = serveItem(dogaItem());
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () => {
          box.fail = true;
          return HttpResponse.json(dogaItem({ state: "filed", effective_state: "filed" }));
        }),
      );
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(box.reads).toBeGreaterThan(1));
      await reviewsSettled(store);
      expect(screen.queryByText("Couldn't load this record. Please try again.")).not.toBeInTheDocument();
      expect(screen.getByText("Take 40.")).toBeInTheDocument();
      expect(screen.getByText("Take 41.")).toBeInTheDocument();
    });

    // Later writes on this page (choosing a review, citing a release) refetch these reads; each is failed alone, after it succeeded once.
    it.each([
      ["the item", "Intake", `${TEST_BACKEND_URL}/intake/${ITEM_ID}`, dogaItem(), []],
      ["the item's reviews", "Review", `${TEST_BACKEND_URL}/reviews`, dogaItem(), []],
      [
        "a cover review fetched by id",
        "Review",
        `${TEST_BACKEND_URL}/reviews/90`,
        dogaItem({ accepted_review_id: 90 }),
        [submitted(90, { intake_item_id: null, album_id: 7, review: "From the cited release." })],
      ],
    ] as const)("keeps the page when the refetch of %s fails", async (_name, tag, path, item, byId) => {
      fakeReviewsEndpoints({ records: [item], reviews: [...byId], forItem: { [ITEM_ID]: [submitted(40), submitted(41)] } });
      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await screen.findByRole("heading", { name: "Other reviews" });

      let refused = 0;
      server.use(
        http.get(path, () => {
          refused += 1;
          return HttpResponse.json({ message: "boom" }, { status: 500 });
        }),
      );
      act(() => {
        store.dispatch(reviewsApi.util.invalidateTags([tag]));
      });
      await waitFor(() => expect(refused).toBeGreaterThan(0));
      await reviewsSettled(store);

      expect(screen.queryByText("Couldn't load this record. Please try again.")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "The review on the cover" })).toBeInTheDocument();
      expect(screen.getByText("Take 41.")).toBeInTheDocument();
      expect(screen.getByText(byId.length ? "From the cited release." : "Take 40.")).toBeInTheDocument();
    });

    it("shows the load-failure line when the first read of the item fails", async () => {
      fakeReviewsEndpoints({ forItem: { [ITEM_ID]: [submitted(40)] } });
      server.use(http.get(FILED_ITEM_PATH, () => HttpResponse.json({ message: "boom" }, { status: 500 })));

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load this record. Please try again.");
    });
  });

  describe("the printed-version note", () => {
    const printedOn = { printed_revision_id: 401, printed_at: "2026-10-02T16:00:00Z" };
    const revisionsOf = (reviewId: number, count: number) =>
      Array.from({ length: count }, (_, i) => reviewRevision({ id: reviewId * 10 + 1 + i, review_id: reviewId, revision: i + 1 }));

    it("offers a new slip only on the review on the cover, and shows no note on another printed review", async () => {
      fakeReviewsEndpoints({
        records: [dogaItem()],
        forItem: { [ITEM_ID]: [submitted(40, printedOn), submitted(41, { printed_revision_id: 411, printed_at: printedOn.printed_at })] },
        revisions: { "40": revisionsOf(40, 2), "41": revisionsOf(41, 2) },
      });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const cover = (await screen.findByRole("heading", { name: "The review on the cover" })).closest("section")!;
      expect(await within(cover).findByRole("link", { name: "Print a new slip" })).toHaveAttribute("href", `/dashboard/admin/intake/${ITEM_ID}/slip`);
      const others = screen.getByRole("heading", { name: "Other reviews" }).closest("section")!;
      await within(others).findByText("Take 41.");
      expect(within(others).queryByText(/The cover has an earlier version|printed on the cover/)).not.toBeInTheDocument();
      expect(within(others).queryByRole("link", { name: "Print a new slip" })).not.toBeInTheDocument();
    });

    it.each<[string, number, string | null]>([
      ["the review on the cover, newest revision printed", 1, "This is the version printed on the cover."],
      ["the review on the cover, edited after printing", 2, "The cover has an earlier version of this review, printed Friday, October 2, 2026."],
      ["a printed review that is not on the cover, newest revision printed", 1, null],
      ["a printed review that is not on the cover, edited after printing", 2, null],
    ])("note on %s", async (name, count, expected) => {
      const requested = vi.fn();
      const onCover = !name.includes("not on");
      fakeReviewsEndpoints({
        records: [dogaItem({ accepted_review_id: 40 })],
        forItem: { [ITEM_ID]: [submitted(40, onCover ? printedOn : {}), submitted(41, onCover ? {} : { printed_revision_id: 411, printed_at: printedOn.printed_at })] },
      });
      server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, ({ params }) => {
        requested(params.id);
        return HttpResponse.json(revisionsOf(Number(params.id), count));
      }));

      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByText("Take 40.");
      if (expected) {
        expect(await screen.findByText(expected)).toBeInTheDocument();
      } else {
        expect(reviewApi.endpoints.getReviewRevisions.select(41)(store.getState()).isUninitialized).toBe(true);
        await reviewsSettled(store);
        expect(screen.queryByText(/printed on the cover|earlier version of this review/)).not.toBeInTheDocument();
        expect(requested).not.toHaveBeenCalledWith("41");
      }
    });

    it("links to the history from a review that was edited", async () => {
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40, { revision_count: 2 })] } });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("link", { name: "Edited · see history" })).toHaveAttribute("href", "/dashboard/reviews/40/history");
    });
  });
  describe("tape on the slip", () => {
    it("is drawn on the review on the cover and on no other", async () => {
      fakeReviewsEndpoints({
        records: [dogaItem({ accepted_review_id: 40 })],
        forItem: { [ITEM_ID]: [submitted(40), submitted(41)] },
      });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByText("Take 40.");
      await waitFor(() => expect(tapedSlips()).toHaveLength(1));
      expect(tapedSlips()[0].closest("li")).toHaveTextContent("Take 40.");
    });
  });
  describe("deleting one review", () => {
    const REVIEW_URL = (id: number) => `${TEST_BACKEND_URL}/reviews/${id}`;
    const COVER_LINE = REVIEW_COPY.intakeItem.deleteCoverFiled;
    const HOLDER_ITEM = { state: "checked_out", effective_state: "checked_out", ...heldBy("dj-sessa", "Sessa", "2026-10-02T12:00:00Z") };
    const REMOVED_ITEM = { ...HOLDER_ITEM, ...removedHolder };
    const SHELF_ITEM = { state: "pool", effective_state: "pool", ...returned };

    beforeEach(() => {
      vi.mocked(toast).mockClear();
    });

    // Review 40 is on the cover; 41 is another submitted review; 42 is a draft of this record; 90 is a cited release's.
    const setUp = (item = dogaItem(), extra: Review[] = []) => {
      const reviews = [submitted(40, { author: "Stereolab" }), submitted(41, { author: "Cat Power" }), ...extra];
      fakeReviewsEndpoints({ records: [item], forItem: { [ITEM_ID]: reviews } });
      const box = serveItem(item);
      const deletes: string[] = [];
      server.use(
        http.delete(`${TEST_BACKEND_URL}/reviews/:id`, ({ params }) => {
          deletes.push(String(params.id));
          return new HttpResponse(null, { status: 204 });
        }),
      );
      return { box, deletes };
    };

    const open = async (user: User, name: string) => {
      await user.click(await screen.findByRole("button", { name }));
      return within(await screen.findByRole("alertdialog"));
    };

    it("finds the record's Delete and each review's Delete review by name on one page", async () => {
      setUp(dogaItem({ state: "reviewed", effective_state: "reviewed" }));
      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("button", { name: "Delete" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete review by Stereolab" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete review by Cat Power" })).toBeInTheDocument();
    });

    it("offers Delete review on a draft of this record, with no Use this review, and never on a cited release's review", async () => {
      setUp(dogaItem(), [submitted(42, { author: "Jessica Pratt", status: "draft" }), submitted(90, { author: "Sessa", intake_item_id: null, album_id: 5 })]);
      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("button", { name: "Delete review by Jessica Pratt" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete review by Sessa" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Use this review instead" })).toHaveLength(1);
    });

    it("confirms an ordinary review with its author named, then deletes it and reloads the page", async () => {
      const { box, deletes } = setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const dialog = await open(user, "Delete review by Cat Power");
      expect(dialog.getByText("Delete Cat Power's review? Its history goes with it. This cannot be undone.")).toBeInTheDocument();
      const reads = box.reads;
      await user.click(dialog.getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deletes).toEqual(["41"]));
      await waitFor(() => expect(box.reads).toBeGreaterThan(reads));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("keeps the review when Cancel is pressed", async () => {
      const { deletes } = setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const dialog = await open(user, "Delete review by Cat Power");
      await user.click(dialog.getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(deletes).toEqual([]);
    });

    it.each([
      ["a named DJ holds the record", HOLDER_ITEM, REVIEW_COPY.intakeItem.deleteCoverHeld("Sessa")],
      ["the holder's account was removed", REMOVED_ITEM, REVIEW_COPY.intakeItem.deleteCoverRemoved],
      ["nobody holds the record", SHELF_ITEM, REVIEW_COPY.intakeItem.deleteCoverShelf],
    ])("words the cover review's confirmation for a record where %s", async (_label, held, line) => {
      setUp(dogaItem(held));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const dialog = await open(user, "Delete review by Stereolab");

      expect(dialog.getByText(line)).toBeInTheDocument();
    });

    it("disables Delete on the cover review of a filed record and says why beside it", async () => {
      const { deletes } = setUp(dogaItem({ state: "filed", effective_state: "filed" }));
      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("button", { name: "Delete review by Stereolab" })).toBeDisabled();
      expect(screen.getByText(COVER_LINE)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete review by Cat Power" })).toBeEnabled();
      expect(deletes).toEqual([]);
    });

    it("shows the cover sentence in the notice slot when the server refuses with accepted_review, reloading first", async () => {
      const { box } = setUp();
      server.use(http.delete(REVIEW_URL(40), () => HttpResponse.json({ message: "server words", reason: "accepted_review" }, { status: 409 })));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const dialog = await open(user, "Delete review by Stereolab");
      const reads = box.reads;
      await user.click(dialog.getByRole("button", { name: "Delete" }));

      expect(await screen.findByRole("status")).toHaveTextContent(COVER_LINE);
      expect(box.reads).toBeGreaterThan(reads);
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
    });

    it.each([
      ["a 500", 500],
      ["a 404, the review having been deleted by another music director first", 404],
    ])("shows the failure line in the notice slot after %s, and it survives the reload that removes the entry", async (_label, status) => {
      setUp();
      // The reload answers a list without review 41, as if it were gone, so its entry (and any line held in it) unmounts.
      const reviews = serveItemReviews([submitted(40, { author: "Stereolab" }), submitted(41, { author: "Cat Power" })]);
      // Unset until the DELETE lands, so the first wait cannot pass on the page's initial load.
      let readsAtDelete = Infinity;
      server.use(
        http.delete(REVIEW_URL(41), () => {
          readsAtDelete = reviews.reads;
          reviews.list = [submitted(40, { author: "Stereolab" })];
          return HttpResponse.json({ message: "boom" }, { status });
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const dialog = await open(user, "Delete review by Cat Power");
      await user.click(dialog.getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(reviews.reads).toBeGreaterThan(readsAtDelete));
      await waitFor(() => expect(screen.queryByRole("button", { name: "Delete review by Cat Power" })).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Delete review by Stereolab" })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't delete the review. Please try again."));
    });

    it("disables every Delete review between a successful delete and its reread, and sends no second DELETE", async () => {
      const { box, deletes } = setUp();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const dialog = await open(user, "Delete review by Cat Power");
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(dialog.getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(reread.calls.count).toBe(1));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      const removeCat = screen.getByRole("button", { name: "Delete review by Cat Power" });
      expect(removeCat).toBeDisabled();
      expect(screen.getByRole("button", { name: "Delete review by Stereolab" })).toBeDisabled();
      fireEvent.click(removeCat);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(deletes).toEqual(["41"]);

      reread.release();
      await reread.answered;
      await reviewsSettled(store);
      await waitFor(() => expect(screen.getByRole("button", { name: "Delete review by Cat Power" })).toBeEnabled());
    });

    it.each([
      ["null", null],
      ["empty", ""],
      ["whitespace", "  "],
    ])("names a review with %s author plainly: the button says Delete review and the question is the generic one", async (_label, author) => {
      setUp(dogaItem(HOLDER_ITEM), [submitted(43, { author })]);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const dialog = await open(user, "Delete review");

      expect(dialog.getByText(REVIEW_COPY.deleteConfirm)).toBeInTheDocument();
      expect(screen.queryByText(/^From\s*\./)).not.toBeInTheDocument();
    });
  });

  describe("deleting the record", () => {
    it("puts the record's Delete last on the page, after every other control and the line that says when to use it", async () => {
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40)] } });
      serveItem(dogaItem());
      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const hint = await screen.findByText(DELETE_HINT);
      const remove = screen.getByRole("button", { name: "Delete" });
      const printLink = screen.getByRole("link", { name: "Print the slip" });
      const group = screen.getByRole("radiogroup", { name: "File it" });
      const divider = screen.getByRole("separator");
      const follows = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

      expect(follows(printLink, group)).toBe(true);
      expect(follows(group, divider)).toBe(true);
      expect(follows(divider, hint)).toBe(true);
      expect(follows(hint, remove)).toBe(true);
      const focusable = Array.from(
        document.body.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])"),
      ).filter((el) => !el.closest("[hidden]"));
      expect(focusable[focusable.length - 1]).toBe(remove);
      for (const el of focusable) if (el !== remove) expect(follows(el, remove)).toBe(true);
    });

    const TITLE = "Delete Juana Molina — DOGA from the review shelf?";

    /**
     * Serves the item with its reviews and draft authors, and records every DELETE, every draft-content read, and
     * every read of the item or its reviews that goes out after the DELETE (the record is gone then, so they 404).
     */
    function serveDeletable(reviewAuthors: (string | Review)[], draftAuthors: string[] | undefined, deleted: string[] = []) {
      let gone = false;
      let readsAtGone: number | null = null;
      const markGone = () => {
        gone = true;
        reviewsBox.gone = true;
        readsAtGone ??= reviewsBox.reads;
      };
      // `markGone` is for a spec that answers the DELETE itself (held), so reads after it still count as after.
      const seen = {
        deletes: 0,
        draftReads: 0,
        itemReadsAfter: 0,
        get reviewReadsAfter() {
          return readsAtGone === null ? 0 : reviewsBox.reads - readsAtGone;
        },
        markGone,
      };
      const reviews = reviewAuthors.map((entry, i) => (typeof entry === "string" ? submitted(40 + i, { author: entry }) : entry));
      fakeReviewsEndpoints({ records: [dogaItem({ draft_authors: draftAuthors, accepted_review_id: null })] });
      const reviewsBox = serveItemReviews(reviews);
      server.use(
        http.get(FILED_ITEM_PATH, () => {
          if (!gone) return HttpResponse.json(dogaItem({ draft_authors: draftAuthors, accepted_review_id: null }));
          seen.itemReadsAfter += 1;
          return HttpResponse.json({ message: "Intake item not found" }, { status: 404 });
        }),
        http.delete(FILED_ITEM_PATH, () => {
          seen.deletes += 1;
          markGone();
          return HttpResponse.json({ deleted_review_authors: deleted });
        }),
        http.get(`${TEST_BACKEND_URL}/reviews/:id`, () => {
          seen.draftReads += 1;
          return HttpResponse.json({}, { status: 404 });
        }),
      );
      return seen;
    }

    it.each([
      ["reviews only, one author", ["Cat Power"], [], ["This also deletes the submitted review by Cat Power."]],
      ["reviews only, several authors", ["Cat Power", "Stereolab"], [], ["This also deletes the submitted reviews by Cat Power and Stereolab."]],
      ["a repeated author once", ["Cat Power", "Stereolab", "Cat Power"], [], ["This also deletes the submitted reviews by Cat Power and Stereolab."]],
      [
        "drafts only, one author",
        [],
        ["Jessica Pratt"],
        ["It also deletes an unfinished draft by Jessica Pratt. They have not submitted yet and will lose what they wrote."],
      ],
      [
        "drafts only, several authors",
        [],
        ["Jessica Pratt", "Sessa", "Jessica Pratt"],
        ["It also deletes unfinished drafts by Jessica Pratt and Sessa. They have not submitted yet and will lose what they wrote."],
      ],
      [
        "both, naming one author in each",
        ["Cat Power"],
        ["Cat Power"],
        [
          "This also deletes the submitted review by Cat Power.",
          "It also deletes an unfinished draft by Cat Power. They have not submitted yet and will lose what they wrote.",
        ],
      ],
      ["neither", [], undefined, ["No reviews have been written for it."]],
    ])("confirms with the right sentences: %s", async (_label, reviewAuthors, draftAuthors, sentences) => {
      serveDeletable(reviewAuthors, draftAuthors);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));

      const dialog = await screen.findByRole("alertdialog", { name: TITLE });
      for (const sentence of sentences) expect(within(dialog).getByText(sentence)).toBeInTheDocument();
      expect(within(dialog).getByText("This cannot be undone.")).toBeInTheDocument();
      if (!sentences.includes("No reviews have been written for it.")) {
        expect(within(dialog).queryByText("No reviews have been written for it.")).not.toBeInTheDocument();
      }
    });

    it.each([
      ["deleteReviews", ["Cat Power"], "This also deletes the submitted review by Cat Power."],
      ["deleteReviews", ["Cat Power", "Stereolab"], "This also deletes the submitted reviews by Cat Power and Stereolab."],
      ["deleteReviews", ["Cat Power", "Stereolab", "Sessa"], "This also deletes the submitted reviews by Cat Power, Stereolab and Sessa."],
      [
        "deleteReviews",
        ["Cat Power", "Stereolab", "Sessa", "Jessica Pratt"],
        "This also deletes the submitted reviews by Cat Power, Stereolab, Sessa and Jessica Pratt.",
      ],
      [
        "deleteDrafts",
        ["Cat Power"],
        "It also deletes an unfinished draft by Cat Power. They have not submitted yet and will lose what they wrote.",
      ],
      [
        "deleteDrafts",
        ["Cat Power", "Stereolab"],
        "It also deletes unfinished drafts by Cat Power and Stereolab. They have not submitted yet and will lose what they wrote.",
      ],
      [
        "deleteDrafts",
        ["Cat Power", "Stereolab", "Sessa"],
        "It also deletes unfinished drafts by Cat Power, Stereolab and Sessa. They have not submitted yet and will lose what they wrote.",
      ],
      [
        "deleteDrafts",
        ["Cat Power", "Stereolab", "Sessa", "Jessica Pratt"],
        "It also deletes unfinished drafts by Cat Power, Stereolab, Sessa and Jessica Pratt. They have not submitted yet and will lose what they wrote.",
      ],
      ["deleted", ["Cat Power"], "Deleted, with the reviews and drafts by Cat Power."],
      ["deleted", ["Cat Power", "Stereolab"], "Deleted, with the reviews and drafts by Cat Power and Stereolab."],
      ["deleted", ["Cat Power", "Stereolab", "Sessa"], "Deleted, with the reviews and drafts by Cat Power, Stereolab and Sessa."],
      [
        "deleted",
        ["Cat Power", "Stereolab", "Sessa", "Jessica Pratt"],
        "Deleted, with the reviews and drafts by Cat Power, Stereolab, Sessa and Jessica Pratt.",
      ],
    ] as const)("writes %s with no comma before 'and': %j", (line, names, expected) => {
      expect(REVIEW_COPY.intakeItem[line]([...names])).toBe(expected);
    });

    it("sends nothing until the confirmation is accepted, and makes no request for a draft's text", async () => {
      const seen = serveDeletable(["Cat Power"], ["Jessica Pratt"]);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));

      expect(seen).toMatchObject({ deletes: 0, draftReads: 0 });
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("says whom the response deleted, each name once, not whom the confirmation named", async () => {
      const seen = serveDeletable(["Cat Power"], ["Jessica Pratt"], ["Cat Power", "Sessa", "Cat Power", "Sessa"]);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText("Deleted, with the reviews and drafts by Cat Power and Sessa.")).toBeInTheDocument();
      expect(seen.deletes).toBe(1);
      expect(seen.draftReads).toBe(0);
      expect(screen.queryByText(/Jessica Pratt/)).not.toBeInTheDocument();
    });

    it("words its own failure line when the delete is refused", async () => {
      serveDeletable([], undefined);
      server.use(http.delete(FILED_ITEM_PATH, () => HttpResponse.json({ message: "server text" }, { status: 500 })));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText("Couldn't delete this record. Please try again.")).toBeInTheDocument();
      expect(screen.queryByText("server text")).not.toBeInTheDocument();
    });

    it.each([
      ["pool", true],
      ["requested", true],
      ["checked_out", true],
      ["reviewed", true],
      ["filed", false],
      ["finalized", false],
    ] as const)("in the %s state, Delete is offered: %s", async (state, offered) => {
      fakeReviewsEndpoints({
        records: [dogaItem({ state, effective_state: state, accepted_review_id: null })],
        forItem: { [ITEM_ID]: [submitted(40)] },
      });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByText("Take 40.");
      if (offered) expect(await screen.findByRole("button", { name: "Delete" })).toBeInTheDocument();
      else {
        await screen.findByText("Filed.");
        expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
        expect(screen.queryByText(DELETE_HINT)).not.toBeInTheDocument();
        expect(screen.queryByRole("separator")).not.toBeInTheDocument();
      }
    });

    it("names only submitted reviews as reviews when the MD has a draft of their own on the record", async () => {
      serveDeletable(
        [submitted(40, { author: "Cat Power" }), submitted(41, { author: "MD", status: "draft" })],
        ["MD"],
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));

      const dialog = await screen.findByRole("alertdialog", { name: TITLE });
      expect(within(dialog).getByText("This also deletes the submitted review by Cat Power.")).toBeInTheDocument();
      expect(
        within(dialog).getByText("It also deletes an unfinished draft by MD. They have not submitted yet and will lose what they wrote."),
      ).toBeInTheDocument();
    });

    it("names authors in first-appearance order, not alphabetical order", async () => {
      const seen = serveDeletable(["Stereolab", "Cat Power"], ["Sessa", "Jessica Pratt"], ["Stereolab", "Cat Power"]);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));

      const dialog = await screen.findByRole("alertdialog", { name: TITLE });
      expect(within(dialog).getByText("This also deletes the submitted reviews by Stereolab and Cat Power.")).toBeInTheDocument();
      expect(
        within(dialog).getByText("It also deletes unfinished drafts by Sessa and Jessica Pratt. They have not submitted yet and will lose what they wrote."),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      expect(await screen.findByText("Deleted, with the reviews and drafts by Stereolab and Cat Power.")).toBeInTheDocument();
      expect(seen.deletes).toBe(1);
    });

    it("says only Deleted. when the response names no one", async () => {
      serveDeletable([], undefined, []);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText("Deleted.")).toBeInTheDocument();
    });

    it("reads neither the deleted record nor its reviews again, and shows no error toast", async () => {
      vi.mocked(toast.error).mockClear();
      const seen = serveDeletable(["Cat Power"], undefined, ["Cat Power"]);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
      expect(await screen.findByText("Deleted, with the reviews and drafts by Cat Power.")).toBeInTheDocument();
      await reviewsSettled(store);

      expect(seen).toMatchObject({ deletes: 1, itemReadsAfter: 0, reviewReadsAfter: 0 });
      expect(toast.error).not.toHaveBeenCalled();
    });

    describe("when the page is gone before the delete answers", () => {
      const openDelete = async (user: User) => {
        await user.click(await screen.findByRole("button", { name: "Delete" }));
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
      };

      // Each spec ends only after the held answer has reached the client, never on a fixed sleep.
      const watchForThrows = () => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        const rejections: unknown[] = [];
        const onRejection = (reason: unknown) => rejections.push(reason);
        process.on("unhandledRejection", onRejection);
        return {
          errors,
          rejections,
          stop: () => {
            process.off("unhandledRejection", onRejection);
            errors.mockRestore();
          },
        };
      };

      it("reads nothing again, and throws nothing, when the answer is a success", async () => {
        const seen = serveDeletable(["Cat Power"], undefined, ["Cat Power"]);
        const { calls, release, answered } = holdResponse("delete", FILED_ITEM_PATH, () => {
          seen.markGone();
          return HttpResponse.json({ deleted_review_authors: ["Cat Power"] });
        });
        const watch = watchForThrows();
        try {
          const { user, unmount } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
          await openDelete(user);
          await waitFor(() => expect(calls.count).toBe(1));

          unmount();
          release();
          await answered;

          expect(seen).toMatchObject({ itemReadsAfter: 0, reviewReadsAfter: 0, draftReads: 0 });
          expect(watch.errors).not.toHaveBeenCalled();
          expect(watch.rejections).toEqual([]);
        } finally {
          watch.stop();
        }
      });

      it("reloads the record once, and throws nothing, when the answer is an already_filed refusal", async () => {
        serveDeletable(["Cat Power"], undefined);
        const { calls, release, answered } = holdResponse("delete", FILED_ITEM_PATH, () =>
          HttpResponse.json({ message: "server words", reason: "already_filed" }, { status: 409 }),
        );
        const watch = watchForThrows();
        try {
          const { user, unmount } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
          await openDelete(user);
          await waitFor(() => expect(calls.count).toBe(1));
          // The reload's item read is held, so the spec sees it arrive and settle rather than sleeping.
          const reload = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(dogaItem({ state: "filed", effective_state: "filed" })));

          unmount();
          release();
          await answered;
          // A hook refetch() throws here before any request goes out, so the read below never happens.
          await waitFor(() => expect(reload.calls.count).toBe(1));
          reload.release();
          await reload.answered;

          expect(reload.calls.count).toBe(1);
          expect(watch.errors).not.toHaveBeenCalled();
          expect(watch.rejections).toEqual([]);
        } finally {
          watch.stop();
        }
      });
    });

    it("reloads and says the record is already filed when the delete loses its race to a filing", async () => {
      serveDeletable(["Cat Power"], undefined);
      let reads = 0;
      let filed = false;
      server.use(
        http.get(FILED_ITEM_PATH, () => {
          reads += 1;
          return HttpResponse.json(
            filed ? dogaItem({ state: "filed", effective_state: "filed" }) : dogaItem({ accepted_review_id: null }),
          );
        }),
        http.delete(FILED_ITEM_PATH, () => {
          filed = true;
          return HttpResponse.json({ message: "server words", reason: "already_filed" }, { status: 409 });
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      const readsBefore = reads;
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText("This record has already been filed. The page has been reloaded.")).toBeInTheDocument();
      expect(reads).toBeGreaterThan(readsBefore);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument());
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
    });

    it("keeps the generic line and does not reload when the record was already deleted elsewhere (404)", async () => {
      serveDeletable(["Cat Power"], undefined);
      let reads = 0;
      server.use(
        http.get(FILED_ITEM_PATH, () => {
          reads += 1;
          return HttpResponse.json(dogaItem({ accepted_review_id: null }));
        }),
        http.delete(FILED_ITEM_PATH, () => HttpResponse.json({ message: "gone" }, { status: 404 })),
      );
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      const readsBefore = reads;
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText("Couldn't delete this record. Please try again.")).toBeInTheDocument();
      await reviewsSettled(store);
      expect(reads).toBe(readsBefore);
    });
  });

  describe("who each waiting review is from", () => {

    const waiting = (id: number, overrides = {}) => submitted(id, { author: "Jessica Pratt", author_user_id: "dj-jess", ...overrides });
    const otherReviews = async () => (await screen.findByRole("heading", { name: "Other reviews" })).closest("section")!;

    it.each([
      ["the author is the DJ who has the record", heldBy("dj-jess", "Jessica Pratt"), "From Jessica Pratt, who has this record."],
      ["someone else wrote it and a DJ has the record", heldBy("dj-sam", "DJ Sam"), "From Jessica Pratt. The record is with DJ Sam."],
      [
        "someone else wrote it and a request is open",
        { state: "requested", effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat") },
        "From Jessica Pratt. The record is being held for DJ Pat.",
      ],
      ["someone else wrote it and the holder's account was removed", removedHolder, "From Jessica Pratt. The record is checked out; holder removed."],
      [
        "someone else wrote it and the record is on the review shelf",
        { state: "pool", effective_state: "pool" },
        "From Jessica Pratt. The record is on the review shelf.",
      ],
    ])("says so under Other reviews when %s", async (_label, overrides, line) => {
      fakeReviewsEndpoints({ records: [dogaItem(overrides)], forItem: { [ITEM_ID]: [submitted(40), waiting(41)] } });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await within(await otherReviews()).findByText(line)).toBeInTheDocument();
      const cover = screen.getByRole("heading", { name: "The review on the cover" }).closest("section")!;
      expect(within(cover).queryByText(/^From /)).not.toBeInTheDocument();
    });

    it("matches nobody when the review has no linked account", async () => {
      fakeReviewsEndpoints({ records: [dogaItem(heldBy("dj-jess", "Jessica Pratt"))], forItem: { [ITEM_ID]: [submitted(40), waiting(41, { author_user_id: null })] } });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await within(await otherReviews()).findByText("From Jessica Pratt. The record is with Jessica Pratt.")).toBeInTheDocument();
    });

    it("says nothing for a record nobody has that is no longer on the review shelf", async () => {
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40), waiting(41)] } });

      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await otherReviews();
      await reviewsSettled(store);
      expect(screen.queryByText(/^From /)).not.toBeInTheDocument();
    });

    it("says nothing for a draft by another author on a record a DJ has, while a submitted review on the page gets its line", async () => {
      fakeReviewsEndpoints({
        records: [dogaItem(heldBy("dj-sam", "DJ Sam"))],
        forItem: { [ITEM_ID]: [submitted(40), waiting(41), waiting(42, { status: "draft", author: "Nilüfer Yanya", author_user_id: "dj-nil" })] },
      });

      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const others = await otherReviews();
      expect(await within(others).findByText("From Jessica Pratt. The record is with DJ Sam.")).toBeInTheDocument();
      await reviewsSettled(store);
      expect(within(others).getAllByText(/^From /)).toHaveLength(1);
      expect(screen.queryByText(/From Nilüfer Yanya/)).not.toBeInTheDocument();
    });
  });

  describe("recording a review", () => {
    const NEW_ID = 90;
    const SERVER_WORDS = "author_user_id names no account";
    const NOTHING_ON_COVER = { accepted_review_id: null };
    const REVIEWERS = [
      { id: "dj-sam", name: "Sam" },
      { id: "md-me", name: "Mo" },
    ];
    const SAVE_URL = `${TEST_BACKEND_URL}/reviews`;

    beforeEach(() => {
      vi.mocked(toast).mockClear();
      vi.mocked(toast.error).mockClear();
    });

    /**
     * Serves the item and its reviews through state the create and the submit change, and records both. Per the contract
     * (`NewReviewRequest.accept`), a create with `accept` true or left out is submitted and on the cover; only an
     * explicit `accept: false` is a draft that leaves the cover alone until its submit.
     */
    const setUp = (item = dogaItem(NOTHING_ON_COVER), others: Review[] = []) => {
      fakeReviewsEndpoints({ records: [item], reviewers: REVIEWERS });
      const box = serveItem(item);
      const reviews = serveItemReviews(others);
      const creates: NewReviewRequest[] = [];
      const submits: string[] = [];
      server.use(
        http.post(SAVE_URL, async ({ request }) => {
          const body = (await request.json()) as NewReviewRequest;
          creates.push(body);
          const fields = { author: body.author, author_user_id: body.author_user_id ?? null, medium: body.medium, review: body.review ?? null };
          const made = body.accept !== false ? submitted(NEW_ID, fields) : draft(NEW_ID, fields);
          reviews.list = [...reviews.list, made];
          if (body.accept !== false) box.item = { ...box.item, accepted_review_id: NEW_ID };
          return HttpResponse.json(made, { status: 201 });
        }),
        // A ticked create is already submitted and never reaches this; an unticked one is a draft until it does.
        http.post(`${SAVE_URL}/:id/submit`, ({ params }) => {
          submits.push(String(params.id));
          const made = reviews.list.find((r) => r.id === Number(params.id))!;
          const done = { ...made, status: "submitted" as const };
          reviews.list = reviews.list.map((r) => (r.id === done.id ? done : r));
          return HttpResponse.json(done);
        }),
      );
      return { box, reviews, creates, submits };
    };

    const open =async (user: User) => user.click(await screen.findByRole("button", { name: "Record a review" }));
    const fillAuthor = async (user: User, text: string) => {
      const field = screen.getByRole("textbox", { name: "Author" });
      await user.clear(field);
      if (text) await user.type(field, text);
    };
    const writeReview = (user: User, text: string) => user.type(screen.getByRole("textbox", { name: "Review" }), text);
    const link = async (user: User, name: string) => {
      await user.click(screen.getByRole("combobox", { name: "Link to an account (optional)" }));
      await user.click(await screen.findByRole("option", { name }));
    };
    const save = (user: User) => user.click(screen.getByRole("button", { name: "Save" }));
    const noFields = { buzzwords: null, artist_blurb: null, recommended_tracks: null, fcc: null };

    describe("opened with a start", () => {
      const archived = (reviewer: string | null) =>
        formReviewStart({
          id: 7, reviewer, album_id: 3, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos",
          artist_blurb: "Buenos Aires.", review: "Warm and strange.", recommended_tracks: "la paradoja", buzzwords: "folktronica",
          fcc_violations: "None.", review_purpose: null, rotated: null, released_within_six_months: null, social_consent: null, submitted_at: null,
        });
      const renderForm = (start: ReturnType<typeof archived>) =>
        renderScreen(
          <RecordReviewForm itemId={ITEM_ID} hasCover={false} start={start} disabled={false} onHold={() => () => {}} onWritten={async () => {}} onNotice={vi.fn()} onClose={vi.fn()} />,
        );

      it("from a form review shows the copied text and author and both lines, and saves through the ticked path", async () => {
        const { creates } = setUp();
        const { user } = renderForm(archived("Sam 3/4"));

        expect(screen.getByRole("textbox", { name: "Author" })).toHaveValue("Sam 3/4");
        expect(screen.getByRole("textbox", { name: "Review" })).toHaveValue("Warm and strange.");
        expect(screen.getByRole("textbox", { name: "Buzzwords" })).toHaveValue("folktronica");
        expect(screen.getByText(REVIEW_COPY.record.copiedFromForm).textContent).toBe("Copied from the review form. Check it, then save.");
        expect(screen.getByText(REVIEW_COPY.record.copiedAuthor).textContent).toBe("Copied as the reviewer wrote it, so it may include a date.");
        expect(screen.queryByText(REVIEW_COPY.record.copiedNoName)).not.toBeInTheDocument();
        expect(screen.queryByText(REVIEW_COPY.record.byHand)).not.toBeInTheDocument();
        // The copied-from-form line sits above the fields; the reviewer-name line is the Author field's own helper.
        const author = screen.getByRole("textbox", { name: "Author" });
        expect(screen.getByText(REVIEW_COPY.record.copiedFromForm).compareDocumentPosition(author) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(author).toHaveAccessibleDescription(REVIEW_COPY.record.copiedAuthor);

        await save(user);

        await waitFor(() => expect(creates).toHaveLength(1));
        expect(creates[0]).toMatchObject({ intake_item_id: ITEM_ID, author: "Sam 3/4", medium: "typed", accept: true, review: "Warm and strange.", fcc: "None." });
      });

      it("from a form review with no reviewer has a blank author and the no-name line", () => {
        setUp();
        renderForm(archived(null));

        expect(screen.getByRole("textbox", { name: "Author" })).toHaveValue("");
        expect(screen.getByText(REVIEW_COPY.record.copiedNoName).textContent).toBe("Copied from the review form. Check it, add the reviewer's name, then save.");
        expect(screen.queryByText(REVIEW_COPY.record.copiedFromForm)).not.toBeInTheDocument();
        expect(screen.queryByText(REVIEW_COPY.record.copiedAuthor)).not.toBeInTheDocument();
        expect(screen.queryByText(REVIEW_COPY.record.byHand)).not.toBeInTheDocument();
      });

      it("for a paper-only review has Handwritten chosen and shows the handwritten line and the by-hand line", () => {
        setUp();
        renderForm(PAPER_START);

        expect(screen.getByRole("radio", { name: "Handwritten" })).toBeChecked();
        expect(screen.getByText(REVIEW_COPY.record.handwrittenNote).textContent).toBe("This review is handwritten, so it is already on the sleeve. Nothing will be printed.");
        expect(screen.getByText(REVIEW_COPY.record.byHand).textContent).toBe("This review exists only on paper. Copy this record's slip by hand, then record it here.");
        expect(screen.queryByText(REVIEW_COPY.record.copiedFromForm)).not.toBeInTheDocument();
      });

      it("opens under a new key from a second start while one is open, so the form remounts", () => {
        const first = nextRecording(null, PAPER_START);
        const second = nextRecording(first, archived("Sam"));
        const third = nextRecording(second, PAPER_START);

        expect(second.start).toEqual(archived("Sam"));
        expect(second.key).not.toBe(first.key);
        expect(third.key).not.toBe(second.key);
      });

      it("the button opens the form and closes it again", async () => {
        setUp();
        const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await open(user);
        expect(screen.getByRole("heading", { name: "Record a review" })).toBeInTheDocument();

        await open(user);

        expect(screen.queryByRole("heading", { name: "Record a review" })).not.toBeInTheDocument();
      });

      it("opened by the button has no copied-from line and Typed chosen", async () => {
        setUp();
        const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await open(user);

        expect(screen.getByRole("radio", { name: "Typed" })).toBeChecked();
        expect(screen.queryByText(REVIEW_COPY.record.byHand)).not.toBeInTheDocument();
        expect(screen.queryByText(REVIEW_COPY.record.copiedFromForm)).not.toBeInTheDocument();
      });
    });

    it.each([
      ["a filed", { state: "filed", effective_state: "filed" }],
      ["a finalized", { state: "finalized", effective_state: "finalized" }],
      ["a record still on the review shelf", { state: "pool", effective_state: "pool", accepted_review_id: null }],
    ] as const)("offers Record a review on %s record", async (_label, overrides) => {
      setUp(dogaItem(overrides));

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      expect(await screen.findByRole("button", { name: "Record a review" })).toBeEnabled();
    });

    it("opens a form with the slip's fields, no consent control, and no publishing field in the request", async () => {
      const { creates } = setUp();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await open(user);

      expect(screen.getByRole("heading", { name: "Record a review" })).toBeInTheDocument();
      expect(screen.getByText(REVIEW_COPY.record.noConsent)).toBeInTheDocument();
      for (const label of ["Buzzwords", "About the artist", "Review", "Recommended tracks", "FCC"]) {
        expect(screen.getByRole("textbox", { name: label })).toBeInTheDocument();
      }
      for (const consent of ["Website", "WXYC apps", "Instagram", "DJ name", "Real name", "No name"]) {
        expect(screen.queryByRole("checkbox", { name: consent })).not.toBeInTheDocument();
        expect(screen.queryByRole("radio", { name: consent })).not.toBeInTheDocument();
      }
      expect(screen.queryByText(REVIEW_COPY.consent.legend)).not.toBeInTheDocument();

      await fillAuthor(user, "Cat Power");
      await writeReview(user, "Warm.");
      await save(user);
      await waitFor(() => expect(creates).toHaveLength(1));
      await reviewsSettled(store);
      expect(Object.keys(creates[0]).filter((key) => key.startsWith("publish_") || key === "credit")).toEqual([]);
    });

    it("records an on-behalf typed review in one create with accept true and no submit, and the page then shows it on the cover", async () => {
      const { creates, submits } = setUp();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      await fillAuthor(user, "  Cat Power ");
      await link(user, "Sam");
      await writeReview(user, "Warm.");
      await save(user);

      const cover = (await screen.findByRole("heading", { name: "The review on the cover" })).closest("section")!;
      expect(await within(cover).findByText("Warm.")).toBeInTheDocument();
      expect(await screen.findByRole("status")).toHaveTextContent("Recorded.");
      await reviewsSettled(store);
      expect(creates).toEqual([
        { intake_item_id: ITEM_ID, author: "Cat Power", author_user_id: "dj-sam", medium: "typed", accept: true, ...noFields, review: "Warm." },
      ]);
      expect(submits).toEqual([]);
      expect(screen.queryByRole("heading", { name: "Record a review" })).not.toBeInTheDocument();
    });

    it("opens with Use this as the record's review ticked", async () => {
      setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      expect(screen.getByRole("checkbox", { name: REVIEW_COPY.record.useAsCover })).toBeChecked();
    });

    it("says the other-reviews line, and neither cover line, once the box is unticked", async () => {
      setUp(dogaItem(), [submitted(40)]);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      await user.click(screen.getByRole("checkbox", { name: REVIEW_COPY.record.useAsCover }));

      expect(screen.getByText(REVIEW_COPY.record.otherReview)).toBeInTheDocument();
      expect(screen.queryByText(REVIEW_COPY.record.coverNone)).not.toBeInTheDocument();
      expect(screen.queryByText(REVIEW_COPY.record.coverReplaces)).not.toBeInTheDocument();
    });

    it("with the box unticked, creates with accept false, submits it, and the review appears under Other reviews", async () => {
      const { creates, submits } = setUp(dogaItem(), [submitted(40)]);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Cat Power");
      await writeReview(user, "Warm.");
      await user.click(screen.getByRole("checkbox", { name: REVIEW_COPY.record.useAsCover }));

      await save(user);

      const others = (await screen.findByRole("heading", { name: "Other reviews" })).closest("section")!;
      expect(await within(others).findByText("Warm.")).toBeInTheDocument();
      // Only a submitted review offers Use this review, so a draft left under Other reviews fails here.
      await waitFor(() => expect(within(others).getAllByRole("button", { name: /^Use this review/ })).toHaveLength(1));
      expect((await screen.findByRole("status")).textContent).toBe("Recorded.");
      await reviewsSettled(store);
      expect(creates).toEqual([
        { intake_item_id: ITEM_ID, author: "Cat Power", medium: "typed", accept: false, ...noFields, review: "Warm." },
      ]);
      expect(submits).toEqual([String(NEW_ID)]);
      const cover = screen.getByRole("heading", { name: "The review on the cover" }).closest("section")!;
      expect(within(cover).queryByText("Warm.")).not.toBeInTheDocument();
    });

    it("with the box unticked and the submit failing, says the review is a draft, closes the form and never says Recorded.", async () => {
      const { creates, submits } = setUp();
      server.use(http.post(`${SAVE_URL}/:id/submit`, ({ params }) => {
        submits.push(String(params.id));
        return HttpResponse.json({ message: "boom" }, { status: 500 });
      }));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Cat Power");
      await writeReview(user, "Warm.");
      await user.click(screen.getByRole("checkbox", { name: REVIEW_COPY.record.useAsCover }));

      await save(user);

      expect((await screen.findByRole("status")).textContent).toBe(REVIEW_COPY.record.draftNotSubmitted);
      await reviewsSettled(store);
      expect(screen.queryByText("Recorded.")).not.toBeInTheDocument();
      // Closed like a success, so no Save is left that could send a second create.
      expect(screen.queryByRole("heading", { name: "Record a review" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: REVIEW_COPY.save })).not.toBeInTheDocument();
      expect(creates).toHaveLength(1);
      expect(submits).toEqual([String(NEW_ID)]);
    });

    it("treats a create that leaves accept out as submitted and on the cover, as the contract says", async () => {
      const { creates, box } = setUp();
      const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await reviewsSettled(store);

      const omitted = { intake_item_id: ITEM_ID, author: "Cat Power", medium: "typed", review: "Warm." };
      const response = await fetch(SAVE_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(omitted) });

      expect(creates).toHaveLength(1);
      expect(creates[0]).not.toHaveProperty("accept");
      expect(await response.json()).toMatchObject({ id: NEW_ID, status: "submitted" });
      expect(box.item.accepted_review_id).toBe(NEW_ID);
    });

    it("holds the unticked save's Recorded. line until the page's reread settles", async () => {
      const { box, submits } = setUp(dogaItem(), [submitted(40)]);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Cat Power");
      await writeReview(user, "Warm.");
      await user.click(screen.getByRole("checkbox", { name: REVIEW_COPY.record.useAsCover }));
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await save(user);

      await waitFor(() => expect(reread.calls.count).toBeGreaterThan(0));
      await waitFor(() => expect(submits).toEqual([String(NEW_ID)]));
      await renderedFrame();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Record a review" })).toBeInTheDocument();

      reread.release();
      await reread.answered;
      expect((await screen.findByRole("status")).textContent).toBe("Recorded.");
    });

    it("records a handwritten review with no text, every field null and no account", async () => {
      const { creates, submits } = setUp();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      await fillAuthor(user, "Sessa");
      await user.click(screen.getByRole("radio", { name: "Handwritten" }));
      expect(screen.getByText(REVIEW_COPY.record.handwrittenNote)).toBeInTheDocument();
      await save(user);

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Recorded."));
      await reviewsSettled(store);
      expect(creates).toEqual([{ intake_item_id: ITEM_ID, author: "Sessa", medium: "handwritten", accept: true, ...noFields, review: null }]);
      expect(submits).toEqual([]);
    });

    it.each([
      ["no review on the cover", NOTHING_ON_COVER, REVIEW_COPY.record.coverNone, REVIEW_COPY.record.coverReplaces],
      ["a review on the cover", {}, REVIEW_COPY.record.coverReplaces, REVIEW_COPY.record.coverNone],
    ])("under the form, %s says its line and not the other", async (_label, overrides, line, other) => {
      setUp(dogaItem(overrides), overrides === NOTHING_ON_COVER ? [] : [submitted(40)]);
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      expect(screen.getByText(line)).toBeInTheDocument();
      expect(screen.queryByText(other)).not.toBeInTheDocument();
    });

    it.each([
      ["another account", "Sam", true],
      ["the signed-in account", "Mo", false],
      ["no account", "Not linked", false],
    ])("says the author is emailed only for %s: %s", async (_label, name, emailed) => {
      setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      await link(user, "Sam");
      if (name !== "Sam") await link(user, name);

      const line = REVIEW_COPY.record.emailed("Sam");
      if (emailed) expect(screen.getByText(line)).toBeInTheDocument();
      else expect(screen.queryByText(/will be emailed/)).not.toBeInTheDocument();
    });

    it("says the accounts could not be loaded when the list fails, and still lets the review be saved unlinked", async () => {
      const { creates } = setUp();
      server.use(http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      expect(await screen.findByText("Couldn't load the accounts. Please try again.")).toBeInTheDocument();
      await fillAuthor(user, "Cat Power");
      await writeReview(user, "Warm.");
      await save(user);

      await waitFor(() => expect(creates).toHaveLength(1));
      await reviewsSettled(store);
    });

    it("never reads the roster to fill the account picker", async () => {
      setUp();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await link(user, "Sam");
      await reviewsSettled(store);

      expect(listUsers).not.toHaveBeenCalled();
    });

    it.each([
      ["a blank author", "   ", "Warm.", "Say who wrote the review."],
      ["an author over 128 characters", "x".repeat(129), "Warm.", null],
      ["a typed review with no text", "Cat Power", "", "Write the review before you save it."],
      ["a typed review with whitespace-only text", "Cat Power", "   ", "Write the review before you save it."],
    ])("stops %s before any request", async (_label, author, text, line) => {
      const { creates, submits } = setUp();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      fireEvent.change(screen.getByRole("textbox", { name: "Author" }), { target: { value: author } });
      if (text) fireEvent.change(screen.getByRole("textbox", { name: "Review" }), { target: { value: text } });
      await save(user);

      await reviewsSettled(store);
      expect(creates).toEqual([]);
      expect(submits).toEqual([]);
      if (line) expect(screen.getByText(line)).toBeInTheDocument();
    });

    it("stops the author's typing at 128 characters", async () => {
      setUp();
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);

      await user.type(screen.getByRole("textbox", { name: "Author" }), "x".repeat(130));

      expect(screen.getByRole("textbox", { name: "Author" })).toHaveValue("x".repeat(128));
    });

    it.each([
      ["an account was linked", true],
      ["no account was linked", false],
    ])("on a 400 when %s, says its own line with the server's words hidden, or the server's words once", async (_label, linked) => {
      setUp();
      server.use(http.post(SAVE_URL, () => HttpResponse.json({ message: SERVER_WORDS }, { status: 400 })));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Cat Power");
      await writeReview(user, "Warm.");
      if (linked) await link(user, "Sam");
      await reviewsSettled(store);

      await save(user);

      const accountGone = REVIEW_COPY.record.accountGone;
      if (linked) {
        expect((await screen.findByRole("alert")).textContent).toBe(accountGone);
        expect(screen.queryByText(SERVER_WORDS)).not.toBeInTheDocument();
      } else {
        expect(await screen.findAllByText(SERVER_WORDS)).toHaveLength(1);
        expect(screen.queryByText(accountGone)).not.toBeInTheDocument();
      }
      await reviewsSettled(store);
      expect(screen.getByRole("textbox", { name: "Review" })).toHaveValue("Warm.");
    });

    it("says it could not record the review on any other failure, and keeps what was typed", async () => {
      setUp();
      server.use(http.post(SAVE_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Cat Power");
      await writeReview(user, "Warm.");

      await save(user);

      expect((await screen.findByRole("alert")).textContent).toBe("Couldn't record the review. Please try again.");
      await reviewsSettled(store);
      expect(screen.getByRole("textbox", { name: "Review" })).toHaveValue("Warm.");
      expect(screen.queryByText("boom")).not.toBeInTheDocument();
    });

    it("disables every Use this review and Delete review while the ticked save's reread is outstanding, and enables them once it settles", async () => {
      const { box, creates } = setUp(dogaItem(), [submitted(40), submitted(41, { author: "Cat Power" })]);
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Sessa");
      await writeReview(user, "Warm.");
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await save(user);

      await waitFor(() => expect(reread.calls.count).toBe(1));
      expect(creates).toHaveLength(1);
      // Save stays out of reach while the reread is held, so a second press cannot record the review twice.
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(guarded().length).toBeGreaterThan(0);
      guarded().forEach((button) => expect(button).toBeDisabled());

      reread.release();
      await reread.answered;
      await reviewsSettled(store);
      await waitFor(() => guarded().forEach((button) => expect(button).toBeEnabled()));
      expect(guarded().length).toBeGreaterThan(0);
      expect(creates).toHaveLength(1);
    });

    it("disables every Use this review and Delete review while the ticked create is in flight, and enables them when it fails", async () => {
      setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
      const write = holdResponse("post", SAVE_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 }));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Sessa");
      await writeReview(user, "Warm.");
      await reviewsSettled(store);

      await save(user);

      await waitFor(() => expect(write.calls.count).toBe(1));
      expect(guarded()).toHaveLength(4);
      guarded().forEach((b) => expect(b).toBeDisabled());

      write.release();
      await write.answered;
      expect((await screen.findByRole("alert")).textContent).toBe(REVIEW_COPY.record.couldNotRecord);
      await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
    });

    it("disables Save and says the save replaces the cover while another write's reread is outstanding", async () => {
      const { box } = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41)]);
      server.use(acceptingReview(box));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      expect(screen.getByText(REVIEW_COPY.record.coverNone)).toBeInTheDocument();
      const choose = await screen.findByRole("button", { name: "Use this review" });
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(choose);

      await waitFor(() => expect(reread.calls.count).toBe(1));
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByText(REVIEW_COPY.record.coverReplaces)).toBeInTheDocument();

      reread.release();
      await reread.answered;
      await reviewsSettled(store);
      await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    });

    it("keeps saying the save will be the review on the cover through the form's own ticked save, on a record with nothing on the cover", async () => {
      const { box } = setUp(dogaItem(NOTHING_ON_COVER));
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Sessa");
      await writeReview(user, "Warm.");
      await reviewsSettled(store);
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await save(user);

      await waitFor(() => expect(reread.calls.count).toBe(1));
      expect(screen.getByText(REVIEW_COPY.record.coverNone)).toBeInTheDocument();
      expect(screen.queryByText(REVIEW_COPY.record.coverReplaces)).not.toBeInTheDocument();

      reread.release();
      await reread.answered;
      await reviewsSettled(store);
    });

    it("keeps the form's line for the state after a failed ticked save when the cover then changes by another write", async () => {
      const { box } = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41)]);
      server.use(
        http.post(SAVE_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 })),
        acceptingReview(box),
      );
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await open(user);
      await fillAuthor(user, "Sessa");
      await writeReview(user, "Warm.");
      const choose = await screen.findByRole("button", { name: "Use this review" });
      await reviewsSettled(store);
      await save(user);
      expect((await screen.findByRole("alert")).textContent).toBe(REVIEW_COPY.record.couldNotRecord);
      await waitFor(() => expect(choose).toBeEnabled());
      expect(screen.getByText(REVIEW_COPY.record.coverNone)).toBeInTheDocument();
      const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(choose);

      await waitFor(() => expect(reread.calls.count).toBe(1));
      expect(screen.getByText(REVIEW_COPY.record.coverReplaces)).toBeInTheDocument();
      expect(screen.queryByText(REVIEW_COPY.record.coverNone)).not.toBeInTheDocument();

      reread.release();
      await reread.answered;
      await reviewsSettled(store);
    });

    describe("when the rereads after the save fail", () => {
      const cached = (store: ReturnType<typeof renderScreen>["store"]) => intakeApi.endpoints.getIntakeItem.select(ITEM_ID)(store.getState()).data;

      it("puts a ticked save's review on the cover, so the page keeps the cover question and is not blanked", async () => {
        const { box, reviews } = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41, { author: "Stereolab" })]);
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await open(user);
        await fillAuthor(user, "Cat Power");
        await writeReview(user, "Warm.");
        await screen.findByRole("button", { name: "Use this review" });
        await reviewsSettled(store);
        box.fail = true;
        reviews.fail = true;

        await save(user);

        expect(await screen.findByRole("status")).toHaveTextContent("Recorded.");
        await reviewsSettled(store);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        const cover = screen.getByRole("heading", { name: "The review on the cover" }).closest("section")!;
        expect(within(cover).getByText("Warm.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Use this review instead" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Use this review" })).not.toBeInTheDocument();
      });

      it("leaves the cover alone for an unticked save, whose review is a draft until its submit", async () => {
        const { box, reviews } = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41, { author: "Stereolab" })]);
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await open(user);
        await fillAuthor(user, "Cat Power");
        await writeReview(user, "Warm.");
        await user.click(screen.getByRole("checkbox", { name: REVIEW_COPY.record.useAsCover }));
        await screen.findByRole("button", { name: "Use this review" });
        await reviewsSettled(store);
        box.fail = true;
        reviews.fail = true;

        await save(user);

        expect(await screen.findByRole("status")).toHaveTextContent("Recorded.");
        await reviewsSettled(store);
        expect(cached(store)?.accepted_review_id).toBeNull();
        expect(screen.getByText(REVIEW_COPY.intakeItem.noCover)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Use this review" })).toBeEnabled();
      });

      it("reads the cover off the review the server answers, not off the request, so a create that sends no accept and gets a draft puts nothing on the cover", async () => {
        setUp(dogaItem(NOTHING_ON_COVER), [submitted(41)]);
        server.use(http.post(SAVE_URL, () => HttpResponse.json(draft(NEW_ID), { status: 201 })));
        const { store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await screen.findByRole("button", { name: "Use this review" });
        await reviewsSettled(store);

        await store.dispatch(reviewApi.endpoints.createReview.initiate({ intake_item_id: ITEM_ID, author: "Cat Power", medium: "typed" })).unwrap();

        expect(cached(store)?.accepted_review_id).toBeNull();
        expect(reviewApi.endpoints.getItemReviews.select(ITEM_ID)(store.getState()).data?.map((r) => r.id)).toEqual([41]);
      });
    });

    describe("the page's hold, counted per write", () => {
      const NEW = { author: "Sessa" };
      const fillAndTick = async (user: User, unticked: boolean) => {
        await open(user);
        await fillAuthor(user, NEW.author);
        await writeReview(user, "Warm.");
        if (unticked) await user.click(screen.getByRole("checkbox", { name: REVIEW_COPY.record.useAsCover }));
      };
      const useButtons = () => screen.queryAllByRole("button", { name: /^Use this review/ });

      it("holds every review button, worded as no replacement, while an unticked save's create is in flight", async () => {
        setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
        const write = holdResponse("post", SAVE_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 }));
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await fillAndTick(user, true);
        await reviewsSettled(store);

        await save(user);

        await waitFor(() => expect(write.calls.count).toBe(1));
        expect(guarded()).toHaveLength(4);
        guarded().forEach((b) => expect(b).toBeDisabled());
        expect(useButtons().map((b) => b.textContent)).toEqual(["Use this review", "Use this review"]);

        write.release();
        await write.answered;
        await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
      });

      it("holds every review button, worded as no replacement, while an unticked save's reread is outstanding", async () => {
        const { box } = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await fillAndTick(user, true);
        await reviewsSettled(store);
        const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

        await save(user);

        await waitFor(() => expect(reread.calls.count).toBe(1));
        // The two other reviews and the one this save recorded.
        expect(guarded()).toHaveLength(6);
        guarded().forEach((b) => expect(b).toBeDisabled());
        expect(useButtons().map((b) => b.textContent)).toEqual(["Use this review", "Use this review", "Use this review"]);

        reread.release();
        await reread.answered;
        await reviewsSettled(store);
        await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
      });

      it("still holds the page for the next write after a Use this review has succeeded and reread", async () => {
        const { box } = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
        server.use(acceptingReview(box));
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        const [first] = await screen.findAllByRole("button", { name: "Use this review" });
        await reviewsSettled(store);
        await user.click(first);
        await waitFor(() => expect(screen.getByRole("button", { name: "Use this review instead" })).toBeEnabled());
        await reviewsSettled(store);
        const second = holdResponse("post", SAVE_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 }));
        await fillAndTick(user, false);

        await save(user);

        await waitFor(() => expect(second.calls.count).toBe(1));
        expect(guarded().length).toBeGreaterThan(0);
        guarded().forEach((b) => expect(b).toBeDisabled());

        second.release();
        await second.answered;
        await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
      });

      // The form's cover line reads the cover alone: only a write that is putting a review on the cover changes it.
      const withCoverLine = async (hold: (user: User) => Promise<{ release: () => void; answered: Promise<unknown> }>, line: "none" | "replaces") => {
        const { box } = setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42, { author: "Cat Power" })]);
        server.use(acceptingReview(box), http.delete(`${TEST_BACKEND_URL}/reviews/:id`, () => new HttpResponse(null, { status: 204 })));
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await reviewsSettled(store);
        const held = await hold(user);

        expect(screen.getByRole("checkbox", { name: REVIEW_COPY.record.useAsCover })).toBeChecked();
        expect(screen.queryByText(REVIEW_COPY.record.coverReplaces) !== null).toBe(line === "replaces");
        expect(screen.queryByText(REVIEW_COPY.record.coverNone) !== null).toBe(line === "none");

        held.release();
        await held.answered;
        await reviewsSettled(store);
      };

      it("does not say the save replaces the cover while a Delete review's reread is outstanding", () =>
        withCoverLine(async (user) => {
          await open(user);
          await user.click(screen.getByRole("button", { name: "Delete review by Cat Power" }));
          const dialog = within(await screen.findByRole("alertdialog"));
          const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(dogaItem(NOTHING_ON_COVER)));
          await user.click(dialog.getByRole("button", { name: "Delete" }));
          await waitFor(() => expect(reread.calls.count).toBeGreaterThan(0));
          return reread;
        }, "none"));

      it("does not say the save replaces the cover while an unticked save's create is outstanding", () =>
        withCoverLine(async (user) => {
          const create = holdResponse("post", SAVE_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 }));
          await fillAndTick(user, true);
          await save(user);
          await waitFor(() => expect(create.calls.count).toBe(1));
          await user.click(screen.getByRole("button", { name: "Record a review" }));
          await open(user);
          return create;
        }, "none"));

      it("says the save replaces the cover while a Use this review's reread is outstanding", () =>
        withCoverLine(async (user) => {
          await open(user);
          const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json({ accepted_review_id: 41 }));
          await user.click(screen.getAllByRole("button", { name: "Use this review" })[0]);
          await waitFor(() => expect(reread.calls.count).toBe(1));
          return reread;
        }, "replaces"));

      // A Delete review that succeeds takes its own handle; a Use this review pressed before it is a second write on the page at once.
      const overlap = async (acceptRespond: () => Response) => {
        setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42, { author: "Cat Power" })]);
        server.use(http.delete(`${TEST_BACKEND_URL}/reviews/:id`, () => new HttpResponse(null, { status: 204 })));
        const accept = holdResponse("post", ACCEPT_URL, acceptRespond);
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        const [first] = await screen.findAllByRole("button", { name: "Use this review" });
        await reviewsSettled(store);
        await user.click(screen.getByRole("button", { name: "Delete review by Cat Power" }));
        const dialog = within(await screen.findByRole("alertdialog"));
        const reread = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json({ ...dogaItem(NOTHING_ON_COVER) }));
        fireEvent.click(first);
        await waitFor(() => expect(accept.calls.count).toBe(1));
        await user.click(dialog.getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(reread.calls.count).toBeGreaterThan(0));
        return { accept, reread, store };
      };

      it("keeps the page held through a failed accept until another write's reread settles", async () => {
        const { accept, reread } = await overlap(() => HttpResponse.json({ message: "boom" }, { status: 500 }));

        accept.release();
        await accept.answered;
        expect((await screen.findByRole("status")).textContent).toBe("Couldn't do that. Please try again.");
        useButtons().forEach((b) => expect(b).toBeDisabled());

        reread.release();
        await reread.answered;
        await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
      });

      it("keeps the page held through another write's reread until an accept in flight has settled", async () => {
        const { accept, reread } = await overlap(() => HttpResponse.json({ ...dogaItem({ accepted_review_id: 41 }) }));

        reread.release();
        await reread.answered;
        await renderedFrame();
        expect(useButtons().length).toBeGreaterThan(0);
        useButtons().forEach((b) => expect(b).toBeDisabled());

        accept.release();
        await accept.answered;
        await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
      });

      it("releases a ticked save's hold when its create fails after the form has closed", async () => {
        setUp(dogaItem(NOTHING_ON_COVER), [submitted(41), submitted(42)]);
        const write = holdResponse("post", SAVE_URL, () => HttpResponse.json({ message: "boom" }, { status: 500 }));
        const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
        await fillAndTick(user, false);
        await reviewsSettled(store);
        await save(user);
        await waitFor(() => expect(write.calls.count).toBe(1));
        guarded().forEach((b) => expect(b).toBeDisabled());

        await user.click(screen.getByRole("button", { name: "Record a review" }));
        expect(screen.queryByRole("textbox", { name: "Author" })).not.toBeInTheDocument();
        write.release();
        await write.answered;

        await waitFor(() => guarded().forEach((b) => expect(b).toBeEnabled()));
        await open(user);
        expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      });
    });
  });
});
