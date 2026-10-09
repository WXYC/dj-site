import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, fccNote, intakeItem, renderWithProviders, review, server, TEST_BACKEND_URL } from "@/tests/helpers";
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

import { CssVarsProvider } from "@mui/joy/styles";
import modernTheme from "@/lib/features/experiences/modern/theme";
import IntakeItemScreen from "@/src/components/experiences/modern/reviews/IntakeItemScreen";
import { useGetRotationListQuery } from "@/lib/features/rotation/api";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";

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

    it("reloads the item and its reviews, and throws nothing, when the page unmounts while the filing is in flight and is then refused", async () => {
      const box = setUp();
      let reviewReads = 0;
      let posted = false;
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
          if (new URL(request.url).searchParams.get("intake_item_id") === String(ITEM_ID)) reviewReads += 1;
          return HttpResponse.json([submitted(40)]);
        }),
        http.post(`${TEST_BACKEND_URL}/intake/${ITEM_ID}/file`, async () => {
          posted = true;
          await held;
          return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        }),
      );
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const { user, unmount } = renderScreen(<IntakeItemScreen id={ITEM_ID} />);

      await readyBench(user);
      const itemReadsBefore = box.reads;
      const reviewReadsBefore = reviewReads;
      await user.click(screen.getByRole("button", { name: "Add to rotation" }));
      await waitFor(() => expect(posted).toBe(true));

      unmount();
      release();
      // A hook refetch() throws here before any request goes out, so the reads below never happen.
      await waitFor(() => expect(box.reads).toBe(itemReadsBefore + 1));
      await waitFor(() => expect(reviewReads).toBe(reviewReadsBefore + 1));
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errors).not.toHaveBeenCalled();
      expect(screen.queryByText(/Filing failed/)).not.toBeInTheDocument();
      errors.mockRestore();
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
});
