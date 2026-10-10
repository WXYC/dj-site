import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, fccNote, holdResponse, intakeItem, pendingCount, renderedFrame, renderWithProviders, review, reviewsSettled, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

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
import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import IntakeLogForm from "@/src/components/experiences/modern/reviews/IntakeLogForm";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const moonPix = (overrides = {}) =>
  intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", ...overrides });

const waiting = (id: number, overrides = {}) =>
  moonPix({ id, state: "checked_out", effective_state: "checked_out", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam", submitted_review_count: 1, accepted_review_id: null, ...overrides });

const lane = (name: string) => screen.findByRole("region", { name });

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
});

describe("IntakeLanes", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("puts FCC notes to confirm above the Recent passes band and the first lane", async () => {
    fakeReviewsEndpoints({
      open: [moonPix({ id: 5, passes: [{ dj_name: "Sam", passed_at: "2026-10-01T10:00:00Z" }] })],
      fccNotesToConfirm: [fccNote({ id: 1, intake_item_id: 5 })],
    });

    renderWithProviders(<IntakeLanes />);

    const section = await screen.findByRole("region", { name: "FCC notes to confirm (1)" });
    const band = screen.getByRole("region", { name: "Recent passes" });
    const first = screen.getByRole("region", { name: "Requested" });
    expect(section.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    ["release", REVIEW_COPY.intake.release, "Release"],
    ["more", REVIEW_COPY.intake.more(2), "+2 more"],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it("names each record with the one record line, in the lane for its state", async () => {
    fakeReviewsEndpoints({
      open: [
        moonPix({ id: 2, state: "requested", effective_state: "requested", requested_dj_name: "DJ Pat" }),
        waiting(3, { album_title: "Dark Side" }),
      ],
      reviewed: [moonPix({ id: 4, state: "reviewed", effective_state: "reviewed" })],
      filed: [moonPix({ id: 5, state: "filed", effective_state: "filed" })],
    });

    renderWithProviders(<IntakeLanes />);

    const requested = await lane("Requested");
    expect(within(requested).getByText("Cat Power · Moon Pix · Matador · CD")).toBeInTheDocument();
    expect(within(requested).getByText("Held for DJ Pat")).toBeInTheDocument();
    expect(within(await lane("Checked out")).getByText("Cat Power · Dark Side · Matador · CD")).toBeInTheDocument();
    expect(within(await lane("Reviewed (1)")).getByText("Cat Power · Moon Pix · Matador · CD")).toBeInTheDocument();
    expect(within(await lane("Filed")).getByText("Cat Power · Moon Pix · Matador · CD")).toBeInTheDocument();
    expect(within(requested).getByRole("link")).toHaveAttribute("href", "/dashboard/admin/intake/2");
  });

  it("puts each state's rows in its own lane only, and reads intake exactly twice", async () => {
    const reads: string[] = [];
    fakeReviewsEndpoints({
      open: [waiting(3, { album_title: "Out" })],
      reviewed: [moonPix({ id: 4, album_title: "Done", state: "reviewed", effective_state: "reviewed" })],
      filed: [moonPix({ id: 5, album_title: "Shelved", state: "filed", effective_state: "filed" })],
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        reads.push(new URL(request.url).search);
      }),
    );

    renderWithProviders(<IntakeLanes />);

    const where = { "Checked out": "Out", "Reviewed (1)": "Done", Filed: "Shelved" };
    for (const [name, album] of Object.entries(where)) {
      const region = await lane(name);
      for (const other of Object.values(where)) {
        const check = expect(within(region).queryByText(new RegExp(other)));
        if (other === album) check.toBeInTheDocument();
        else check.not.toBeInTheDocument();
      }
    }
    expect(within(await lane("Requested")).queryByRole("link")).not.toBeInTheDocument();
    expect([...reads].sort()).toEqual(["", "?awaiting_acceptance=true"]);
  });

  it("renders no Review waiting lane when only open records are served", async () => {
    fakeReviewsEndpoints({ open: [moonPix()] });

    renderWithProviders(<IntakeLanes />);

    await lane("Filed");
    expect(screen.queryByRole("region", { name: /Review waiting/ })).not.toBeInTheDocument();
  });

  // A waiting review as the item's reviews read serves it.
  const waitingReview = (id: number, itemId: number, overrides = {}) =>
    review({ id, intake_item_id: itemId, status: "submitted", author: "Jessica Pratt", author_user_id: "dj-jess", add_date: "2026-10-01", ...overrides });

  it.each([
    ["the author is the DJ who has the record", { checked_out_by: "dj-jess", checked_out_by_name: "Jessica Pratt" }, "From Jessica Pratt, who has this record."],
    ["someone else wrote it and a DJ has the record", {}, "From Jessica Pratt. The record is with DJ Sam."],
    [
      "someone else wrote it and a request is open",
      { state: "requested", effective_state: "requested", requested_dj_id: "dj-pat", requested_dj_name: "DJ Pat", checked_out_by: null, checked_out_by_name: null },
      "From Jessica Pratt. The record is being held for DJ Pat.",
    ],
    [
      "someone else wrote it and the record is on the review shelf",
      { state: "pool", effective_state: "pool", checked_out_by: null, checked_out_by_name: null },
      "From Jessica Pratt. The record is on the review shelf.",
    ],
    [
      "someone else wrote it and the holder's account was removed",
      { checked_out_by: null, checked_out_by_name: null, checked_out_at: "2026-09-20T12:00:00Z" },
      "From Jessica Pratt. The record is checked out; holder removed.",
    ],
  ])("says who a waiting review is from when %s", async (_label, itemOverrides, line) => {
    const item = waiting(7, itemOverrides);
    fakeReviewsEndpoints({ open: [item], awaiting: [item], forItem: { "7": [waitingReview(70, 7)] } });

    renderWithProviders(<IntakeLanes />);

    const waitingLane = await lane("Review waiting (1)");
    expect(await within(waitingLane).findByText(line)).toBeInTheDocument();
    expect(within(waitingLane).queryByText(/review$|reviews$|more$/)).not.toBeInTheDocument();
  });

  it("names the newest waiting review and counts the rest as +n more, leaving out drafts and the review on the cover", async () => {
    const item = waiting(7, { submitted_review_count: 4, accepted_review_id: 73 });
    fakeReviewsEndpoints({
      open: [item],
      awaiting: [item],
      forItem: {
        "7": [
          waitingReview(70, 7, { author: "Sessa", add_date: "2026-10-01" }),
          waitingReview(71, 7, { author: "Cat Power", add_date: "2026-10-05" }),
          waitingReview(72, 7, { author: "Nilüfer Yanya", status: "draft", add_date: "2026-10-09" }),
          waitingReview(73, 7, { author: "Stereolab", add_date: "2026-10-08" }),
        ],
      },
    });

    renderWithProviders(<IntakeLanes />);

    const waitingLane = await lane("Review waiting (1)");
    expect(await within(waitingLane).findByText("From Cat Power. The record is with DJ Sam.")).toBeInTheDocument();
    expect(within(waitingLane).getByText("+1 more")).toBeInTheDocument();
    expect(within(waitingLane).queryByText(/Sessa|Nilüfer|Stereolab/)).not.toBeInTheDocument();
  });

  describe("a Review waiting row before its reviews are read", () => {
    const REVIEWS_URL = `${TEST_BACKEND_URL}/reviews`;

    it.each([
      ["a DJ has the record", {}, "Checked out to DJ Sam"],
      [
        "a request is open",
        { state: "requested", effective_state: "requested", requested_dj_id: "dj-pat", requested_dj_name: "DJ Pat", checked_out_by: null, checked_out_by_name: null },
        "Held for DJ Pat",
      ],
      ["the record is on the review shelf", { state: "pool", effective_state: "pool", checked_out_by: null, checked_out_by_name: null }, "On the review shelf"],
      ["the holder's account was removed", { checked_out_by: null, checked_out_by_name: null, checked_out_at: "2026-09-20T12:00:00Z" }, "Holder removed"],
    ])("shows the location line while the read is in flight, then the From line, when %s", async (_label, itemOverrides, location) => {
      const item = waiting(7, itemOverrides);
      fakeReviewsEndpoints({ open: [item], awaiting: [item] });
      const read = holdResponse("get", REVIEWS_URL, () => HttpResponse.json([waitingReview(70, 7)]));

      renderWithProviders(<IntakeLanes />);

      const waitingLane = await lane("Review waiting (1)");
      expect(within(waitingLane).getByText(location)).toBeInTheDocument();
      expect(within(waitingLane).queryByText(/^From /)).not.toBeInTheDocument();

      read.release();
      await read.answered;
      expect(await within(waitingLane).findByText(/^From Jessica Pratt/)).toBeInTheDocument();
      expect(within(waitingLane).queryByText(location)).not.toBeInTheDocument();
    });

    it("keeps the location line when the read fails", async () => {
      const item = waiting(7);
      fakeReviewsEndpoints({ open: [item], awaiting: [item] });
      server.use(http.get(REVIEWS_URL, () => HttpResponse.json({ message: "down" }, { status: 500 })));

      const { store } = renderWithProviders(<IntakeLanes />);

      const waitingLane = await lane("Review waiting (1)");
      await reviewsSettled(store);
      expect(within(waitingLane).getByText("Checked out to DJ Sam")).toBeInTheDocument();
      expect(within(waitingLane).queryByText(/^From /)).not.toBeInTheDocument();
    });
  });

  it("marks the record in its physical lane and leaves the location line there", async () => {
    const item = waiting(7);
    fakeReviewsEndpoints({ open: [item], awaiting: [item], forItem: { "7": [waitingReview(70, 7)] } });

    renderWithProviders(<IntakeLanes />);

    const checkedOut = await lane("Checked out");
    expect(within(checkedOut).getByText("review waiting")).toBeInTheDocument();
    expect(within(checkedOut).getByText("Checked out to DJ Sam")).toBeInTheDocument();
  });

  it("names a removed holder in the Review waiting lane instead of printing null", async () => {
    const orphan = waiting(9, { checked_out_by: null, checked_out_by_name: null, checked_out_at: "2026-09-20T12:00:00Z" });
    fakeReviewsEndpoints({ open: [orphan], awaiting: [orphan], forItem: { "9": [waitingReview(90, 9)] } });

    renderWithProviders(<IntakeLanes />);

    const lane1 = await lane("Review waiting (1)");
    expect(await within(lane1).findByText("From Jessica Pratt. The record is checked out; holder removed.")).toBeInTheDocument();
    expect(within(lane1).queryByText(/Checked out to/)).not.toBeInTheDocument();
    expect(lane1).not.toHaveTextContent("null");
  });

  it("shows a reviewed record's holder and overdue mark, and none for a returned one", async () => {
    fakeReviewsEndpoints({
      reviewed: [
        moonPix({ id: 1, effective_state: "reviewed", checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam", overdue: true }),
        moonPix({ id: 2, effective_state: "reviewed", checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: null }),
        moonPix({ id: 3, effective_state: "reviewed" }),
      ],
    });

    renderWithProviders(<IntakeLanes />);

    const reviewed = await lane("Reviewed (3)");
    expect(within(reviewed).getByText("Still out: checked out to DJ Sam")).toBeInTheDocument();
    expect(within(reviewed).getByText("Still out: holder removed")).toBeInTheDocument();
    expect(within(reviewed).getAllByText(/^Still out/)).toHaveLength(2);
    expect(within(reviewed).getAllByRole("button", { name: "Mark as returned" })).toHaveLength(2);
    expect(within(reviewed).getAllByText("Overdue")).toHaveLength(1);
  });

  it.each([
    ["Checked out", "the overdue row first", "checked_out", "Checked out"],
    ["Checked out", "the overdue row second", "checked_out", "Checked out"],
    ["Reviewed", "the overdue row first", "reviewed", "Reviewed (2)"],
    ["Reviewed", "the overdue row second", "reviewed", "Reviewed (2)"],
  ])("sorts an overdue row first in the %s lane when the read returns %s", async (_name, readOrder, state, heading) => {
    // The overdue row is the newer-logged, lower-id one, so neither a date nor an id ordering puts it first.
    const row = (id: number, overrides = {}) =>
      moonPix({ id, album_title: `Album ${id}`, state, effective_state: state, checked_out_by: "dj-1", checked_out_by_name: "DJ Sam", checked_out_at: "2026-09-01T12:00:00Z", ...overrides });
    const overdue = row(1, { logged_at: "2026-09-02T12:00:00Z", overdue: true });
    const onTime = row(2, { logged_at: "2026-09-01T12:00:00Z" });
    const read = readOrder === "the overdue row first" ? [overdue, onTime] : [onTime, overdue];
    fakeReviewsEndpoints();
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get("awaiting_acceptance") === "true" ? [] : read),
      ),
    );

    renderWithProviders(<IntakeLanes />);

    const links = within(await lane(heading)).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([expect.stringContaining("Album 1"), expect.stringContaining("Album 2")]);
  });

  it("counts the Reviewed lane's rows in its heading, and drops it on a refetch when a record is filed", async () => {
    let filed = false;
    const reviewed = (id: number, overrides = {}) => moonPix({ id, album_title: `Album ${id}`, state: "reviewed", effective_state: "reviewed", checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam", ...overrides });
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
        moonPix({ id: 1, logged_at: "2026-09-02T12:00:00Z", artist_name: "Juana Molina", album_title: "DOGA", passes: [pass("Pat", "2026-10-01T12:00:00Z")] }),
        moonPix({ id: 2, logged_at: "2026-09-01T12:00:00Z", artist_name: "Stereolab", album_title: "Aluminum Tunes", passes: [pass("Sam", "2026-10-03T12:00:00Z")] }),
      ],
    });

    const { unmount } = renderWithProviders(<IntakeLanes />);

    const band = await screen.findByRole("region", { name: "Recent passes" });
    expect(within(within(band).getByRole("list")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Sam passed on Stereolab — Aluminum Tunes",
      "Pat passed on Juana Molina — DOGA",
    ]);
    expect(band.closest("[role=status]")).toBeNull();
    expect(band.querySelector("[role=status]")).toBeNull();
    // The band sits at the top of the page, above the first lane.
    const first = screen.getByRole("region", { name: "Requested" });
    expect(band.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    fakeReviewsEndpoints({ open: [moonPix({ id: 1, passes: [] })] });
    renderWithProviders(<IntakeLanes />);
    await lane("Filed");
    expect(screen.queryByRole("region", { name: "Recent passes" })).not.toBeInTheDocument();
  });

  it("Mark as returned sends the release, and the record stays in Reviewed without its line", async () => {
    let returned = false;
    const holder = { checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam" };
    fakeReviewsEndpoints({ reviewed: () => [moonPix({ id: 11, effective_state: "reviewed", ...(returned ? {} : holder) })] });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => {
        returned = true;
        return HttpResponse.json(moonPix({ id: 11 }));
      }),
    );

    const { user } = renderWithProviders(<IntakeLanes />);
    await user.click(await screen.findByRole("button", { name: "Mark as returned" }));

    await waitFor(() => expect(screen.queryByText(/^Still out/)).not.toBeInTheDocument());
    expect(within(await lane("Reviewed (1)")).getByText("Cat Power · Moon Pix · Matador · CD")).toBeInTheDocument();
  });

  const HOLDER = { checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam" };
  const LOST_RACE = "This record has already been returned or filed. The lists have been reloaded.";
  const laneKey = (url: string) => {
    const query = new URL(url).searchParams;
    return query.get("awaiting_acceptance") ? "awaiting" : "unfiltered";
  };

  // The 409's own tag invalidation refetches every read by itself, so only a
  // read that is held pending can tell "reloaded, then noticed" from
  // "noticed" or "reloaded only some reads".
  it.each(["unfiltered", "awaiting"])(
    "a 409 state_changed keeps the row locked and shows no notice while the %s read is still reloading, then shows the approved notice and no server message",
    async (heldLane) => {
      let lost = false;
      let heldReads = 0;
      let otherReads = 0;
      let releaseHeld!: () => void;
      const held = new Promise<void>((resolve) => {
        releaseHeld = resolve;
      });
      fakeReviewsEndpoints({ reviewed: [moonPix({ id: 11, effective_state: "reviewed", ...HOLDER })] });
      server.use(
        http.get(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
          const key = laneKey(request.url);
          if (lost && key === heldLane) {
            heldReads += 1;
            await held;
          } else if (lost) {
            otherReads += 1;
          }
          return HttpResponse.json(key === "unfiltered" ? [moonPix({ id: 11, effective_state: "reviewed", ...HOLDER })] : []);
        }),
        http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => {
          lost = true;
          return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        }),
      );

      const { store, user } = renderWithProviders(<IntakeLanes />);
      const returned = await screen.findByRole("button", { name: "Mark as returned" });
      await user.click(returned);

      // Assert during the hold, once every read the case depends on has started and only the held one is outstanding:
      // the other lane's read has answered, so a notice that waited for only some reloads would already show.
      await waitFor(() => expect(heldReads).toBeGreaterThan(0));
      await waitFor(() => expect(otherReads).toBeGreaterThan(0));
      await waitFor(() => expect(pendingCount(store)).toBe(1));
      await renderedFrame();
      expect(screen.queryByText(LOST_RACE)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mark as returned" })).toBeDisabled();

      releaseHeld();
      expect(await screen.findByText(LOST_RACE)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("button", { name: "Mark as returned" })).toBeEnabled());
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
    },
  );

  it("clears the lost-race notice when the next row action starts", async () => {
    let releasedSecond = false;
    let releaseSecondWrite!: () => void;
    const secondWrite = new Promise<void>((resolve) => {
      releaseSecondWrite = resolve;
    });
    fakeReviewsEndpoints({
      reviewed: [
        moonPix({ id: 11, album_title: "Dark Side", effective_state: "reviewed", ...HOLDER }),
        moonPix({ id: 12, effective_state: "reviewed", ...HOLDER }),
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
    fakeReviewsEndpoints({ reviewed: [moonPix({ id: 11, effective_state: "reviewed", checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam" })] });
    const { user } = renderWithProviders(<IntakeLanes />);
    const button = await screen.findByRole("button", { name: "Mark as returned" });

    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })),
      http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => HttpResponse.json(moonPix({ id: 11 }))),
    );
    await user.click(button);

    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(await lane("Reviewed (1)")).getByText(/Cat Power · Moon Pix/)).toBeInTheDocument();
  });

  it("shows the load-failure line when a first load fails", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<IntakeLanes />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("still shows the FCC notes to confirm when an intake read fails", async () => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [fccNote({ id: 1, intake_item_id: 5 })] });
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<IntakeLanes />);

    expect(await screen.findByRole("region", { name: "FCC notes to confirm (1)" })).toBeInTheDocument();
    expect(await screen.findByText(REVIEW_COPY.screen.loadFailed)).toBeInTheDocument();
  });
});

const HELD = { checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam" };
const requestedRow = (id: number) =>
  moonPix({ id, state: "requested", effective_state: "requested", requested_dj_id: "dj-pat", requested_dj_name: "DJ Pat" });
const outRow = (id: number, overrides = {}) =>
  moonPix({ id, state: "checked_out", effective_state: "checked_out", ...HELD, ...overrides });

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

    await waitFor(() => expect(within(screen.getByRole("region", { name: "Requested" })).queryByRole("button")).not.toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "Requested" })).queryByText(/Moon Pix/)).not.toBeInTheDocument();
  });

  it("releases a checkout, including one whose holder was removed", async () => {
    const released: string[] = [];
    fakeReviewsEndpoints({
      open: () => [outRow(11, released.includes("11") ? { effective_state: "pool", state: "pool", checked_out_at: null, checked_out_by: null } : {}), outRow(12, { checked_out_by: null, checked_out_by_name: null })],
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/release`, ({ params }) => {
        released.push(String(params.id));
        return HttpResponse.json(moonPix({ id: Number(params.id) }));
      }),
    );

    const { user } = renderWithProviders(<IntakeLanes />);
    const checkedOut = await lane("Checked out");
    expect(within(checkedOut).getByText("Holder removed")).toBeInTheDocument();
    expect(within(checkedOut).getByText("Checked out to DJ Sam")).toBeInTheDocument();
    expect(within(checkedOut).getAllByRole("button", { name: "Release" })).toHaveLength(2);
    await user.click(within(within(checkedOut).getByText("Holder removed").closest("li")!).getByRole("button", { name: "Release" }));

    await waitFor(() => expect(released).toEqual(["12"]));
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
    ["cancel", "cancel-request", () => ({ open: [requestedRow(11)] }), "Cancel request"],
    ["release", "release", () => ({ open: [outRow(11)] }), "Release"],
    ["return", "release", () => ({ reviewed: [moonPix({ id: 11, effective_state: "reviewed", ...HELD })] }), "Mark as returned"],
  ] as const)(
    "a lost %s reloads both reads, then shows its own line and never the server message",
    async (action, path, rows, button) => {
      let reads = 0;
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

      expect(await screen.findByText(RACE_LINES[action])).toBeInTheDocument();
      expect(reads).toBeGreaterThanOrEqual(2);
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
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "CD" }));
    await user.type(screen.getByLabelText("Discogs release id (optional)"), "123");
    await user.click(screen.getByRole("button", { name: "Log item" }));

    await waitFor(() =>
      expect(body).toEqual({ artist_name: "Cat Power", album_title: "Moon Pix", format_id: 1, discogs_release_id: 123 }),
    );
  });
});

describe("IntakeLanes as the music directors' tab", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff"));
  afterEach(() => vi.unstubAllEnvs());

  it("shows the director lanes in the order a record moves, with no review shelf lane and no logging form", async () => {
    const row = (id: number, state: string, overrides = {}) =>
      moonPix({ id, album_title: `Album ${id}`, state, effective_state: state, ...overrides });
    const waitingRow = row(1, "checked_out", HELD);
    fakeReviewsEndpoints({
      open: [waitingRow, requestedRow(2), row(3, "checked_out", HELD), moonPix({ id: 6, album_title: "Album 6" })],
      awaiting: [waitingRow],
      reviewed: [row(4, "reviewed", HELD)],
      filed: [row(5, "filed", HELD)],
    });

    renderWithProviders(<IntakeLanes />);

    await lane("Filed");
    const names = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label") ?? "");
    expect(names.filter((n) => /^(Review waiting|Requested|Checked out|Reviewed|Filed)/.test(n))).toEqual([
      "Review waiting (1)",
      "Requested",
      "Checked out",
      "Reviewed (1)",
      "Filed",
    ]);
    expect(screen.queryByRole("region", { name: "On the review shelf" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Log an item" })).not.toBeInTheDocument();
  });
});
