import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, fccNote, holdResponse, intakeItem, renderWithProviders, review, reviewRevision, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { fakeRotationCardsEndpoints } from "@/tests/fakes/rotation";
import { fakeLibraryFilingsEndpoint, filingConflictResponse } from "@/tests/fakes/libraryFilings";
import { Authorization } from "@/lib/features/admin/types";
import { reviewsApi } from "@/lib/features/reviews/api";

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

let authority = Authorization.MD;
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "md-me", authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

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
  await new Promise((r) => setTimeout(r, 300));
  const artist = await screen.findByDisplayValue("Juana Molina");
  await user.clear(artist);
  await user.type(artist, "Juana");
  await user.click(await screen.findByRole("option", { name: "Juana Molina" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-pressed", "true"));
}

describe("IntakeItemScreen", () => {
  beforeEach(() => {
    authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    listsAndCards();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["printSlip", REVIEW_COPY.intakeItem.printSlip, "Print the slip"],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it.each([
    ["off", "", Authorization.MD],
    ["staff-only for a DJ", "staff", Authorization.DJ],
  ])("renders nothing when the flag is %s", async (_label, flag, who) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    authority = who;
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

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByText("Take 40.");
      if (settled) await screen.findByText(settled);
      await waitFor(() => expect(screen.getAllByRole("link", { name: linkName })).toHaveLength(linkCount));
      for (const link of screen.getAllByRole("link", { name: linkName })) {
        expect(link).toHaveAttribute("href", `/dashboard/admin/intake/${ITEM_ID}/slip`);
      }
      if (printed.printed_revision_id === undefined) {
        // A never-printed cover review has revisions to serve but is never asked for them.
        await new Promise((r) => setTimeout(r, 50));
        expect(requested).not.toHaveBeenCalled();
        expect(screen.getAllByRole("link", { name: linkName })).toHaveLength(linkCount);
      }
    });

    it("offers no Print this review link on the record's page, which has its own Print the slip", async () => {
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40, { medium: "typed", album_id: null })] } });

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByRole("link", { name: "Print the slip" });
      // Let the music director gate resolve before asserting the link is absent.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("link", { name: "Print this review" })).not.toBeInTheDocument();
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

    it("says the chosen review was removed, and reloads the record", async () => {
      const box = setUp();
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () => {
          box.item = dogaItem({ accepted_review_id: null });
          return HttpResponse.json({ message: "server words", reason: "not_reviewed" }, { status: 409 });
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      const readsBefore = box.reads;
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      expect(await screen.findByText("This record has no review chosen for the cover, so it can't be filed yet.")).toBeInTheDocument();
      expect(box.reads).toBe(readsBefore + 1);
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
      expect(await screen.findByText("Choose a review for the cover before filing this record.")).toBeInTheDocument();
    });

    it("shows the approved notice when someone filed it first, and reloads the record", async () => {
      const box = setUp();
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () => {
          box.item = dogaItem({ state: "filed", effective_state: "filed" });
          return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      const readsBefore = box.reads;
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      const notice = await screen.findByRole("status");
      expect(notice.textContent).toBe("This record has already been filed. The page has been reloaded.");
      expect(box.reads).toBe(readsBefore + 1);
      expect(screen.queryByRole("combobox", { name: "Genre" })).not.toBeInTheDocument();
    });

    const REFUSALS = [
      ["state_changed", "This record has already been filed. The page has been reloaded."],
      ["not_reviewed", "This record has no review chosen for the cover, so it can't be filed yet."],
    ] as const;

    it.each(REFUSALS)("shows the %s notice only once the record has reloaded", async (reason, line) => {
      const box = setUp();
      let release!: () => void;
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () => {
          box.hold = new Promise<void>((resolve) => {
            release = resolve;
          });
          return HttpResponse.json({ message: "server words", reason }, { status: 409 });
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      const readsBefore = box.reads;
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(box.reads).toBe(readsBefore + 1));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      release();
      expect((await screen.findByRole("status")).textContent).toBe(line);
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

    it.each(REFUSALS)("re-reads the item's reviews as well as the item after a %s refusal", async (reason) => {
      setUp();
      let reviewReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("intake_item_id") === String(ITEM_ID)) reviewReads += 1;
          return HttpResponse.json([submitted(40)]);
        }),
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () =>
          HttpResponse.json({ message: "server words", reason }, { status: 409 }),
        ),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      const readsBefore = reviewReads;
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await screen.findByRole("status");
      expect(reviewReads).toBe(readsBefore + 1);
    });

    it("re-reads the cover review by id after a refusal when the item's own reviews lack it", async () => {
      const item = dogaItem({ accepted_review_id: 90 });
      fakeReviewsEndpoints({ records: [item], forItem: { [ITEM_ID]: [submitted(40)] }, reviews: [submitted(90, { intake_item_id: 99 })] });
      serveItem(item);
      let coverReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews/90`, () => {
          coverReads += 1;
          return HttpResponse.json(submitted(90, { intake_item_id: 99 }));
        }),
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () =>
          HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
        ),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      expect(coverReads).toBe(1);
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await screen.findByRole("status");
      expect(coverReads).toBe(2);
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

    it("refetches a mounted catalog query and a mounted rotation list once each after a successful file", async () => {
      setUp();
      let catalogReads = 0;
      let rotationReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library`, () => {
          catalogReads += 1;
          return HttpResponse.json([]);
        }),
        http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
          rotationReads += 1;
          return HttpResponse.json([]);
        }),
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () =>
          HttpResponse.json(dogaItem({ state: "filed", effective_state: "filed" })),
        ),
      );
      function Mounted() {
        useSearchCatalogQuery({ artist_name: "Juana Molina", album_title: undefined, n: 5 });
        useGetRotationListQuery();
        return <IntakeItemScreen id={ITEM_ID} />;
      }
      const { user } = renderScreen(<Mounted />);

      await readyBench(user);
      await waitFor(() => expect([catalogReads, rotationReads]).toEqual([1, 1]));
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect([catalogReads, rotationReads]).toEqual([2, 2]));
    });
  });

  describe("filing onto a release already in the library", () => {
    const RELEASE_ROW = { id: 5, album_title: "DOGA", artist_name: "Juana Molina", label: "Sonamos", genre_name: "Rock", format_name: "cd", code_letters: "MO", code_artist_number: 1, code_number: 1, add_date: "2026-01-01", plays: 0 };
    const VINYL_ROW = { ...RELEASE_ROW, id: 6, format_name: "vinyl", code_number: 2 };
    const ROW_NAME = "Juana Molina · DOGA · CD";
    const FILE_URL = `${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`;

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

    const REFUSALS = [
      ["state_changed", "This record has already been filed. The page has been reloaded."],
      ["not_reviewed", "This record has no review chosen for the cover, so it can't be filed yet."],
    ] as const;

    it.each(REFUSALS)("shows the %s line and rereads the item", async (reason, line) => {
      const { box } = setUp();
      server.use(http.post(FILE_URL, () => HttpResponse.json({ message: "server words", reason }, { status: 409 })));
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await screen.findByText("Already in the library?");
      const readsBefore = box.reads;

      await pickDoga(user);

      expect((await screen.findByRole("status")).textContent).toBe(line);
      expect(box.reads).toBe(readsBefore + 1);
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
    });

    it.each(REFUSALS)("shows the %s line only once the record has reloaded", async (reason, line) => {
      const { box } = setUp();
      let release!: () => void;
      server.use(
        http.post(FILE_URL, () => {
          box.hold = new Promise<void>((resolve) => {
            release = resolve;
          });
          return HttpResponse.json({ message: "server words", reason }, { status: 409 });
        }),
      );
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await screen.findByText("Already in the library?");
      const readsBefore = box.reads;

      await pickDoga(user);

      await waitFor(() => expect(box.reads).toBe(readsBefore + 1));
      await new Promise((resolve) => setTimeout(resolve, 50));
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
      await screen.findByText("Already in the library?");
      await waitFor(() => expect(reviewReads).toBe(1));

      await pickDoga(user);

      await screen.findByRole("status");
      expect(reviewReads).toBe(2);
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

    it("refetches a mounted catalog query, rotation list, release reviews and FCC notes once each after a successful file, and the reviews and notes not at all after a refusal", async () => {
      setUp();
      let catalogReads = 0;
      let rotationReads = 0;
      let releaseReviewReads = 0;
      let fccReads = 0;
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
        useSearchCatalogQuery({ artist_name: "Stereolab", album_title: undefined, n: 5 });
        useGetRotationListQuery();
        useGetReviewsForReleaseQuery(5);
        useGetFccNotesQuery({ album_id: 5 });
        return <IntakeItemScreen id={ITEM_ID} />;
      }
      const { user } = renderScreen(<Mounted />);
      await waitFor(() => expect([catalogReads, rotationReads, releaseReviewReads, fccReads]).toEqual([1, 1, 1, 1]));

      await pick(user);
      await user.click(screen.getByRole("button", { name: "File it as this one" }));
      await screen.findByRole("status");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect([catalogReads, rotationReads, releaseReviewReads, fccReads]).toEqual([1, 1, 1, 1]);

      refuse = false;
      await user.click(screen.getByRole("button", { name: "File it as this one" }));

      await waitFor(() => expect([catalogReads, rotationReads, releaseReviewReads, fccReads]).toEqual([2, 2, 2, 2]));
    });
  });

  describe("when the page is gone before the filing answers", () => {
    const RELEASE_ROW = { id: 5, album_title: "DOGA", artist_name: "Juana Molina", label: "Sonamos", genre_name: "Rock", format_name: "cd", code_letters: "MO", code_artist_number: 1, code_number: 1, add_date: "2026-01-01", plays: 0 };

    it.each([
      [
        "the new-release bench",
        async (user: User) => {
          await readyBench(user);
          await user.click(screen.getByRole("button", { name: "Add to rotation" }));
        },
      ],
      [
        "the existing-release picker",
        async (user: User) => {
          const box = await screen.findByRole("searchbox", { name: "Search the library" });
          await user.type(box, "Juana");
          await user.click(screen.getByRole("button", { name: "Search" }));
          await user.click(await screen.findByRole("button", { name: "Juana Molina · DOGA · CD" }));
          await user.click(screen.getByRole("button", { name: "File it as this one" }));
        },
      ],
    ])("rereads the item and its reviews once, and throws nothing, when %s is refused", async (_arm, file) => {
      fakeReviewsEndpoints({ records: [dogaItem()], forItem: { [ITEM_ID]: [submitted(40)] } });
      let reviewReads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library`, () => HttpResponse.json([RELEASE_ROW])),
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("intake_item_id") === String(ITEM_ID)) reviewReads += 1;
          return HttpResponse.json([submitted(40)]);
        }),
      );
      const { calls, release, answered } = holdResponse("post", `${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, () =>
        HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
      );
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const { user, unmount } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);
      await waitFor(() => expect(reviewReads).toBe(1));

      await file(user);
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
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));

      await waitFor(() => expect(box.reads).toBeGreaterThan(1));
      await new Promise((resolve) => setTimeout(resolve, 50));
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
      await new Promise((resolve) => setTimeout(resolve, 50));

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

      renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await screen.findByText("Take 40.");
      if (expected) {
        expect(await screen.findByText(expected)).toBeInTheDocument();
      } else {
        await new Promise((r) => setTimeout(r, 50));
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
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
      expect(await screen.findByText("Deleted, with the reviews and drafts by Cat Power.")).toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 100));

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
      const { user } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      const readsBefore = reads;
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText("Couldn't delete this record. Please try again.")).toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(reads).toBe(readsBefore);
    });
  });
});
