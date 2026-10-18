import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { CDR_FORMAT, digitalItem, fakeReviewsEndpoints, fccNote, heldBy, holdResponse, intakeItem, outline, pendingCount, removedHolder, renderedFrame, renderWithProviders, requestedFor, returned, returnedByMusicDirector, review, reviewsSettled, server, TEST_BACKEND_URL } from "@/tests/helpers";
import type { IntakeItem } from "@wxyc/shared";
import { setupListeners } from "@reduxjs/toolkit/query";
import { makeStore } from "@/lib/store";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

// The chips write the stage with `history.replaceState`, which the App Router syncs to `useSearchParams`; the spy in `beforeEach` does the same sync, so a click on a chip changes the list.
const url = vi.hoisted(() => ({ search: "", listeners: new Set<() => void>() }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  const subscribe = (listener: () => void) => {
    url.listeners.add(listener);
    return () => url.listeners.delete(listener);
  };
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() }, { search: () => useSyncExternalStore(subscribe, () => url.search) });
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { toast } from "sonner";
import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import IntakeLogForm from "@/src/components/experiences/modern/reviews/IntakeLogForm";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const moonPix = (overrides = {}) =>
  intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", ...overrides });

const waiting = (id: number, overrides = {}) =>
  moonPix({ id, state: "checked_out", effective_state: "checked_out", ...heldBy("dj-1", "DJ Sam", null), submitted_review_count: 1, accepted_review_id: null, ...overrides });

/**
 * A stage's list, once its chip is chosen. `name` is the stage's label, with the count the chip should carry in parentheses when the spec waits on it: "Reviewed (2)" waits for the chip "Reviewed, 2".
 */
const justNow = new Date().toISOString();
const STAGE_LABELS = [REVIEW_COPY.intake.onShelf, REVIEW_COPY.intake.requested, REVIEW_COPY.intake.beingReviewed, REVIEW_COPY.intake.waiting, REVIEW_COPY.intake.reviewed, REVIEW_COPY.intake.filed];
const showStage = (stage: string) => {
  url.search = `?stage=${stage}`;
};
const lane = async (name: string) => {
  const [, label, count] = /^(.*?)(?: \((\d+)\))?$/.exec(name)!;
  const chip = await screen.findByRole("tab", { name: count ? `${label}, ${count}` : new RegExp(`^${label},`) });
  if (chip.getAttribute("aria-selected") !== "true") {
    fireEvent.click(chip);
  }
  return screen.findByRole("tabpanel", { name: label });
};

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  url.search = "";
  vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, target) => {
    url.search = new URL(String(target), "http://localhost").search;
    url.listeners.forEach((listener) => listener());
  });
});
afterEach(() => {
  vi.mocked(window.history.replaceState).mockRestore();
});

describe("IntakeLanes", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("puts FCC notes to confirm above the Recent passes band and the chips", async () => {
    fakeReviewsEndpoints({
      open: [moonPix({ id: 5, passes: [{ dj_name: "Sam", passed_at: "2026-10-01T10:00:00Z" }] })],
      fccNotesToConfirm: [fccNote({ id: 1, intake_item_id: 5 })],
    });

    renderWithProviders(<IntakeLanes />);

    const section = await screen.findByRole("region", { name: "FCC notes to confirm (1)" });
    expect(within(section).getByRole("heading", { level: 3, name: "FCC notes to confirm (1)" })).toBeInTheDocument();
    const band = screen.getByRole("region", { name: "Recent passes" });
    const chips = screen.getByRole("tablist");
    expect(section.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(band.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ["notes to confirm and recent passes", { open: [moonPix({ id: 5, passes: [{ dj_name: "Sam", passed_at: "2026-10-01T10:00:00Z" }] })], fccNotesToConfirm: [fccNote({ id: 1, intake_item_id: 5 })] }, ["h3 FCC notes to confirm (1)", "h3 Recent passes", "h3 Requested"]],
    ["nothing on it", { open: [] }, ["h3 Requested"]],
  ])("heads every section, and the chosen stage's list, at h3 under the page's own h2 with %s", async (_case, endpoints, expected) => {
    fakeReviewsEndpoints(endpoints);
    renderWithProviders(<IntakeLanes />);

    await lane(REVIEW_COPY.intake.requested);
    await waitFor(() => expect(outline()).toEqual(expected));
  });

  it.each([
    ["off", "", Authorization.MD],
    ["staff-only for a DJ", "staff", Authorization.DJ],
  ])("renders nothing when the flag is %s", async (_label, flag, who) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = who;
    fakeReviewsEndpoints({ open: [moonPix()] });

    const { container } = renderWithProviders(<IntakeLanes />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["heldFor", REVIEW_COPY.intake.heldFor, "Held for"],
    ["cancelRequest", REVIEW_COPY.intake.cancelRequest, "Cancel request"],
    ["more", REVIEW_COPY.intake.more(2), "+2 more"],
    // Row 2 of the 2026-10-16 copy round (WXYC/Backend-Service#3382).
    ["shelfLine", REVIEW_COPY.screen.shelfLine, "Records waiting for a reviewer. Pick one to review."],
    // Rows 42 and 43 of the 2026-10-16 copy round (WXYC/Backend-Service#3382).
    ["returnQuestion", REVIEW_COPY.intake.returnQuestion("{artist}", "{album}"), "Return {artist}, {album}, to the review shelf?"],
    ["returnBody", REVIEW_COPY.intake.returnBody("{name}"), "{name} will no longer have it, and any DJ can choose to review it."],
    ["returnBringDisc", REVIEW_COPY.intake.returnBringDisc, "Ask them to bring the disc to the music office."],
    ["markReturnedQuestion", REVIEW_COPY.intake.markReturnedQuestion("{artist}", "{album}"), "Mark {artist}, {album} as back in the music office?"],
    ["markReturnedBody", REVIEW_COPY.intake.markReturnedBody("{name}"), "{name} will no longer have it. Their review stays waiting for you to choose."],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it("names each record by its artist, album, label and format, in the lane for its state", async () => {
    fakeReviewsEndpoints({
      open: [
        moonPix({ id: 2, state: "requested", effective_state: "requested", ...requestedFor(null, "DJ Pat") }),
        waiting(3, { album_title: "Dark Side", submitted_review_count: 0 }),
      ],
      reviewed: [moonPix({ id: 4, state: "reviewed", effective_state: "reviewed" })],
      filed: [moonPix({ id: 5, state: "filed", effective_state: "filed", filed_at: justNow })],
    });

    renderWithProviders(<IntakeLanes />);

    const requested = await lane("Requested");
    const expectRecord = async (region: HTMLElement, album: string) => {
      for (const part of ["Cat Power", album, "Matador", "CD"]) {
        expect(await within(region).findByText(part)).toBeInTheDocument();
      }
    };
    await expectRecord(requested, "Moon Pix");
    expect(within(requested).getByText("Held for DJ Pat")).toBeInTheDocument();
    expect(within(requested).getByRole("link", { name: "Cat Power" })).toHaveAttribute("href", "/dashboard/admin/intake/2");
    await expectRecord(await lane("Being reviewed"), "Dark Side");
    await expectRecord(await lane("Reviewed (1)"), "Moon Pix");
    await expectRecord(await lane("Filed"), "Moon Pix");
  });

  it("puts each state's rows in its own lane only, and reads intake exactly once", async () => {
    const reads: string[] = [];
    fakeReviewsEndpoints({
      open: [waiting(3, { album_title: "Out", submitted_review_count: 0 })],
      reviewed: [moonPix({ id: 4, album_title: "Done", state: "reviewed", effective_state: "reviewed" })],
      filed: [moonPix({ id: 5, album_title: "Shelved", state: "filed", effective_state: "filed", filed_at: justNow })],
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        reads.push(new URL(request.url).search);
      }),
    );

    renderWithProviders(<IntakeLanes />);

    const where = { "Being reviewed": "Out", "Reviewed (1)": "Done", Filed: "Shelved" };
    for (const [name, album] of Object.entries(where)) {
      const region = await lane(name);
      for (const other of Object.values(where)) {
        const check = expect(within(region).queryByText(new RegExp(other)));
        if (other === album) check.toBeInTheDocument();
        else check.not.toBeInTheDocument();
      }
    }
    expect(within(await lane("Requested")).queryByRole("link")).not.toBeInTheDocument();
    expect(reads).toEqual([""]);
  });

  it("counts 0 on the Review waiting chip, and says Nothing here., when only open records are served", async () => {
    fakeReviewsEndpoints({ open: [moonPix()] });

    renderWithProviders(<IntakeLanes />);

    expect(await lane("Review waiting (0)")).toHaveTextContent(REVIEW_COPY.intake.empty);
  });

  // A waiting review as the item's reviews read serves it.
  const waitingReview = (id: number, itemId: number, overrides = {}) =>
    review({ id, intake_item_id: itemId, status: "submitted", author: "Jessica Pratt", author_user_id: "dj-jess", add_date: "2026-10-01", ...overrides });

  it.each([
    ["the author is the DJ who has the record", heldBy("dj-jess", "Jessica Pratt", null), "From Jessica Pratt, who has this record."],
    ["someone else wrote it and a DJ has the record", {}, "From Jessica Pratt. The record is with DJ Sam."],
    [
      "someone else wrote it and a request is open",
      { state: "requested", effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat") },
      "From Jessica Pratt. The record is being held for DJ Pat.",
    ],
    [
      "someone else wrote it and a disc with a review waiting is back in the music office",
      { state: "pool", effective_state: "pool" },
      "From Jessica Pratt. The record is back in the music office.",
    ],
    [
      "someone else wrote it and the holder's account was removed",
      removedHolder,
      "From Jessica Pratt. The record is with a removed account.",
    ],
  ])("says who a waiting review is from when %s", async (_label, itemOverrides, line) => {
    const item = waiting(7, itemOverrides);
    fakeReviewsEndpoints({ open: [item], forItem: { "7": [waitingReview(70, 7)] } });

    renderWithProviders(<IntakeLanes />);

    const waitingLane = await lane("Review waiting (1)");
    expect(await within(waitingLane).findByText(line)).toBeInTheDocument();
    expect(within(waitingLane).queryByText(/review$|reviews$|more$/)).not.toBeInTheDocument();
  });

  it("names the newest waiting review and counts the rest as +n more, leaving out drafts", async () => {
    const item = waiting(7, { submitted_review_count: 2 });
    fakeReviewsEndpoints({
      open: [item],
      forItem: {
        "7": [
          waitingReview(70, 7, { author: "Sessa", add_date: "2026-10-01" }),
          waitingReview(71, 7, { author: "Cat Power", add_date: "2026-10-05" }),
          waitingReview(72, 7, { author: "Nilüfer Yanya", status: "draft", add_date: "2026-10-09" }),
        ],
      },
    });

    renderWithProviders(<IntakeLanes />);

    const waitingLane = await lane("Review waiting (1)");
    expect(await within(waitingLane).findByText("From Cat Power. The record is with DJ Sam.")).toBeInTheDocument();
    expect(within(waitingLane).getByText("+1 more")).toBeInTheDocument();
    expect(within(waitingLane).queryByText(/Sessa|Nilüfer/)).not.toBeInTheDocument();
  });

  describe("a Review waiting row before its reviews are read", () => {
    const REVIEWS_URL = `${TEST_BACKEND_URL}/reviews`;

    it.each([
      ["a DJ has the record", {}, "With DJ Sam"],
      [
        "a request is open",
        { state: "requested", effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat") },
        "Held for DJ Pat",
      ],
      ["a disc is back in the music office with a review waiting", { state: "pool", effective_state: "pool" }, "Back in the music office"],
      ["a music director returned a checked out disc with a review waiting", returnedByMusicDirector, "Back in the music office"],
      ["the holder's account was removed", removedHolder, "With a removed account"],
    ])("shows the location line while the read is in flight, then the From line, when %s", async (_label, itemOverrides, location) => {
      const item = waiting(7, itemOverrides);
      fakeReviewsEndpoints({ open: [item] });
      const read = holdResponse("get", REVIEWS_URL, () => HttpResponse.json([waitingReview(70, 7)]));

      renderWithProviders(<IntakeLanes />);

      const waitingLane = await lane("Review waiting (1)");
      expect(within(waitingLane).getByText(location)).toBeInTheDocument();
      expect(within(waitingLane).queryByText(/^From /)).not.toBeInTheDocument();

      read.release();
      await read.answered;
      expect(await within(waitingLane).findByText(/^From Jessica Pratt/)).toBeInTheDocument();
      expect(within(waitingLane).queryByText(location)).not.toBeInTheDocument();
      expect(within(waitingLane).queryByText(/on the review shelf/i)).not.toBeInTheDocument();
    });

    it.each([
      ["a music director returned a disc", returnedByMusicDirector, "From Jessica Pratt. The record is back in the music office."],
      ["a digital album was given back", { ...returnedByMusicDirector, digital: true }, "From Jessica Pratt."],
    ])("never reads On the review shelf for a pool record with a review waiting, when %s", async (_label, itemOverrides, line) => {
      const item = waiting(7, itemOverrides);
      fakeReviewsEndpoints({ open: [item] });
      const read = holdResponse("get", REVIEWS_URL, () => HttpResponse.json([waitingReview(70, 7)]));

      renderWithProviders(<IntakeLanes />);

      const waitingLane = await lane("Review waiting (1)");
      expect(within(waitingLane).queryByText(/on the review shelf/i)).not.toBeInTheDocument();

      read.release();
      await read.answered;
      expect(await within(waitingLane).findByText(line)).toBeInTheDocument();
      expect(within(waitingLane).queryByText(/on the review shelf/i)).not.toBeInTheDocument();
    });

    it("shows no location line for a pool digital album with a review waiting while its reviews are read", async () => {
      const item = waiting(7, { ...returnedByMusicDirector, digital: true });
      fakeReviewsEndpoints({ open: [item] });
      const read = holdResponse("get", REVIEWS_URL, () => HttpResponse.json([waitingReview(70, 7)]));

      renderWithProviders(<IntakeLanes />);

      const waitingLane = await lane("Review waiting (1)");
      // The row holds its record's parts and nothing else: no location line, not an empty one.
      const row = within(waitingLane).getByRole("link", { name: "Cat Power" }).closest("li")!;
      await within(row).findByText("Digital");
      expect(row.textContent).toBe("Cat PowerMoon PixMatadorDigitalOpen");
      expect([...row.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["Moon Pix", "Matador"]);

      read.release();
      await read.answered;
      expect(await within(waitingLane).findByText("From Jessica Pratt.")).toBeInTheDocument();
    });

    it("keeps the location line when the read fails", async () => {
      const item = waiting(7);
      fakeReviewsEndpoints({ open: [item] });
      server.use(http.get(REVIEWS_URL, () => HttpResponse.json({ message: "down" }, { status: 500 })));

      const { store } = renderWithProviders(<IntakeLanes />);

      const waitingLane = await lane("Review waiting (1)");
      await reviewsSettled(store);
      expect(within(waitingLane).getByText("With DJ Sam")).toBeInTheDocument();
      expect(within(waitingLane).queryByText(/^From /)).not.toBeInTheDocument();
    });
  });

  it("shows a checked out record with a submitted review once, under Review waiting, saying who has it", async () => {
    const item = waiting(7);
    fakeReviewsEndpoints({ open: [item], forItem: { "7": [waitingReview(70, 7)] } });

    renderWithProviders(<IntakeLanes />);

    const waitingLane = await lane("Review waiting (1)");
    expect(await within(waitingLane).findByText("From Jessica Pratt. The record is with DJ Sam.")).toBeInTheDocument();
    expect(within(waitingLane).getAllByRole("link", { name: "Cat Power" })).toHaveLength(1);
    expect(within(await lane("Being reviewed")).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("review waiting")).not.toBeInTheDocument();
  });

  it("shows a reviewed record that still has a submitted review waiting only under Reviewed", async () => {
    const item = waiting(8, { state: "reviewed", effective_state: "reviewed" });
    fakeReviewsEndpoints({ reviewed: [item] });

    renderWithProviders(<IntakeLanes />);

    expect(within(await lane("Reviewed (1)")).getByRole("link", { name: "Cat Power" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Review waiting/ })).not.toBeInTheDocument();
  });

  // One record per row, read as the server serves it; the stage it lands in is the only one whose list holds its record's link.
  const reviewWaitsOn: Partial<IntakeItem> = { submitted_review_count: 1, accepted_review_id: null };
  it.each<[string, Partial<IntakeItem>, string]>([
    ["a filed record", { state: "filed", effective_state: "filed", filed_at: justNow }, "Filed"],
    ["a finalized record", { state: "finalized", effective_state: "finalized", filed_at: justNow }, "Filed"],
    ["a finalized record with a submitted review nobody chose", { state: "finalized", effective_state: "finalized", filed_at: justNow, ...reviewWaitsOn }, "Filed"],
    ["a reviewed record", { state: "reviewed", effective_state: "reviewed", accepted_review_id: 70 }, "Reviewed"],
    ["a reviewed record with a submitted review and no chosen one", { state: "reviewed", effective_state: "reviewed", ...reviewWaitsOn }, "Reviewed"],
    ["a checked out record with a review waiting", { state: "checked_out", effective_state: "checked_out", ...heldBy("dj-1", "DJ Sam"), ...reviewWaitsOn }, "Review waiting"],
    ["a requested record with a review waiting", { state: "requested", effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat"), ...reviewWaitsOn }, "Review waiting"],
    ["a disc a music director marked as returned with its review waiting", returnedByMusicDirector, "Review waiting"],
    ["a requested record", { state: "requested", effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat") }, "Requested"],
    ["a checked out record", { state: "checked_out", effective_state: "checked_out", ...heldBy("dj-1", "DJ Sam") }, "Being reviewed"],
    ["a record on the review shelf", { state: "pool", effective_state: "pool" }, "On the review shelf"],
    ["a request that has lapsed", { state: "requested", effective_state: "pool", ...requestedFor("dj-pat", "DJ Pat") }, "On the review shelf"],
  ])("draws %s in exactly one lane", async (_label, overrides, expected) => {
    fakeReviewsEndpoints({ open: [moonPix({ id: 7, ...overrides })] });

    renderWithProviders(<IntakeLanes />);

    const holding: string[] = [];
    for (const stage of STAGE_LABELS) {
      if (within(await lane(stage)).queryByRole("link", { name: "Cat Power" })) {
        holding.push(stage);
      }
    }
    expect(holding).toEqual([expected]);
  });

  it("shows a finalized record under Filed", async () => {
    fakeReviewsEndpoints({ filed: [moonPix({ id: 5, state: "finalized", effective_state: "finalized", filed_at: justNow })] });

    renderWithProviders(<IntakeLanes />);

    expect(within(await lane("Filed")).getByRole("link", { name: "Cat Power" })).toBeInTheDocument();
  });

  it("reads intake again when the window regains focus", async () => {
    const reads: string[] = [];
    fakeReviewsEndpoints({ open: [waiting(3)] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        reads.push(new URL(request.url).search);
      }),
    );
    const store = makeStore();
    const stopListening = setupListeners(store.dispatch);
    try {
      renderWithProviders(<IntakeLanes />, { store });
      await lane("Review waiting (1)");
      await waitFor(() => expect(reads).toHaveLength(1));

      window.dispatchEvent(new Event("focus"));

      await waitFor(() => expect(reads).toEqual(["", ""]));
    } finally {
      stopListening();
    }
  });

  // A poll is scheduled when a read lands, with the focus the store had then, so the window loses focus before the first read.
  it.each([
    ["while the window has focus", false, ["", ""]],
    ["never while the window has lost focus", true, [""]],
  ])("reads intake again a minute later %s", async (_label, unfocused, expected) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const reads: string[] = [];
      fakeReviewsEndpoints({ open: [waiting(3)] });
      server.use(
        http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
          reads.push(new URL(request.url).search);
        }),
      );
      const store = makeStore();
      if (unfocused) {
        // RTK's own focus-lost action, through the hook it offers for a custom focus source.
        setupListeners(store.dispatch, (dispatch, { onFocusLost }) => {
          dispatch(onFocusLost());
          return () => {};
        });
      }

      renderWithProviders(<IntakeLanes />, { store });
      await lane("Review waiting (1)");
      await waitFor(() => expect(reads).toHaveLength(1));
      await vi.advanceTimersByTimeAsync(59_000);
      expect(reads).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1_000);

      await waitFor(() => expect(reads).toEqual(expected));
      await vi.advanceTimersByTimeAsync(100);
      expect(reads).toEqual(expected);
    } finally {
      vi.useRealTimers();
    }
  });

  it("names a removed holder in the Review waiting lane instead of printing null", async () => {
    const orphan = waiting(9, removedHolder);
    fakeReviewsEndpoints({ open: [orphan], forItem: { "9": [waitingReview(90, 9)] } });

    renderWithProviders(<IntakeLanes />);

    const lane1 = await lane("Review waiting (1)");
    expect(await within(lane1).findByText("From Jessica Pratt. The record is with a removed account.")).toBeInTheDocument();
    expect(within(lane1).queryByText(/^With /)).not.toBeInTheDocument();
    expect(lane1).not.toHaveTextContent("null");
  });

  it.each([
    ["a disc", intakeItem, "With DJ Sam", "With a removed account", "From Cat Power. The record is with DJ Sam.", "From Jessica Pratt, who has this record.", "From Cat Power. The record is with a removed account."],
    ["a digital album", digitalItem, "With DJ Sam", "With a removed account", "From Cat Power. The record is with DJ Sam.", "From Jessica Pratt, who has this record.", "From Cat Power. The record is with a removed account."],
  ])("words the location and From lines of %s the same", async (_label, make, held, removed, fromWith, fromHolder, fromRemoved) => {
    const row = (id: number, overrides = {}) =>
      make({ id, artist_name: "Cat Power", album_title: `Album ${id}`, state: "checked_out", effective_state: "checked_out", submitted_review_count: 1, ...overrides });
    const items = [row(1, heldBy("dj-sam", "DJ Sam")), row(2, removedHolder), row(3, heldBy("dj-jess", "Jessica Pratt"))];
    const unreviewed = [row(4, heldBy("dj-sam", "DJ Sam")), row(5, removedHolder)].map((i) => ({ ...i, submitted_review_count: 0 }));
    fakeReviewsEndpoints({
      open: [...items, ...unreviewed],
      forItem: {
        "1": [waitingReview(10, 1, { author: "Cat Power", author_user_id: "dj-cp" })],
        "2": [waitingReview(20, 2, { author: "Cat Power", author_user_id: "dj-cp" })],
        "3": [waitingReview(30, 3)],
      },
    });

    renderWithProviders(<IntakeLanes />);

    const waitingLane = await lane("Review waiting (3)");
    for (const line of [fromWith, fromRemoved, fromHolder]) {
      expect(await within(waitingLane).findByText(line)).toBeInTheDocument();
    }
    const taken = await lane("Being reviewed");
    expect(within(taken).getByText(held)).toBeInTheDocument();
    expect(within(taken).getByText(removed)).toBeInTheDocument();
  });

  it("shows a reviewed digital album that still has a holder with no Still out line and no Mark as returned, and a reviewed disc with both", async () => {
    fakeReviewsEndpoints({
      reviewed: [
        digitalItem({ id: 1, artist_name: "Cat Power", album_title: "Digital One", effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") }),
        digitalItem({ id: 2, artist_name: "Cat Power", album_title: "Digital Two", effective_state: "reviewed", ...removedHolder }),
        moonPix({ id: 3, album_title: "Disc One", effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") }),
      ],
    });

    renderWithProviders(<IntakeLanes />);

    const reviewed = await lane("Reviewed (3)");
    const rowOf = (title: string) => within(reviewed).getByText(new RegExp(title)).closest("li")!;
    for (const title of ["Digital One", "Digital Two"]) {
      expect(within(rowOf(title)).queryByText(/^Still with/)).not.toBeInTheDocument();
      expect(within(rowOf(title)).queryByRole("button", { name: "Mark as returned" })).not.toBeInTheDocument();
    }
    expect(within(rowOf("Disc One")).getByText("Still with DJ Sam")).toBeInTheDocument();
    expect(within(rowOf("Disc One")).getByRole("button", { name: "Mark as returned" })).toBeInTheDocument();
  });

  it("shows a reviewed record's holder and overdue mark, and none for a returned one", async () => {
    fakeReviewsEndpoints({
      reviewed: [
        moonPix({ id: 1, effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z"), overdue: true }),
        moonPix({ id: 2, effective_state: "reviewed", ...removedHolder }),
        moonPix({ id: 3, effective_state: "reviewed" }),
      ],
    });

    renderWithProviders(<IntakeLanes />);

    const reviewed = await lane("Reviewed (3)");
    expect(within(reviewed).getByText("Still with DJ Sam")).toBeInTheDocument();
    expect(within(reviewed).getByText("Still with a removed account")).toBeInTheDocument();
    expect(within(reviewed).getAllByText(/^Still with/)).toHaveLength(2);
    expect(within(reviewed).getAllByRole("button", { name: "Mark as returned" })).toHaveLength(2);
    expect(within(reviewed).getAllByText("Overdue")).toHaveLength(1);
  });

  it.each([
    ["Being reviewed", "the overdue row first", "checked_out", "Being reviewed"],
    ["Being reviewed", "the overdue row second", "checked_out", "Being reviewed"],
    ["Reviewed", "the overdue row first", "reviewed", "Reviewed (2)"],
    ["Reviewed", "the overdue row second", "reviewed", "Reviewed (2)"],
  ])("sorts an overdue row first in the %s lane when the read returns %s", async (_name, readOrder, state, heading) => {
    // The overdue row is the newer-logged, lower-id one, so neither a date nor an id ordering puts it first.
    const row = (id: number, overrides = {}) =>
      moonPix({ id, album_title: `Album ${id}`, state, effective_state: state, ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z"), ...overrides });
    const overdue = row(1, { logged_at: "2026-09-02T12:00:00Z", overdue: true });
    const onTime = row(2, { logged_at: "2026-09-01T12:00:00Z" });
    const read = readOrder === "the overdue row first" ? [overdue, onTime] : [onTime, overdue];
    fakeReviewsEndpoints();
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(read)));

    renderWithProviders(<IntakeLanes />);

    const links = within(await lane(heading)).getAllByRole("link", { name: "Cat Power" });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/dashboard/admin/intake/1", "/dashboard/admin/intake/2"]);
  });

  it("counts the Reviewed lane's rows in its heading, and drops it on a refetch when a record is filed", async () => {
    let filed = false;
    const reviewed = (id: number, overrides = {}) => moonPix({ id, album_title: `Album ${id}`, state: "reviewed", effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z"), ...overrides });
    // Releasing record 1 keeps it reviewed; record 2 leaves the lane by changing state, as the read after the write shows.
    fakeReviewsEndpoints({
      reviewed: () => [reviewed(1), filed ? reviewed(2, { state: "filed", effective_state: "filed" }) : reviewed(2)],
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/1/release`, () => {
        filed = true;
        return HttpResponse.json(moonPix({ id: 1 }));
      }),
    );

    const { user } = renderWithProviders(<IntakeLanes />);
    const two = await lane("Reviewed (2)");
    await user.click(within(within(two).getByText(/Album 1/).closest("li")!).getByRole("button", { name: "Mark as returned" }));

    const one = await lane("Reviewed (1)");
    expect(within(one).getByText(/Album 1/)).toBeInTheDocument();
    expect(within(one).queryByText(/Album 2/)).not.toBeInTheDocument();
  });

  it("keeps the plain Reviewed heading when the lane is empty", async () => {
    fakeReviewsEndpoints({ open: [moonPix()] });

    renderWithProviders(<IntakeLanes />);

    expect(await lane("Reviewed")).toHaveTextContent("Nothing here.");
    expect(screen.queryByText(/Reviewed \(/)).not.toBeInTheDocument();
  });

  it("shows only the five most recent passes", async () => {
    const passes = [1, 2, 3, 4, 5, 6].map((day) => ({ dj_name: `DJ ${day}`, passed_at: `2026-10-0${day}T12:00:00Z` }));
    fakeReviewsEndpoints({ open: [moonPix({ id: 1, passes })] });

    renderWithProviders(<IntakeLanes />);

    const band = await screen.findByRole("region", { name: "Recent passes" });
    expect(within(band).getAllByRole("listitem").map((li) => li.textContent?.split(" ")[1])).toEqual(["6", "5", "4", "3", "2"]);
  });

  it("lists the recent passes from the read, newest first, and shows no band when there are none", async () => {
    const pass = (dj_name: string, passed_at: string) => ({ dj_name, passed_at });
    fakeReviewsEndpoints({
      open: [
        moonPix({ id: 1, logged_at: "2026-09-02T12:00:00Z", artist_name: "Juana Molina", album_title: "DOGA", passes: [pass("Pat", "2025-10-01T12:00:00Z")] }),
        moonPix({ id: 2, logged_at: "2026-09-01T12:00:00Z", artist_name: "Stereolab", album_title: "Aluminum Tunes", passes: [pass("Sam", "2025-10-03T12:00:00Z")] }),
      ],
    });

    const { unmount } = renderWithProviders(<IntakeLanes />);

    const band = await screen.findByRole("region", { name: "Recent passes" });
    expect(within(within(band).getByRole("list")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Sam passed on Stereolab — Aluminum Tunes · Oct 3, 2025",
      "Pat passed on Juana Molina — DOGA · Oct 1, 2025",
    ]);
    expect(within(band).getByRole("heading", { name: "Recent passes" })).toBeInTheDocument();
    expect(band.closest("[role=status]")).toBeNull();
    expect(band.querySelector("[role=status]")).toBeNull();
    // The band sits at the top of the page, above the chips.
    expect(band.compareDocumentPosition(screen.getByRole("tablist")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    fakeReviewsEndpoints({ open: [moonPix({ id: 1, passes: [] })] });
    renderWithProviders(<IntakeLanes />);
    await lane("Filed");
    expect(screen.queryByRole("region", { name: "Recent passes" })).not.toBeInTheDocument();
  });

  it("Mark as returned sends the release, and the record stays in Reviewed without its line", async () => {
    let released = false;
    fakeReviewsEndpoints({ reviewed: () => [moonPix({ id: 11, effective_state: "reviewed", ...(released ? {} : heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z")) })] });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => {
        released = true;
        return HttpResponse.json(moonPix({ id: 11 }));
      }),
    );

    const { user } = renderWithProviders(<IntakeLanes />);
    await user.click(await within(await lane("Reviewed")).findByRole("button", { name: "Mark as returned" }));

    await waitFor(() => expect(screen.queryByText(/^Still with/)).not.toBeInTheDocument());
    expect(within(await lane("Reviewed (1)")).getByText("Moon Pix")).toBeInTheDocument();
  });

  const LOST_RACE = "This record has already been returned or filed. The lists have been reloaded.";
  // The 409's own tag invalidation refetches the read by itself, so only a
  // read that is held pending can tell "reloaded, then noticed" from "noticed".
  it("a 409 state_changed keeps the row locked and shows no notice while the read is still reloading, then shows the approved notice and no server message", async () => {
    let lost = false;
    let heldReads = 0;
    let releaseHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    const row = moonPix({ id: 11, effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") });
    fakeReviewsEndpoints({ reviewed: [row] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, async () => {
        if (lost) {
          heldReads += 1;
          await held;
        }
        return HttpResponse.json([row]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => {
        lost = true;
        return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
      }),
    );

    showStage("reviewed");
    const { store, user } = renderWithProviders(<IntakeLanes />);
    const returnButton = await screen.findByRole("button", { name: "Mark as returned" });
    await user.click(returnButton);

    // Assert during the hold, once the reload has started and is the only request outstanding.
    await waitFor(() => expect(heldReads).toBeGreaterThan(0));
    await waitFor(() => expect(pendingCount(store)).toBe(1));
    await renderedFrame();
    expect(screen.queryByText(LOST_RACE)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as returned" })).toBeDisabled();

    releaseHeld();
    expect(await screen.findByText(LOST_RACE)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark as returned" })).toBeEnabled());
    expect(screen.queryByText("server words")).not.toBeInTheDocument();
  });

  it("clears the lost-race notice when the next row action starts", async () => {
    let releasedSecond = false;
    let releaseSecondWrite!: () => void;
    const secondWrite = new Promise<void>((resolve) => {
      releaseSecondWrite = resolve;
    });
    fakeReviewsEndpoints({
      reviewed: [
        moonPix({ id: 11, album_title: "Dark Side", effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") }),
        moonPix({ id: 12, effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") }),
      ],
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/12/release`, () =>
        HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
      ),
      http.post(`${TEST_BACKEND_URL}/intake/11/release`, async () => {
        await secondWrite;
        releasedSecond = true;
        return HttpResponse.json(moonPix({ id: 11, effective_state: "reviewed" }));
      }),
    );

    showStage("reviewed");
    const { user } = renderWithProviders(<IntakeLanes />);
    const [first, second] = await screen.findAllByRole("button", { name: "Mark as returned" });
    await user.click(first);
    expect(await screen.findByText(LOST_RACE)).toBeInTheDocument();

    await user.click(second);

    // Gone as the action starts, not after it lands.
    expect(releasedSecond).toBe(false);
    expect(screen.queryByText(LOST_RACE)).not.toBeInTheDocument();
    releaseSecondWrite();
    await waitFor(() => expect(second).toBeEnabled());
    expect(screen.queryByText(LOST_RACE)).not.toBeInTheDocument();
  });
});

describe("IntakeLanes — a failed background refetch", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the loaded lanes and shows no load-failure line when the reload after a write fails", async () => {
    fakeReviewsEndpoints({ reviewed: [moonPix({ id: 11, effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") })] });
    showStage("reviewed");
    const { user } = renderWithProviders(<IntakeLanes />);
    const button = await screen.findByRole("button", { name: "Mark as returned" });

    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })),
      http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => HttpResponse.json(moonPix({ id: 11 }))),
    );
    await user.click(button);

    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(await lane("Reviewed (1)")).getByText("Moon Pix")).toBeInTheDocument();
  });

  it("shows the load-failure line when a first load fails", async () => {
    // The FCC notes read is served, so the one alert is the intake read's and not a second failure racing it.
    fakeReviewsEndpoints();
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<IntakeLanes />);
    expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_COPY.screen.loadFailed);
  });

  it("still shows the FCC notes to confirm when an intake read fails", async () => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [fccNote({ id: 1, intake_item_id: 5 })] });
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<IntakeLanes />);

    expect(await screen.findByRole("region", { name: "FCC notes to confirm (1)" })).toBeInTheDocument();
    expect(await screen.findByText(REVIEW_COPY.screen.loadFailed)).toBeInTheDocument();
  });
});

const requestedRow = (id: number) =>
  moonPix({ id, state: "requested", effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat") });
const outRow = (id: number, overrides = {}) =>
  moonPix({ id, state: "checked_out", effective_state: "checked_out", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z"), ...overrides });

describe("IntakeLanes — cancel and release", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("cancels a request from the Requested lane, and the record leaves it", async () => {
    fakeReviewsEndpoints({ open: [requestedRow(11)] });

    const { user } = renderWithProviders(<IntakeLanes />);
    await user.click(await within(await lane("Requested")).findByRole("button", { name: "Cancel request" }));

    const requested = screen.getByRole("tabpanel", { name: "Requested" });
    await waitFor(() => expect(within(requested).queryByRole("button")).not.toBeInTheDocument());
    expect(within(requested).queryByText(/Moon Pix/)).not.toBeInTheDocument();
  });

  // One table over a disc and a digital album, with and without a waiting review, and with a removed holder. `after` is
  // the record as POST /intake/{id}/release leaves it on the server: `pool`, nobody holding it, any review still waiting.
  const asDigital: Partial<IntakeItem> = { digital: true, format_id: CDR_FORMAT.id };
  const reviewWaits: Partial<IntakeItem> = { submitted_review_count: 1, accepted_review_id: null };
  const releasedToPool: Partial<IntakeItem> = { state: "pool", effective_state: "pool", ...returned };
  const SAM = heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z");
  const RETURN = "Return to the review shelf";
  const MARK = "Mark as returned";
  const RETURN_TITLE = "Return Cat Power, Moon Pix, to the review shelf?";
  const MARK_TITLE = "Mark Cat Power, Moon Pix as back in the music office?";
  const BACK_IN_OFFICE = "From Jessica Pratt. The record is back in the music office.";
  type Row = {
    item: Partial<IntakeItem>;
    // Null where the record, having a review waiting, is drawn under Review waiting and not here.
    beingReviewed: string[] | null;
    reviewWaiting: string[] | null;
    confirm: { title: string; body: string } | null;
    after: Partial<IntakeItem> | null;
    fromAfter: string | null;
  };

  it.each<[string, Row]>([
    ["a disc a DJ has", { item: SAM, beingReviewed: [RETURN], reviewWaiting: null, confirm: { title: RETURN_TITLE, body: "DJ Sam will no longer have it, and any DJ can choose to review it. Ask them to bring the disc to the music office." }, after: releasedToPool, fromAfter: null }],
    ["a digital album a DJ has", { item: { ...asDigital, ...SAM }, beingReviewed: [RETURN], reviewWaiting: null, confirm: { title: RETURN_TITLE, body: "DJ Sam will no longer have it, and any DJ can choose to review it." }, after: { ...asDigital, ...releasedToPool }, fromAfter: null }],
    ["a disc whose holder was removed", { item: removedHolder, beingReviewed: [RETURN], reviewWaiting: null, confirm: { title: RETURN_TITLE, body: "Any DJ can choose to review it." }, after: releasedToPool, fromAfter: null }],
    ["a digital album whose holder was removed", { item: { ...asDigital, ...removedHolder }, beingReviewed: [RETURN], reviewWaiting: null, confirm: { title: RETURN_TITLE, body: "Any DJ can choose to review it." }, after: { ...asDigital, ...releasedToPool }, fromAfter: null }],
    ["a disc a DJ has, with a review waiting", { item: { ...SAM, ...reviewWaits }, beingReviewed: null, reviewWaiting: [MARK], confirm: { title: MARK_TITLE, body: "DJ Sam will no longer have it. Their review stays waiting for you to choose." }, after: returnedByMusicDirector, fromAfter: BACK_IN_OFFICE }],
    ["a disc whose holder was removed, with a review waiting", { item: { ...removedHolder, ...reviewWaits }, beingReviewed: null, reviewWaiting: [MARK], confirm: { title: MARK_TITLE, body: "The review stays waiting for you to choose." }, after: returnedByMusicDirector, fromAfter: BACK_IN_OFFICE }],
    ["a digital album a DJ has, with a review waiting", { item: { ...asDigital, ...SAM, ...reviewWaits }, beingReviewed: null, reviewWaiting: [], confirm: null, after: null, fromAfter: null }],
    ["a digital album whose holder was removed, with a review waiting", { item: { ...asDigital, ...removedHolder, ...reviewWaits }, beingReviewed: null, reviewWaiting: [], confirm: null, after: null, fromAfter: null }],
  ])("for %s, offers its own button and confirmation, sends nothing on Cancel, and leaves the record where the server puts it", async (_label, { item, beingReviewed, reviewWaiting, confirm, after, fromAfter }) => {
    const posts: number[] = [];
    const row = () => outRow(11, posts.length > 0 ? { ...item, ...after } : item);
    fakeReviewsEndpoints({
      open: () => [row()],
      forItem: { "11": [review({ id: 70, intake_item_id: 11, status: "submitted", author: "Jessica Pratt", author_user_id: "dj-jess", add_date: "2026-10-01" })] },
    });
    server.use(http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => {
      posts.push(11);
      return HttpResponse.json(outRow(11, { ...item, ...after }));
    }));
    const buttons = (region: HTMLElement) => within(region).queryAllByRole("button").map((b) => b.textContent);

    const { user } = renderWithProviders(<IntakeLanes />);
    await screen.findByRole("link", { name: "Cat Power" });
    const being = await lane("Being reviewed");
    expect(within(being).queryByRole("link", { name: "Cat Power" }) !== null).toBe(beingReviewed !== null);
    expect(beingReviewed && buttons(being)).toEqual(beingReviewed);
    const waitingLane = reviewWaiting && (await lane("Review waiting (1)"));
    expect(waitingLane ? buttons(waitingLane) : null).toEqual(reviewWaiting);
    expect(screen.queryByRole("button", { name: /release/i })).not.toBeInTheDocument();
    if (!confirm) {
      return;
    }

    const button = [...(beingReviewed ?? []), ...(reviewWaiting ?? [])][0];
    await user.click(screen.getByRole("button", { name: button }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: confirm.title })).toBeInTheDocument();
    expect(within(dialog).getByText(confirm.body)).toBeInTheDocument();
    expect(buttons(dialog)).toEqual([button, "Cancel"]);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(posts).toEqual([]);

    await user.click(screen.getByRole("button", { name: button }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: button }));

    await waitFor(() => expect(posts).toEqual([11]));
    if (fromAfter) {
      const stillWaiting = screen.getByRole("tabpanel", { name: "Review waiting" });
      expect(await within(stillWaiting).findByText(fromAfter)).toBeInTheDocument();
      expect(buttons(stillWaiting)).toEqual([]);
      expect(within(await lane("Being reviewed")).queryByText(/Moon Pix/)).not.toBeInTheDocument();
      await lane("Review waiting (1)");
    } else {
      await waitFor(() => expect(within(screen.getByRole("tabpanel", { name: "Being reviewed" })).queryByText(/Moon Pix/)).not.toBeInTheDocument());
      expect(screen.getByRole("tab", { name: "Review waiting, 0" })).toBeInTheDocument();
    }
    // The review shelf chip is the only place the review shelf is named: the record's own row names no location there.
    expect(within(screen.getByRole("tabpanel")).queryByText(/on the review shelf/i)).not.toBeInTheDocument();
  });
});

describe("IntakeLanes — a record with a review waiting keeps its actions", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends a request's Cancel request from its Review waiting row", async () => {
    const calls: string[] = [];
    const item = { ...requestedRow(11), submitted_review_count: 1 };
    fakeReviewsEndpoints({ open: [item] });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/cancel-request`, ({ params }) => {
        calls.push(String(params.id));
        return HttpResponse.json(item);
      }),
    );

    const { user } = renderWithProviders(<IntakeLanes />);
    await user.click(await within(await lane("Review waiting (1)")).findByRole("button", { name: "Cancel request" }));

    await waitFor(() => expect(calls).toEqual(["11"]));
  });
});

describe("IntakeLanes — lost races", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  const RACE_LINES = {
    cancel: "This request was already answered, or it expired. The lists have been reloaded.",
    release: "This record has already been returned. The lists have been reloaded.",
    return: "This record has already been returned or filed. The lists have been reloaded.",
  };

  it.each([
    ["Cancel request", "cancel", "cancel-request", () => ({ open: [requestedRow(11)] }), "Cancel request", false, "requested"],
    ["Return to the review shelf", "release", "release", () => ({ open: [outRow(11)] }), "Return to the review shelf", true, "being_reviewed"],
    ["Mark as returned on the Reviewed lane", "return", "release", () => ({ reviewed: [moonPix({ id: 11, effective_state: "reviewed", ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z") })] }), "Mark as returned", false, "reviewed"],
    ["Mark as returned on a Review waiting disc", "return", "release", () => ({ open: [waiting(11)] }), "Mark as returned", true, "waiting"],
  ] as const)(
    "a lost %s reloads the read, then shows its own line and never the server message",
    async (_label, action, path, rows, button, confirms, stage) => {
      let reads = 0;
      showStage(stage);
      fakeReviewsEndpoints(rows());
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/11/${path}`, () =>
          HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
        ),
      );
      const { user } = renderWithProviders(<IntakeLanes />);
      await screen.findByRole("button", { name: button });
      const counting = http.get(`${TEST_BACKEND_URL}/intake`, () => {
        reads += 1;
        return undefined;
      });
      server.use(counting);
      await user.click(screen.getByRole("button", { name: button }));
      if (confirms) {
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: button }));
      }

      expect(await screen.findByText(RACE_LINES[action])).toBeInTheDocument();
      expect(reads).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );
});

describe("IntakeLogForm", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff"));
  afterEach(() => vi.unstubAllEnvs());

  it("logs the typed fields", async () => {
    let body: unknown;
    fakeReviewsEndpoints();
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "A disc or a record" }));
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "CD" }));
    await user.type(screen.getByLabelText("Discogs link or release number (optional)"), "123");
    await user.click(screen.getByRole("button", { name: "Log item" }));

    await waitFor(() =>
      expect(body).toEqual({ artist_name: "Cat Power", album_title: "Moon Pix", format_id: 1, discogs_release_id: 123 }),
    );
  });

  it.each([
    { arrival: "A disc or a record", format: "CD", sent: { format_id: 1 } },
    { arrival: "As files", format: null, sent: { digital: true } },
  ])("sends the release id read from a pasted link whichever way the record arrived ($arrival)", async ({ arrival, format, sent }) => {
    let body: unknown;
    fakeReviewsEndpoints();
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm />);
    const discogs = await screen.findByLabelText("Discogs link or release number (optional)");
    await user.type(discogs, "https://www.discogs.com/release/8434-Autechre-Confield");
    await user.type(screen.getByLabelText(/^Artist/), "Autechre");
    await user.type(screen.getByLabelText(/^Album/), "Confield");
    await user.click(screen.getByRole("radio", { name: arrival }));
    if (format) {
      await user.click(screen.getByRole("combobox", { name: /^Format/ }));
      await user.click(await screen.findByRole("option", { name: format }));
    }
    await user.click(screen.getByRole("button", { name: "Log item" }));

    await waitFor(() =>
      expect(body).toEqual({ artist_name: "Autechre", album_title: "Confield", ...sent, discogs_release_id: 8434 }),
    );
  });

  it("puts the Discogs field first among all the form's controls, as a text input rather than a number input", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(<IntakeLogForm />);
    const discogs = await screen.findByLabelText("Discogs link or release number (optional)");
    const form = screen.getByRole("form", { name: "Log an item" }) as HTMLFormElement;

    expect(discogs).not.toHaveAttribute("type", "number");
    expect(discogs).toHaveAttribute("inputmode", "numeric");
    // Every control in tree order: the Artist autocomplete (a combobox), the textboxes, the arrival radios and the buttons.
    expect(form.elements[0]).toBe(discogs);
    expect(discogs.compareDocumentPosition(screen.getByRole("combobox", { name: /^Artist/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ["a master link", "https://www.discogs.com/master/8434-Confield"],
    ["zero", "0"],
    ["an id past int4", "2147483648"],
  ])("refuses %s under the Discogs field, sends nothing, and keeps Log item disabled until it is corrected", async (_kind, raw) => {
    let posts = 0;
    fakeReviewsEndpoints();
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, () => {
        posts += 1;
        return HttpResponse.json(moonPix());
      }),
    );
    const { user } = renderWithProviders(<IntakeLogForm />);
    const discogs = await screen.findByLabelText("Discogs link or release number (optional)");
    await user.type(screen.getByLabelText(/^Artist/), "Autechre");
    await user.type(screen.getByLabelText(/^Album/), "Confield");
    await user.click(screen.getByRole("radio", { name: "A disc or a record" }));
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "CD" }));
    const log = screen.getByRole("button", { name: "Log item" });
    expect(log).toBeEnabled();

    await user.type(discogs, raw);
    expect(screen.getByText("That isn't a Discogs release link or number.")).toBeInTheDocument();
    expect(log).toBeDisabled();
    // Submit the form itself, past the disabled button, and let any request land before counting.
    fireEvent.submit(screen.getByRole("form", { name: "Log an item" }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(posts).toBe(0);

    await user.clear(discogs);
    expect(screen.queryByText("That isn't a Discogs release link or number.")).not.toBeInTheDocument();
    expect(log).toBeEnabled();
  });

  it("asks how the record arrived, and logging files sends digital with no format id", async () => {
    let body: unknown;
    fakeReviewsEndpoints({ formats: [{ id: 1, format_name: "cd" }, CDR_FORMAT] });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    const log = screen.getByRole("button", { name: "Log item" });
    expect(log).toBeDisabled();
    const arrival = screen.getByRole("radiogroup", { name: /^How did it arrive\?/ });
    expect(arrival).toBeRequired();
    expect(within(arrival).getByRole("radio", { name: "As files" })).toHaveAccessibleDescription("Burned to CD-R once it's reviewed");
    expect(within(arrival).getByText("Burned to CD-R once it's reviewed")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: /^Format/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "As files" }));
    expect(screen.queryByRole("combobox", { name: /^Format/ })).not.toBeInTheDocument();
    expect(log).toBeEnabled();
    await user.click(log);

    await waitFor(() => expect(body).toEqual({ artist_name: "Cat Power", album_title: "Moon Pix", digital: true }));
  });

  describe("artist suggestions", () => {
    const match = (id: number, artist_name: string, genre_id: number, genre_name: string) => ({
      id, artist_name, code_letters: "AUT", code_number: id, genre_id, genre_name,
    });

    it("suggests library spellings with each genre, from one library-wide search, and picking one sets the text", async () => {
      const requests: URL[] = [];
      fakeReviewsEndpoints();
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/search`, ({ request }) => {
          requests.push(new URL(request.url));
          return HttpResponse.json({
            artists: [match(1, "Autechre", 5, "Electronic"), match(1, "Autechre", 6, "Rock")],
          });
        }),
      );

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Artist/), "Aute");

      const options = await screen.findAllByRole("option");
      expect(options.map((o) => o.textContent)).toEqual(["AutechreElectronic", "AutechreRock"]);
      expect(requests).toHaveLength(1);
      expect(requests[0].searchParams.get("q")).toBe("Aute");
      expect(requests[0].searchParams.get("limit")).toBe("8");
      expect(requests[0].searchParams.has("genre_id")).toBe(false);

      await user.click(options[0]);
      expect(screen.getByLabelText(/^Artist/)).toHaveValue("Autechre");
    });

    it("logs free text that matches nothing as typed", async () => {
      let body: unknown;
      fakeReviewsEndpoints();
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => HttpResponse.json({ artists: [] })),
        http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(moonPix());
        }),
      );

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Artist/), "Nobody Yet");
      await user.type(screen.getByLabelText(/^Album/), "Debut");
      await user.click(screen.getByRole("radio", { name: "As files" }));
      await user.click(screen.getByRole("button", { name: "Log item" }));

      await waitFor(() => expect(body).toEqual({ artist_name: "Nobody Yet", album_title: "Debut", digital: true }));
    });

    it("shows no options for a failed search and still logs", async () => {
      let body: unknown;
      fakeReviewsEndpoints();
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => new HttpResponse(null, { status: 500 })),
        http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(moonPix());
        }),
      );

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Artist/), "Autechre");
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(screen.queryByRole("option")).not.toBeInTheDocument();

      await user.type(screen.getByLabelText(/^Album/), "Amber");
      await user.click(screen.getByRole("radio", { name: "As files" }));
      await user.click(screen.getByRole("button", { name: "Log item" }));

      await waitFor(() => expect(body).toEqual({ artist_name: "Autechre", album_title: "Amber", digital: true }));
    });

    // A later search that fails or is skipped must not show the rows of an earlier one.
    const fakeSearchThatSucceedsOnlyForAute = (queries: string[]) =>
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/search`, ({ request }) => {
          const q = new URL(request.url).searchParams.get("q") ?? "";
          queries.push(q);
          return q === "Aute"
            ? HttpResponse.json({ artists: [match(1, "Autechre", 5, "Electronic")] })
            : new HttpResponse(null, { status: 500 });
        }),
      );

    it("shows no options for a failed search that follows a successful one", async () => {
      const queries: string[] = [];
      fakeReviewsEndpoints();
      fakeSearchThatSucceedsOnlyForAute(queries);

      const { user } = renderWithProviders(<IntakeLogForm />);
      const artist = await screen.findByLabelText(/^Artist/);
      await user.type(artist, "Aute");
      expect(await screen.findAllByRole("option")).toHaveLength(1);

      await user.clear(artist);
      await user.type(artist, "Stereo");
      await waitFor(() => expect(queries).toContain("Stereo"));
      await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    });

    it("shows no options once the text drops below two characters", async () => {
      const queries: string[] = [];
      fakeReviewsEndpoints();
      fakeSearchThatSucceedsOnlyForAute(queries);

      const { user } = renderWithProviders(<IntakeLogForm />);
      const artist = await screen.findByLabelText(/^Artist/);
      await user.type(artist, "Aute");
      expect(await screen.findAllByRole("option")).toHaveLength(1);

      await user.clear(artist);
      await user.type(artist, "B");
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(screen.queryAllByRole("option")).toHaveLength(0);
      expect(queries).toEqual(["Aute"]);
    });

    it("starts the next record with no suggestions, no selection, and no clear button", async () => {
      fakeReviewsEndpoints();
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/search`, () =>
          HttpResponse.json({ artists: [match(1, "Autechre", 5, "Electronic")] }),
        ),
        http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(moonPix())),
      );

      const { user } = renderWithProviders(<IntakeLogForm />);
      const artist = await screen.findByLabelText(/^Artist/);
      await user.type(artist, "Aute");
      await user.click((await screen.findAllByRole("option"))[0]);
      await user.type(screen.getByLabelText(/^Album/), "Amber");
      await user.click(screen.getByRole("radio", { name: "As files" }));
      await user.click(screen.getByRole("button", { name: "Log item" }));
      await waitFor(() => expect(artist).toHaveValue(""));

      await user.click(artist);
      expect(screen.queryAllByRole("option")).toHaveLength(0);
      expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();

      // The earlier pick must not stay selected, or Enter would take it instead of submitting.
      await user.type(artist, "Aute");
      const again = (await screen.findAllByRole("option"))[0];
      expect(again).not.toHaveAttribute("aria-selected", "true");
    });

    it("sends one search for what was typed, not another for the name that was picked", async () => {
      const queries: string[] = [];
      fakeReviewsEndpoints();
      fakeSearchThatSucceedsOnlyForAute(queries);

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Artist/), "Aute");
      await user.click((await screen.findAllByRole("option"))[0]);
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(queries).toEqual(["Aute"]);
    });
  });

  it("asks for a format once a disc or a record is chosen, and lists no Digital choice", async () => {
    fakeReviewsEndpoints({ formats: [{ id: 1, format_name: "cd" }, CDR_FORMAT] });
    const { user } = renderWithProviders(<IntakeLogForm />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "A disc or a record" }));
    const log = screen.getByRole("button", { name: "Log item" });
    expect(log).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["CD", "CD-R"]);
    await user.click(screen.getByRole("option", { name: "CD-R" }));
    expect(log).toBeEnabled();
  });
});

describe("a digital record's format line", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff"));
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["unfiled, reads Digital", { effective_state: "checked_out", state: "checked_out", ...heldBy("dj-1", "DJ Sam", null) }, "Digital", "CD-R"],
    ["filed, reads its CD-R format", { effective_state: "filed", state: "filed", filed_at: justNow, ...heldBy("dj-1", "DJ Sam", null) }, "CD-R", "Digital"],
  ] as const)("a record %s in its lane", async (_name, overrides, text, other) => {
    mockAuth.authority = Authorization.MD;
    const row = digitalItem({ id: 21, artist_name: "Juana Molina", album_title: "DOGA", ...overrides });
    fakeReviewsEndpoints({ open: [row], filed: [row], formats: [{ id: 1, format_name: "cd" }, CDR_FORMAT] });
    showStage(overrides.effective_state === "filed" ? "filed" : "being_reviewed");
    renderWithProviders(<IntakeLanes />);
    const lane = (await screen.findByRole("link", { name: "Juana Molina" })).closest("li") as HTMLElement;
    expect(within(lane).getByText("DOGA")).toBeInTheDocument();
    expect(within(lane).getByText("Duophonic")).toBeInTheDocument();
    expect(await within(lane).findByText(text)).toBeInTheDocument();
    expect(within(lane).queryByText(other)).not.toBeInTheDocument();
  });
});

describe("IntakeLanes as the music directors' tab", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff"));
  afterEach(() => vi.unstubAllEnvs());

  it("shows the stages in the order a record moves, each with its count, and no logging form", async () => {
    const row = (id: number, state: string, overrides = {}) =>
      moonPix({ id, album_title: `Album ${id}`, state, effective_state: state, ...overrides });
    const waitingRow = row(1, "checked_out", { ...heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z"), submitted_review_count: 1 });
    fakeReviewsEndpoints({
      open: [waitingRow, requestedRow(2), row(3, "checked_out", heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z")), moonPix({ id: 6, album_title: "Album 6" })],
      reviewed: [row(4, "reviewed", heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z"))],
      filed: [row(5, "filed", heldBy("dj-1", "DJ Sam", "2026-09-01T12:00:00Z"))],
    });

    renderWithProviders(<IntakeLanes />);

    const tabs = await screen.findAllByRole("tab");
    expect(
      ["On the review shelf, 1", "Requested, 1", "Being reviewed, 1", "Review waiting, 1", "Reviewed, 1", "Filed, 1"].map((name) => screen.getByRole("tab", { name })),
    ).toEqual(tabs);
    expect(screen.queryByRole("form", { name: "Log an item" })).not.toBeInTheDocument();
  });
});
