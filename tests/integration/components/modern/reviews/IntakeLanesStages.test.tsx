import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, heldBy, intakeItem, renderWithProviders, requestedFor, renderedFrame, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
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
  return createNavigationModuleMock(
    { push: vi.fn(), replace: vi.fn() },
    { pathname: "/dashboard/reviews/music-directors", search: () => useSyncExternalStore(subscribe, () => url.search) },
  );
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { toast } from "sonner";
import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const COPY = REVIEW_COPY.intake;
const REVIEWERS = [
  { id: "dj-sam", name: "DJ Sam" },
  { id: "dj-pat", name: "Pat Placeholder" },
];
// Every spec runs on this clock (faked in `beforeEach`), so the Filed stage's 30-day cut never depends on today's date.
const NOW = new Date("2026-10-17T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

// One record per stage, plus a second one in Review waiting that nobody holds: it is drawn there only.
const SHELF_OLD = intakeItem({ id: 1, artist_name: "Duke Ellington & John Coltrane", album_title: "In a Sentimental Mood", logged_at: "2026-09-01T12:00:00Z" });
const SHELF_NEW = intakeItem({ id: 2, artist_name: "Juana Molina", album_title: "DOGA", logged_at: "2026-09-10T12:00:00Z" });
const REQUESTED = intakeItem({ id: 3, artist_name: "Jessica Pratt", album_title: "On Your Own Love Again", state: "requested", effective_state: "requested", ...requestedFor("dj-sam", "DJ Sam") });
const BEING_REVIEWED = intakeItem({ id: 4, artist_name: "Stereolab", album_title: "Aluminum Tunes", state: "checked_out", effective_state: "checked_out", ...heldBy("dj-sam", "DJ Sam") });
const WAITING_HELD = intakeItem({ id: 5, artist_name: "Cat Power", album_title: "Moon Pix", state: "checked_out", effective_state: "checked_out", submitted_review_count: 1, accepted_review_id: null, ...heldBy("dj-sam", "DJ Sam") });
const WAITING_POOL = intakeItem({ id: 6, artist_name: "Chuquimamani-Condori", album_title: "Edits", submitted_review_count: 1, accepted_review_id: null });
const REVIEWED = intakeItem({ id: 7, artist_name: "Sessa", album_title: "Pequena Vertigem de Amor", state: "reviewed", effective_state: "reviewed", accepted_review_id: 70, submitted_review_count: 1, ...heldBy("dj-sam", "DJ Sam") });
const FILED = intakeItem({ id: 8, artist_name: "Hermanos Gutiérrez", album_title: "El Bueno y el Malo", state: "filed", effective_state: "filed", filed_at: daysAgo(5) });
const EVERYTHING = [SHELF_NEW, SHELF_OLD, REQUESTED, BEING_REVIEWED, WAITING_HELD, WAITING_POOL, REVIEWED, FILED];

const serve = (rows: IntakeItem[], extra = {}) =>
  fakeReviewsEndpoints({
    open: rows.filter((i) => !["reviewed", "filed", "finalized"].includes(i.effective_state)),
    reviewed: rows.filter((i) => i.effective_state === "reviewed"),
    filed: rows.filter((i) => ["filed", "finalized"].includes(i.effective_state)),
    reviewers: REVIEWERS,
    ...extra,
  });

const showStage = (stage: string) => {
  url.search = `?stage=${stage}`;
};
const panel = async (name: string) => screen.findByRole("tabpanel", { name });
const artists = (region: HTMLElement) => within(region).queryAllByRole("listitem").map((li) => within(li).getAllByRole("link")[0].textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  url.search = "";
  mockAuth.authority = Authorization.MD;
  vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.dismiss).mockClear();
  vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, target) => {
    url.search = new URL(String(target), "http://localhost").search;
    url.listeners.forEach((listener) => listener());
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.mocked(window.history.replaceState).mockRestore();
});

describe("IntakeLanes stage chips", () => {
  it.each([
    [0, COPY.onShelf, 2],
    [1, COPY.requested, 1],
    [2, COPY.beingReviewed, 1],
    [3, COPY.waiting, 2],
    [4, COPY.reviewed, 1],
    [5, COPY.filed, 1],
  ])("draws chip %i as a tab named %s with a count of %i, and a record with a waiting review is counted only under Review waiting", async (index, label, count) => {
    serve(EVERYTHING);
    renderWithProviders(<IntakeLanes />);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs).toHaveLength(6);
    expect(tabs[index]).toHaveAccessibleName(`${label}, ${count}`);
    expect(tabs[index]).toHaveAttribute("aria-selected", label === COPY.waiting ? "true" : "false");
  });

  it.each([
    ["one record waiting", EVERYTHING, "", COPY.waiting],
    ["none waiting", [SHELF_OLD, BEING_REVIEWED], "", COPY.beingReviewed],
    ["a stage in the address", [SHELF_OLD, BEING_REVIEWED], "?stage=filed", COPY.filed],
    ["an unknown stage in the address, with one waiting", EVERYTHING, "?stage=nonsense", COPY.waiting],
    ["an unknown stage in the address, none waiting", [SHELF_OLD, BEING_REVIEWED], "?stage=nonsense", COPY.beingReviewed],
  ])("opens on the right stage with %s", async (_label, rows, search, selected) => {
    serve(rows);
    url.search = search;
    renderWithProviders(<IntakeLanes />);

    expect(await screen.findByRole("tab", { selected: true })).toHaveTextContent(selected);
    expect(await panel(selected)).toBeInTheDocument();
  });

  it("draws the lane headings' counts nowhere: the chip carries them", async () => {
    serve(EVERYTHING);
    renderWithProviders(<IntakeLanes />);

    await panel(COPY.waiting);
    expect(screen.queryByRole("heading", { name: /\(\d+\)/ })).not.toBeInTheDocument();
  });
});

describe("IntakeLanes stage lists", () => {
  // The buttons a row shows, More under its short name, then the last control in the row.
  const controls = (li: HTMLElement) => ({
    buttons: within(li).queryAllByRole("button").map((b) => (b.textContent?.startsWith(COPY.moreButton) ? COPY.moreButton : b.textContent)),
    last: [...li.querySelectorAll("a, button")].at(-1),
  });

  it.each([
    ["review_shelf", COPY.onShelf, [["Duke Ellington & John Coltrane", [COPY.moreButton]], ["Juana Molina", [COPY.moreButton]]]],
    ["requested", COPY.requested, [["Jessica Pratt", [COPY.cancelRequest]]]],
    ["being_reviewed", COPY.beingReviewed, [["Stereolab", [REVIEW_COPY.screen.returnToShelf]]]],
    // The server reads newest id first, and this stage keeps that order.
    ["waiting", COPY.waiting, [["Chuquimamani-Condori", []], ["Cat Power", [COPY.returned]]]],
    ["reviewed", COPY.reviewed, [["Sessa", [COPY.returned]]]],
    ["filed", COPY.filed, [["Hermanos Gutiérrez", []]]],
  ])("lists exactly the records and buttons of %s, with Open last", async (stage, label, expected) => {
    serve(EVERYTHING);
    showStage(stage);
    renderWithProviders(<IntakeLanes />);

    const region = await panel(label);
    await waitFor(() => expect(within(region).getAllByRole("listitem")).toHaveLength(expected.length));
    const rows = within(region).getAllByRole("listitem");
    expect(rows.map((li) => within(li).getAllByRole("link")[0].textContent)).toEqual(expected.map(([artist]) => artist));
    expect(rows.map((li) => controls(li).buttons)).toEqual(expected.map(([, buttons]) => buttons));
    for (const li of rows) {
      const open = within(li).getByRole("link", { name: COPY.open });
      expect(controls(li).last).toBe(open);
      expect(open).toHaveAttribute("href", expect.stringMatching(/^\/dashboard\/admin\/intake\/\d+$/));
    }
    expect(within(region).queryByRole("button", { name: /^Check out|^Take$/ })).not.toBeInTheDocument();
  });

  it("shows Nothing here. in an empty stage", async () => {
    serve([BEING_REVIEWED]);
    showStage("requested");
    renderWithProviders(<IntakeLanes />);

    expect(await within(await panel(COPY.requested)).findByText(COPY.empty)).toBeInTheDocument();
  });

  it.each([
    ["review_shelf", COPY.onShelf, 1],
    ["being_reviewed", COPY.beingReviewed, 0],
  ])("on %s, reads the reviewers only for the stage whose rows ask a DJ", async (stage, label, reads) => {
    let reviewerReads = 0;
    serve(EVERYTHING);
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => {
        reviewerReads += 1;
        return HttpResponse.json({ reviewers: REVIEWERS });
      }),
    );
    showStage(stage);
    renderWithProviders(<IntakeLanes />);

    await within(await panel(label)).findAllByRole("listitem");
    await delay(50);
    expect(reviewerReads).toBe(reads);
  });

  it("lists the review shelf oldest first, each with the date it was added", async () => {
    serve([SHELF_NEW, SHELF_OLD]);
    showStage("review_shelf");
    renderWithProviders(<IntakeLanes />);

    const region = await panel(COPY.onShelf);
    await waitFor(() => expect(artists(region)).toEqual(["Duke Ellington & John Coltrane", "Juana Molina"]));
    expect(within(region).getAllByText(/^Added /)).toHaveLength(2);
  });

  it("asks a DJ from the review shelf with this tab's own write, raising the Asked toast", async () => {
    const asked: string[] = [];
    serve([SHELF_OLD]);
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/1/request`, async ({ request }) => {
        asked.push(((await request.json()) as { dj_id: string }).dj_id);
        return HttpResponse.json({ ...SHELF_OLD, state: "requested", effective_state: "requested" });
      }),
    );
    showStage("review_shelf");
    const { user } = renderWithProviders(<IntakeLanes />);

    await user.click(await screen.findByRole("button", { name: new RegExp(`^${COPY.moreButton}`) }));
    await user.click(await screen.findByRole("menuitem", { name: COPY.askADj }));
    await user.type(await within(await screen.findByRole("dialog")).findByRole("combobox"), "Pat Placeholder");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: COPY.ask }));

    await waitFor(() => expect(asked).toEqual(["dj-pat"]));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(COPY.askDone("Pat Placeholder"), expect.anything()));
  });

  it.each([SHELF_OLD, SHELF_NEW])("names the More button on the review shelf by its record: $artist_name", async (record) => {
    serve([SHELF_NEW, SHELF_OLD]);
    showStage("review_shelf");
    renderWithProviders(<IntakeLanes />);

    const region = await panel(COPY.onShelf);
    const row = (await within(region).findAllByRole("listitem")).find((li) => within(li).getAllByRole("link")[0].textContent === record.artist_name)!;
    expect(within(row).getByRole("button", { name: new RegExp(`^${COPY.moreButton}`) })).toHaveAccessibleName(`${COPY.moreButton} ${record.artist_name} ${record.album_title}`);
  });

  it("keeps the Asked toast when another chip is chosen, and dismisses it only when the tab goes", async () => {
    vi.mocked(toast).mockReturnValueOnce("asked-toast");
    serve([SHELF_OLD, BEING_REVIEWED]);
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/1/request`, () => HttpResponse.json({ ...SHELF_OLD, state: "requested", effective_state: "requested" })),
    );
    showStage("review_shelf");
    const { user, unmount } = renderWithProviders(<IntakeLanes />);

    await user.click(await screen.findByRole("button", { name: new RegExp(`^${COPY.moreButton}`) }));
    await user.click(await screen.findByRole("menuitem", { name: COPY.askADj }));
    await user.type(await within(await screen.findByRole("dialog")).findByRole("combobox"), "Pat Placeholder");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: COPY.ask }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(COPY.askDone("Pat Placeholder"), expect.anything()));

    await user.click(screen.getByRole("tab", { name: new RegExp(`^${COPY.beingReviewed},`) }));
    expect(await panel(COPY.beingReviewed)).toBeInTheDocument();
    expect(toast.dismiss).not.toHaveBeenCalled();

    unmount();
    expect(vi.mocked(toast.dismiss).mock.calls).toEqual([["asked-toast"]]);
  });

  it.each([
    ["a 400, the approved line and a fresh read of the reviewers", { status: 400, body: { message: "server words" } }],
    ["a 409 state_changed, the lost-race notice", { status: 409, body: { message: "server words", reason: "state_changed" } }],
  ])("answers a refused request with %s", async (_label, refusal) => {
    let reviewerReads = 0;
    serve([SHELF_OLD]);
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => {
        reviewerReads += 1;
        return HttpResponse.json({ reviewers: REVIEWERS });
      }),
      http.post(`${TEST_BACKEND_URL}/intake/1/request`, () => HttpResponse.json(refusal.body, { status: refusal.status })),
    );
    showStage("review_shelf");
    const { user } = renderWithProviders(<IntakeLanes />);

    await user.click(await screen.findByRole("button", { name: new RegExp(`^${COPY.moreButton}`) }));
    await user.click(await screen.findByRole("menuitem", { name: COPY.askADj }));
    await user.type(await within(await screen.findByRole("dialog")).findByRole("combobox"), "Pat Placeholder");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: COPY.ask }));

    if (refusal.status === 400) {
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(COPY.requestRefused));
      await waitFor(() => expect(reviewerReads).toBe(2));
    } else {
      expect(await screen.findByRole("status")).toHaveTextContent(COPY.raceRequest);
    }
    expect(toast.error).not.toHaveBeenCalledWith("server words");
  });

  it("shows a record filed 29 days ago, hides one filed 31 days ago and one with no filing time until Show older, newest first, finalized included", async () => {
    serve([
      { ...FILED, id: 20, artist_name: "Stereolab", filed_at: daysAgo(29) },
      { ...FILED, id: 21, artist_name: "Juana Molina", filed_at: daysAgo(31) },
      { ...FILED, id: 22, artist_name: "Cat Power", filed_at: null },
      { ...FILED, id: 23, artist_name: "Jessica Pratt", state: "finalized", effective_state: "finalized", filed_at: daysAgo(2) },
    ]);
    showStage("filed");
    const { user } = renderWithProviders(<IntakeLanes />);

    const region = await panel(COPY.filed);
    await waitFor(() => expect(artists(region)).toEqual(["Jessica Pratt", "Stereolab"]));
    expect(screen.getByRole("tab", { name: `${COPY.filed}, 2` })).toBeInTheDocument();

    await user.click(within(region).getByRole("button", { name: COPY.showOlder }));

    expect(artists(region)).toEqual(["Jessica Pratt", "Stereolab", "Juana Molina", "Cat Power"]);
    expect(within(region).queryByRole("button", { name: COPY.showOlder })).not.toBeInTheDocument();
  });

  // The chip counts what the stage opens to: the records filed in the last 30 days, from both filed reads, not every row those reads return.
  it.each([
    ["every record is recent", [{ age: 1 }, { age: 29, state: "finalized" }], 2],
    ["some are older or have no filing time", [{ age: 1 }, { age: 29 }, { age: 31 }, { age: 400, state: "finalized" }, { age: null }], 2],
    ["none is recent", [{ age: 31 }, { age: 90, state: "finalized" }, { age: null }], 0],
  ] as const)("counts only the records filed in the last 30 days on the Filed chip when %s", async (_label, filed, expected) => {
    serve(
      filed.map((f, index) => {
        const state = "state" in f ? f.state : "filed";
        return { ...FILED, id: 30 + index, state, effective_state: state, filed_at: f.age === null ? null : daysAgo(f.age) };
      }),
    );
    renderWithProviders(<IntakeLanes />);

    expect(await screen.findByRole("tab", { name: `${COPY.filed}, ${expected}` })).toBeInTheDocument();
  });

  it("offers no Show older when every filed record is recent", async () => {
    serve([FILED]);
    showStage("filed");
    renderWithProviders(<IntakeLanes />);

    await waitFor(() => expect(artists(screen.getByRole("tabpanel"))).toEqual(["Hermanos Gutiérrez"]));
    expect(screen.queryByRole("button", { name: COPY.showOlder })).not.toBeInTheDocument();
  });
});

describe("IntakeLanes reads", () => {
  const FILED_READ = "?state=filed&limit=100";
  const FINALIZED_READ = "?state=finalized&limit=100";
  let reads: string[];
  const record = () => {
    reads = [];
    // Returns nothing, so the fake answers after this notes the request.
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        reads.push(new URL(request.url).search);
      }),
    );
  };

  it("reads the active records once and each filed state, newest hundred, once", async () => {
    serve(EVERYTHING);
    record();
    renderWithProviders(<IntakeLanes />);

    await panel(COPY.waiting);
    await waitFor(() => expect(reads.slice().sort()).toEqual(["?active=true", FILED_READ, FINALIZED_READ].sort()));
  });

  it("merges the two filed reads, newest filed first, with a Filed line on each and none on a record with no filing time", async () => {
    serve([
      { ...FILED, id: 20, artist_name: "Stereolab", filed_at: "2026-10-08T16:00:00Z" },
      { ...FILED, id: 21, artist_name: "Cat Power", filed_at: null },
      { ...FILED, id: 22, artist_name: "Jessica Pratt", state: "finalized", effective_state: "finalized", filed_at: "2026-10-12T16:00:00Z" },
    ]);
    showStage("filed");
    const { user } = renderWithProviders(<IntakeLanes />);

    const region = await panel(COPY.filed);
    await user.click(await within(region).findByRole("button", { name: COPY.showOlder }));
    await waitFor(() => expect(artists(region)).toEqual(["Jessica Pratt", "Stereolab", "Cat Power"]));
    const rows = within(region).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Filed Oct 12");
    expect(rows[1]).toHaveTextContent("Filed Oct 8");
    expect(rows[2]).not.toHaveTextContent("Filed");
  });

  it("puts a record pre-dating the clock's year with its year in the Filed line", async () => {
    serve([{ ...FILED, filed_at: "2025-10-08T16:00:00Z" }]);
    showStage("filed");
    const { user } = renderWithProviders(<IntakeLanes />);

    const region = await panel(COPY.filed);
    await user.click(await within(region).findByRole("button", { name: COPY.showOlder }));
    expect(within(region).getByRole("listitem")).toHaveTextContent("Filed Oct 8, 2025");
  });

  // A write's own tag invalidation refetches all three reads by itself, so only a read held pending can tell a reload that waits for it from one that does not.
  // The 409 notice is shown once every list has reloaded, so it must stay away, and the row stay locked, while any one of the three is still in flight.
  it.each([
    ["the active read", "?active=true"],
    ["the filed read", FILED_READ],
    ["the finalized read", FINALIZED_READ],
  ])("keeps the row locked and shows no notice after a write while %s is still reloading, then shows the notice once it answers", async (_label, heldSearch) => {
    let lost = false;
    let held = 0;
    let answer!: () => void;
    const hold = new Promise<void>((resolve) => {
      answer = resolve;
    });
    serve(EVERYTHING);
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/7/release`, () => {
        lost = true;
        return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
      }),
      http.get(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        if (lost && new URL(request.url).search === heldSearch) {
          held += 1;
          await hold;
        }
        return undefined;
      }),
    );
    showStage("reviewed");
    const { user } = renderWithProviders(<IntakeLanes />);

    await user.click(await screen.findByRole("button", { name: COPY.returned }));
    await waitFor(() => expect(held).toBeGreaterThan(0));
    await renderedFrame();
    expect(screen.queryByText(COPY.raceReleased)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.returned })).toBeDisabled();

    answer();
    expect(await screen.findByText(COPY.raceReleased)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: COPY.returned })).toBeEnabled());
  });

  it.each([
    ["a filed record is not in", { ...FILED, passes: [{ dj_name: "Sam", passed_at: "2026-10-01T10:00:00Z" }] }, false],
    ["an active record is in", { ...SHELF_OLD, passes: [{ dj_name: "Sam", passed_at: "2026-10-01T10:00:00Z" }] }, true],
  ])("Recent passes: a pass on %s", async (_label, row, present) => {
    serve([row]);
    renderWithProviders(<IntakeLanes />);

    await screen.findAllByRole("tab");
    await waitFor(() => expect(screen.queryByText(/Sam passed on/) !== null).toBe(present));
  });

  it("shows the alert in the Filed stage when a filed read fails, while the other stages render", async () => {
    serve(EVERYTHING);
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => (new URL(request.url).search === FILED_READ ? HttpResponse.json({ message: "boom" }, { status: 500 }) : undefined)));
    showStage("filed");
    renderWithProviders(<IntakeLanes />);

    expect(await within(await panel(COPY.filed)).findByRole("alert")).toHaveTextContent(REVIEW_COPY.screen.loadFailed);
    expect(await screen.findByRole("tab", { name: `${COPY.waiting}, 2` })).toBeInTheDocument();
  });
});
