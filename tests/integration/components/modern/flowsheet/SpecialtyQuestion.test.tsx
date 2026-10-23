import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { SpecialtyShow } from "@wxyc/shared";
import SpecialtyQuestion from "@/src/components/experiences/modern/flowsheet/SpecialtyQuestion";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { CLOSED_SHOW_SENTENCE } from "@/lib/features/show-playlist/api";
import {
  REJECTED_PROGRAM_SENTENCE,
  SHOW_DETAILS_REFUSED_SENTENCE,
  specialtyCopy,
} from "@/lib/features/specialty/copy";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

const mockUseShowControl = vi.fn();
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => mockUseShowControl(),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}));

// Sunday 2026-10-18 is EDT (UTC-4).
const SUNDAY_NOON_EDT = "2026-10-18T16:30:00Z";
const SUNDAY_4PM_EDT = "2026-10-18T20:05:00Z";
const MONDAY_NOON_EDT = "2026-10-19T16:30:00Z";

const ORANGE_COUNTY = SEED_CATALOG[0];

type OpenShow = { id: number; start_time: string; specialty: SpecialtyShow | null };

let openShow: OpenShow | null;
let onAirDj: string;
let newestEntryId: number;
let flowsheetFetches: number;
let catalog: SpecialtyShow[];
let patches: Array<{ id: string; body: unknown }>;
let patchRefusal: { status: number; body: Record<string, string> } | null;

function serve() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () => {
      flowsheetFetches += 1;
      return HttpResponse.json({
        entries: [
          {
            id: newestEntryId,
            play_order: newestEntryId,
            show_id: openShow?.id ?? 7,
            request_flag: false,
            entry_type: "track",
            artist_name: "Juana Molina",
            album_title: "DOGA",
            track_title: "la paradoja",
            record_label: "Sonamos",
            rotation_play_freq: null,
            add_time: SUNDAY_NOON_EDT,
          },
        ],
        page: 0,
        limit: 1,
        total: 1,
        total_pages: 1,
        on_air: openShow ? { dj_name: onAirDj, show_id: openShow.id } : null,
        shows: openShow ? [openShow] : [],
      });
    }),
    http.get(`${TEST_BACKEND_URL}/specialty-shows`, () =>
      HttpResponse.json(catalog)
    ),
    http.patch(
      `${TEST_BACKEND_URL}/flowsheet/shows/:id`,
      async ({ params, request }) => {
        patches.push({ id: String(params.id), body: await request.json() });
        return patchRefusal
          ? HttpResponse.json(patchRefusal.body, { status: patchRefusal.status })
          : HttpResponse.json({ id: Number(params.id) });
      }
    )
  );
}

function setOpenShow(overrides: Partial<OpenShow> | null) {
  openShow = overrides && { id: 7, start_time: SUNDAY_NOON_EDT, specialty: null, ...overrides };
  serve();
}

async function renderQuestion() {
  const view = renderWithProviders(<SpecialtyQuestion />);
  await screen.findByText(/is usually/, {}, { timeout: 3000 });
  return view;
}

async function renderSilent() {
  const view = renderWithProviders(<SpecialtyQuestion />);
  await waitFor(() => expect(view.store.getState().flowsheetApi.queries).not.toEqual({}));
  await new Promise((r) => setTimeout(r, 150));
  return view;
}

const yes = (name: string) => screen.getByRole("button", { name: `Yes, it's ${name}` });

describe("SpecialtyQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The global setup stubs localStorage with inert fns; back them with a map.
    const stored = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation((key) => stored.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      stored.set(key, value);
    });
    mockUseShowControl.mockReturnValue({ live: true, currentShow: 7 });
    onAirDj = "DJ Test";
    flowsheetFetches = 0;
    newestEntryId = 100;
    catalog = SEED_CATALOG;
    patches = [];
    patchRefusal = null;
    setOpenShow({});
  });

  it("asks about an untagged set that opened in a slot, naming the slot in station time", async () => {
    await renderQuestion();

    expect(
      screen.getByText(
        "Sunday at noon is usually Orange County Special. Is this set Orange County Special?"
      )
    ).toBeInTheDocument();
    expect(yes("Orange County Special")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not this time" })).toBeInTheDocument();
    expect(screen.getByText("Orange County Special, every week.")).toBeInTheDocument();
    expect(screen.getByTestId("specialty-tile")).toBeInTheDocument();
  });

  it("shows the program's logo instead of the text tile when it has one", async () => {
    catalog = [
      {
        ...ORANGE_COUNTY,
        artwork: { square_url: "https://example.org/ocs.png" } as SpecialtyShow["artwork"],
      },
    ];
    setOpenShow({});
    await renderQuestion();

    expect(document.querySelector('img[src="https://example.org/ocs.png"]')).not.toBeNull();
    expect(screen.queryByTestId("specialty-tile")).not.toBeInTheDocument();
  });

  it.each([
    ["a tagged set", { specialty: ORANGE_COUNTY }],
    ["a set outside every slot", { start_time: MONDAY_NOON_EDT }],
  ])("does not ask about %s", async (_label, overrides) => {
    setOpenShow(overrides);
    await renderSilent();

    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
  });

  it("does not ask when nobody is on air", async () => {
    setOpenShow(null);
    await renderSilent();

    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
  });

  // Acceptance criterion 7: the question belongs to the set, not to the DJ who
  // opened it. The hook reports live for any DJ on the set, so a co-host is
  // simulated by the on-air DJ being someone else.
  it.each([
    ["sees the question on an untagged set", {}, true],
    ["does not see it on a tagged set", { specialty: ORANGE_COUNTY }, false],
  ])("a co-host %s", async (_label, overrides, asks) => {
    onAirDj = "The DJ who opened the set";
    setOpenShow(overrides);
    if (asks) {
      await renderQuestion();
    } else {
      await renderSilent();
      expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
    }
  });

  it("does not ask a DJ who is not on the set", async () => {
    mockUseShowControl.mockReturnValue({ live: false, currentShow: 7 });
    renderWithProviders(<SpecialtyQuestion />);
    await new Promise((r) => setTimeout(r, 150));

    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
  });

  it("offers both programs of a shared slot in catalog order, each yes sending its own id", async () => {
    setOpenShow({ start_time: SUNDAY_4PM_EDT });
    const { user } = await renderQuestion();

    expect(
      screen.getByText(
        "Sunday at 4:00 PM is usually HyperLocal or Backyard BBQ. Is this set one of them?"
      )
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^Yes, it's/ }).map((b) => b.textContent)
    ).toEqual(["Yes, it's HyperLocal", "Yes, it's Backyard BBQ"]);

    await user.click(yes("Backyard BBQ"));

    await waitFor(() => expect(patches).toEqual([{ id: "7", body: { specialty_id: 3 } }]));
  });

  it("confirms a yes, then sends the week's title as show_name on Done", async () => {
    const { user } = await renderQuestion();

    await user.click(yes("Orange County Special"));
    await user.type(await screen.findByLabelText("Title for this week"), "Cat Power night");
    await user.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(patches).toEqual([
        { id: "7", body: { specialty_id: 1 } },
        { id: "7", body: { show_name: "Cat Power night" } },
      ])
    );
    expect(screen.queryByLabelText("Title for this week")).not.toBeInTheDocument();
  });

  it("words a refused title save as the show-details sentence, not the program one", async () => {
    const { user } = await renderQuestion();

    await user.click(yes("Orange County Special"));
    await user.type(await screen.findByLabelText("Title for this week"), "Cat Power night");
    patchRefusal = { status: 400, body: { message: "Bad show_name" } };
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(SHOW_DETAILS_REFUSED_SENTENCE);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("sends nothing more when Done closes an empty title", async () => {
    const { user } = await renderQuestion();

    await user.click(yes("Orange County Special"));
    await user.click(await screen.findByRole("button", { name: "Done" }));

    expect(patches).toEqual([{ id: "7", body: { specialty_id: 1 } }]);
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  it("closes the confirmation when the next row is logged, sending no title", async () => {
    const { user, store } = await renderQuestion();
    await user.click(yes("Orange County Special"));
    await screen.findByLabelText("Title for this week");

    newestEntryId = 101;
    store.dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));

    await waitFor(() =>
      expect(screen.queryByLabelText("Title for this week")).not.toBeInTheDocument()
    );
    expect(patches).toEqual([{ id: "7", body: { specialty_id: 1 } }]);
  });

  it("opens the next show's confirmation with an empty title after one closed unsent", async () => {
    const { user, store } = await renderQuestion();
    await user.click(yes("Orange County Special"));
    await user.type(await screen.findByLabelText("Title for this week"), "Cat Power night");

    newestEntryId = 101;
    store.dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
    await waitFor(() =>
      expect(screen.queryByLabelText("Title for this week")).not.toBeInTheDocument()
    );

    const fetchesBefore = flowsheetFetches;
    setOpenShow({ id: 8 });
    newestEntryId = 102;
    store.dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
    await waitFor(() => expect(flowsheetFetches).toBeGreaterThan(fetchesBefore));
    await new Promise((r) => setTimeout(r, 150));
    await user.click(await screen.findByRole("button", { name: "Yes, it's Orange County Special" }));

    expect(await screen.findByLabelText("Title for this week")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(patches).toEqual([
      { id: "7", body: { specialty_id: 1 } },
      { id: "8", body: { specialty_id: 1 } },
    ]);
  });

  it("does not carry an earlier refusal into the next show's question", async () => {
    patchRefusal = { status: 400, body: { message: "anything" } };
    const { user, store } = await renderQuestion();
    await user.click(yes("Orange County Special"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Not this time" }));

    setOpenShow({ id: 8 });
    store.dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));

    expect(await screen.findByText(/is usually/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops the confirmation when the DJ leaves the set", async () => {
    const { user, rerender } = await renderQuestion();
    await user.click(yes("Orange County Special"));
    await screen.findByLabelText("Title for this week");

    mockUseShowControl.mockReturnValue({ live: false, currentShow: 7 });
    rerender(<SpecialtyQuestion />);

    await waitFor(() =>
      expect(screen.queryByLabelText("Title for this week")).not.toBeInTheDocument()
    );
  });

  it("writes nothing on Not this time, remembers it across a remount, and asks again for the next show", async () => {
    const first = await renderQuestion();
    await first.user.click(screen.getByRole("button", { name: "Not this time" }));

    expect(patches).toEqual([]);
    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
    first.unmount();

    await renderSilent();
    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();

    setOpenShow({ id: 8 });
    renderWithProviders(<SpecialtyQuestion />);
    expect(await screen.findByText(/is usually/)).toBeInTheDocument();
    expect(patches).toEqual([]);
  });

  it("asks again for a takeover's new show on the same mount", async () => {
    const { user, store } = await renderQuestion();
    await user.click(screen.getByRole("button", { name: "Not this time" }));
    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();

    setOpenShow({ id: 8 });
    store.dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));

    expect(await screen.findByText(/is usually/)).toBeInTheDocument();
  });

  it("still works when browser storage throws", async () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => {
      throw new Error("denied");
    });
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error("denied");
    });
    const { user } = await renderQuestion();

    await user.click(screen.getByRole("button", { name: "Not this time" }));

    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
  });

  it.each([
    ["a 400, by status alone", 400, { message: "anything at all" }, REJECTED_PROGRAM_SENTENCE],
    ["a closed_show 403", 403, { code: "closed_show", message: "ended" }, CLOSED_SHOW_SENTENCE],
  ])("words %s as one sentence without a toast", async (_label, status, body, sentence) => {
    patchRefusal = { status, body };
    const { user } = await renderQuestion();

    await user.click(yes("Orange County Special"));

    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
    expect(screen.getByText(/is usually/)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it.each([
    ["a 403 without a code", 403, { error: "Forbidden" }, false],
    ["a ban 403", 403, { message: "Banned", reason: "x" }, true],
    ["a 401", 401, { message: "Unauthorized" }, true],
  ])("leaves %s to the site's general handling", async (_label, status, body, toasts) => {
    patchRefusal = { status, body };
    const { user } = await renderQuestion();

    await user.click(yes("Orange County Special"));

    await waitFor(() => expect(patches).toHaveLength(1));
    if (toasts) {
      await waitFor(() => expect(toastError).toHaveBeenCalled());
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps 'Spotlight' and 'dj-site' out of every string the question shows", () => {
    const { askOne, askShared, yes, tagged, goLiveAs, signOnAs, ...fixed } = specialtyCopy;
    const program = { name: "A", short_name: "A" };
    const strings = [
      goLiveAs(program),
      signOnAs(program),
      askOne("Sunday at noon", "A"),
      askShared("Sunday at noon", ["A", "B"]),
      yes("A"),
      tagged("A"),
      ...Object.values(fixed),
      REJECTED_PROGRAM_SENTENCE,
    ];
    for (const text of strings) {
      expect(text).not.toMatch(/spotlight|dj-site/i);
    }
  });
});
