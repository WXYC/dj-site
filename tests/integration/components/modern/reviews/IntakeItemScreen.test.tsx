import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, fccNote, holdResponse, intakeItem, pendingCount, renderedFrame, renderWithProviders, review, reviewRevision, reviewsSettled, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { fakeRotationCardsEndpoints } from "@/tests/fakes/rotation";
import { fakeLibraryFilingsEndpoint, filingConflictResponse } from "@/tests/fakes/libraryFilings";
import { Authorization } from "@/lib/features/admin/types";
import { reviewsApi } from "@/lib/features/reviews/api";
import { reviewApi } from "@/lib/features/reviews/reviewApi";

// The bench's artist field is gated by AuthorizedView, which resolves the music director tier from the session.
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
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
import type { Review } from "@wxyc/shared";
import { CssVarsProvider } from "@mui/joy/styles";
import modernTheme from "@/lib/features/experiences/modern/theme";
import IntakeItemScreen from "@/src/components/experiences/modern/reviews/IntakeItemScreen";
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

const FILED_ITEM_PATH = `${TEST_BACKEND_URL}/intake/${ITEM_ID}`;

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

/** Gets the prefilled bench to a submittable state, with the one choice the item cannot supply. */
async function readyBench(user: User) {
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

      // The citation screen (WXYC/dj-site#1766) is not built; the choice arrives as the item's next answer.
      box.item = dogaItem({ format_id: 1, accepted_review_id: 90, cited_album_id: 7 });
      act(() => {
        store.dispatch(reviewsApi.util.invalidateTags(["Intake"]));
      });

      expect(await screen.findByText("From the cited release.")).toBeInTheDocument();
      expect(screen.queryByText("Choose a review for the cover before filing this record.")).not.toBeInTheDocument();
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
  });

  describe("using a review", () => {
    const ACCEPT_URL = `${TEST_BACKEND_URL}/intake/${ITEM_ID}/accept-review`;
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

    /** Counts the reads of this item's reviews, answering each with `list`. */
    const countItemReviewReads = (list: Review[]) => {
      const reads = { count: 0 };
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("intake_item_id") === String(ITEM_ID)) reads.count += 1;
          return HttpResponse.json(list);
        }),
      );
      return reads;
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
      ["a holder who is not the author", { author_user_id: "dj-pat" }, true],
      ["the author as the holder", { author_user_id: "dj-sam" }, false],
    ])("says the record is still out for %s -> %s", async (_label, authorOverrides, shown) => {
      const item = dogaItem({ state: "checked_out", effective_state: "checked_out", checked_out_by: "dj-sam", checked_out_by_name: "Sam", checked_out_at: "2026-10-01T12:00:00Z" });
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
      const reviewReads = countItemReviewReads([submitted(41)]);
      refuseWith400();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const button = await screen.findByRole("button", { name: "Use this review" });
      await waitFor(() => expect(reviewReads.count).toBe(1));
      const itemReads = box.reads;

      await user.click(button);

      expect((await screen.findByRole("status")).textContent).toBe(REVIEW_COPY.intakeItem.reviewGone);
      await reviewsSettled(store);
      expect(box.reads).toBe(itemReads + 1);
      expect(reviewReads.count).toBe(2);
      expect(screen.queryByText(SERVER_WORDS)).not.toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalledWith(SERVER_WORDS);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("shows no line while the reload is outstanding", async () => {
      const box = setUp();
      const reviewReads = countItemReviewReads([submitted(41)]);
      refuseWith400();
      const { user, store } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      const button = await screen.findByRole("button", { name: "Use this review" });
      await waitFor(() => expect(reviewReads.count).toBe(1));
      const reload = holdResponse("get", FILED_ITEM_PATH, () => HttpResponse.json(box.item));

      await user.click(button);

      // Every other read the reload starts has begun, and the held item read is the only request left.
      await waitFor(() => expect(reload.calls.count).toBe(1));
      await waitFor(() => expect(reviewReads.count).toBe(2));
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
      let reviewReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("intake_item_id") === String(ITEM_ID)) reviewReads += 1;
          return HttpResponse.json([submitted(40)]);
        }),
        http.post(FILE_URL, () => HttpResponse.json({ message: "server words", reason }, { status: 409 })),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await waitFor(() => expect(reviewReads).toBe(1));
      await ready(user);
      const readsBefore = reviewReads;
      await submit(user);

      await screen.findByRole("status");
      expect(reviewReads).toBe(readsBefore + 1);
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
      let reviewReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("intake_item_id") === String(ITEM_ID)) reviewReads += 1;
          return HttpResponse.json([submitted(40)]);
        }),
      );
      const { calls, release, answered } = holdResponse("post", FILE_URL, () =>
        HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
      );
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const { user, unmount } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await waitFor(() => expect(reviewReads).toBe(1));

      await ready(user);
      await submit(user);
      await waitFor(() => expect(calls.count).toBe(1));
      const reviewReadsBefore = reviewReads;
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
      expect(reviewReads).toBe(reviewReadsBefore + 1);
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
  describe("deleting one review", () => {
    const REVIEW_URL = (id: number) => `${TEST_BACKEND_URL}/reviews/${id}`;
    const COVER_LINE = REVIEW_COPY.intakeItem.deleteCoverFiled;
    const HOLDER_ITEM = { state: "checked_out", effective_state: "checked_out", checked_out_by: "dj-sessa", checked_out_by_name: "Sessa", checked_out_at: "2026-10-02T12:00:00Z" };
    const REMOVED_ITEM = { ...HOLDER_ITEM, checked_out_by: null, checked_out_by_name: null };
    const SHELF_ITEM = { state: "pool", effective_state: "pool", checked_out_by: null, checked_out_by_name: null, checked_out_at: null };

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

    it("shows the failure line in the notice slot, and it survives the reload", async () => {
      const { box } = setUp();
      server.use(http.delete(REVIEW_URL(41), () => HttpResponse.json({ message: "boom" }, { status: 500 })));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      const dialog = await open(user, "Delete review by Cat Power");
      await user.click(dialog.getByRole("button", { name: "Delete" }));

      expect(await screen.findByRole("status")).toHaveTextContent("Couldn't delete the review. Please try again.");
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByRole("status")).toHaveTextContent("Couldn't delete the review. Please try again.");
      expect(box.reads).toBeGreaterThan(1);
    });
  });

  describe("deleting the record", () => {
    const TITLE = "Delete Juana Molina — DOGA from the review shelf?";

    /**
     * Serves the item with its reviews and draft authors, and records every DELETE, every draft-content read, and
     * every read of the item or its reviews that goes out after the DELETE (the record is gone then, so they 404).
     */
    function serveDeletable(reviewAuthors: (string | Review)[], draftAuthors: string[] | undefined, deleted: string[] = []) {
      let gone = false;
      // `markGone` is for a spec that answers the DELETE itself (held), so reads after it still count as after.
      const seen = { deletes: 0, draftReads: 0, itemReadsAfter: 0, reviewReadsAfter: 0, markGone: () => { gone = true; } };
      const reviews = reviewAuthors.map((entry, i) => (typeof entry === "string" ? submitted(40 + i, { author: entry }) : entry));
      fakeReviewsEndpoints({ records: [dogaItem({ draft_authors: draftAuthors, accepted_review_id: null })] });
      server.use(
        http.get(FILED_ITEM_PATH, () => {
          if (!gone) return HttpResponse.json(dogaItem({ draft_authors: draftAuthors, accepted_review_id: null }));
          seen.itemReadsAfter += 1;
          return HttpResponse.json({ message: "Intake item not found" }, { status: 404 });
        }),
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("intake_item_id") !== String(ITEM_ID)) return HttpResponse.json([]);
          if (!gone) return HttpResponse.json(reviews);
          seen.reviewReadsAfter += 1;
          return HttpResponse.json({ message: "Intake item not found" }, { status: 404 });
        }),
        http.delete(FILED_ITEM_PATH, () => {
          seen.deletes += 1;
          gone = true;
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
    const HELD_BY_SAM = { checked_out_by: "dj-sam", checked_out_by_name: "DJ Sam", checked_out_at: "2026-09-20T12:00:00Z" };
    const HELD_BY_JESS = { checked_out_by: "dj-jess", checked_out_by_name: "Jessica Pratt", checked_out_at: "2026-09-20T12:00:00Z" };
    const REMOVED_HOLDER = { checked_out_by: null, checked_out_by_name: null, checked_out_at: "2026-09-20T12:00:00Z" };

    const waiting = (id: number, overrides = {}) => submitted(id, { author: "Jessica Pratt", author_user_id: "dj-jess", ...overrides });
    const otherReviews = async () => (await screen.findByRole("heading", { name: "Other reviews" })).closest("section")!;

    it.each([
      ["the author is the DJ who has the record", HELD_BY_JESS, "From Jessica Pratt, who has this record."],
      ["someone else wrote it and a DJ has the record", HELD_BY_SAM, "From Jessica Pratt. The record is with DJ Sam."],
      [
        "someone else wrote it and a request is open",
        { state: "requested", effective_state: "requested", requested_dj_id: "dj-pat", requested_dj_name: "DJ Pat" },
        "From Jessica Pratt. The record is being held for DJ Pat.",
      ],
      ["someone else wrote it and the holder's account was removed", REMOVED_HOLDER, "From Jessica Pratt. The record is checked out; holder removed."],
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
      fakeReviewsEndpoints({ records: [dogaItem(HELD_BY_JESS)], forItem: { [ITEM_ID]: [submitted(40), waiting(41, { author_user_id: null })] } });

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
        records: [dogaItem(HELD_BY_SAM)],
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
});
