import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, heldBy, intakeItem, renderWithProviders, requestedFor, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
}));

const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() }, { pathname: "/dashboard/reviews/music-directors", search: () => url.search });
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
  url.search = "";
  mockAuth.authority = Authorization.MD;
  vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
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
  // The buttons a row shows, Ask a DJ… under its short name, then the last control in the row.
  const controls = (li: HTMLElement) => ({
    buttons: within(li).queryAllByRole("button").map((b) => (b.textContent?.startsWith(COPY.askADj) ? COPY.askADj : b.textContent)),
    last: [...li.querySelectorAll("a, button")].at(-1),
  });

  it.each([
    ["review_shelf", COPY.onShelf, [["Duke Ellington & John Coltrane", [COPY.askADj]], ["Juana Molina", [COPY.askADj]]]],
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

    await user.click(await screen.findByRole("button", { name: new RegExp(`^${COPY.askADj}`) }));
    await user.type(await within(await screen.findByRole("dialog")).findByRole("combobox"), "Pat Placeholder");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: COPY.ask }));

    await waitFor(() => expect(asked).toEqual(["dj-pat"]));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(COPY.askDone("Pat Placeholder"), expect.anything()));
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

    await user.click(await screen.findByRole("button", { name: new RegExp(`^${COPY.askADj}`) }));
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
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
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
    expect(screen.getByRole("tab", { name: `${COPY.filed}, 4` })).toBeInTheDocument();

    await user.click(within(region).getByRole("button", { name: COPY.showOlder }));

    expect(artists(region)).toEqual(["Jessica Pratt", "Stereolab", "Juana Molina", "Cat Power"]);
    expect(within(region).queryByRole("button", { name: COPY.showOlder })).not.toBeInTheDocument();
  });

  it("offers no Show older when every filed record is recent", async () => {
    serve([FILED]);
    showStage("filed");
    renderWithProviders(<IntakeLanes />);

    await waitFor(() => expect(artists(screen.getByRole("tabpanel"))).toEqual(["Hermanos Gutiérrez"]));
    expect(screen.queryByRole("button", { name: COPY.showOlder })).not.toBeInTheDocument();
  });
});
