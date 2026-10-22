import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { SpecialtyShow } from "@wxyc/shared";
import SpecialtyQuestion from "@/src/components/experiences/classic/flowsheet/SpecialtyQuestion";
import { CLOSED_SHOW_SENTENCE } from "@/lib/features/show-playlist/api";
import { REJECTED_PROGRAM_SENTENCE } from "@/lib/features/specialty/copy";
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

type OpenShow = {
  id: number;
  start_time: string;
  specialty: SpecialtyShow | null;
  show_name?: string | null;
};

let openShow: OpenShow | null;
let onAirDj: string;
let newestEntryId: number;
let catalog: SpecialtyShow[];
let patches: Array<{ id: string; body: unknown }>;
let patchRefusal: { status: number; body: Record<string, string> } | null;

function serve() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () => {
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

const yes = (name: string) => screen.getByRole("button", { name: `Yes, it's ${name}` });

describe("classic SpecialtyQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const stored = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation((key) => stored.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      stored.set(key, value);
    });
    mockUseShowControl.mockReturnValue({ live: true, currentShow: 7 });
    onAirDj = "DJ Test";
    newestEntryId = 100;
    catalog = SEED_CATALOG;
    patches = [];
    patchRefusal = null;
    setOpenShow({});
  });

  it("asks in a bold line with plain buttons and no image", async () => {
    await renderQuestion();

    const line = screen.getByText(
      "Sunday at noon is usually Orange County Special. Is this set Orange County Special?"
    );
    expect(line.tagName).toBe("B");
    expect(yes("Orange County Special")).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Not this time" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByTestId("specialty-tile")).toBeNull();
  });

  it("offers both programs of a shared slot in catalog order, each yes sending its own id", async () => {
    setOpenShow({ start_time: SUNDAY_4PM_EDT });
    await renderQuestion();

    expect(
      screen.getAllByRole("button", { name: /^Yes, it's/ }).map((b) => (b as HTMLInputElement).value)
    ).toEqual(["Yes, it's HyperLocal", "Yes, it's Backyard BBQ"]);

    fireEvent.click(yes("Backyard BBQ"));

    await waitFor(() => expect(patches).toEqual([{ id: "7", body: { specialty_id: 3 } }]));
  });

  it.each([
    ["a tagged set", { specialty: ORANGE_COUNTY }],
    ["a set outside every slot", { start_time: MONDAY_NOON_EDT }],
  ])("does not ask about %s", async (_label, overrides) => {
    setOpenShow(overrides);
    renderWithProviders(<SpecialtyQuestion />);
    await new Promise((r) => setTimeout(r, 300));

    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
  });

  it("sends the week's title through the same PATCH after a yes when the set has none", async () => {
    await renderQuestion();

    fireEvent.click(yes("Orange County Special"));
    const box = await screen.findByLabelText(/Title for this week/);
    expect(box).toHaveAttribute("maxlength", "128");
    fireEvent.change(box, { target: { value: "Cat Power night" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(patches).toEqual([
        { id: "7", body: { specialty_id: 1 } },
        { id: "7", body: { show_name: "Cat Power night" } },
      ])
    );
  });

  it("offers no title box when the set already has one", async () => {
    setOpenShow({ show_name: "Tales of the Triangle" });
    await renderQuestion();

    fireEvent.click(yes("Orange County Special"));

    await screen.findByText("The DJ site will show this set as Orange County Special.");
    expect(screen.queryByLabelText(/Title for this week/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(patches).toEqual([{ id: "7", body: { specialty_id: 1 } }]);
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });

  it("writes nothing on Not this time and remembers it for that show", async () => {
    const first = await renderQuestion();
    fireEvent.click(screen.getByRole("button", { name: "Not this time" }));

    expect(patches).toEqual([]);
    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
    first.unmount();

    renderWithProviders(<SpecialtyQuestion />);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText(/is usually/)).not.toBeInTheDocument();
  });

  it.each([
    ["a 400, by status alone", 400, { message: "anything at all" }, REJECTED_PROGRAM_SENTENCE],
    ["a closed_show 403", 403, { code: "closed_show", message: "ended" }, CLOSED_SHOW_SENTENCE],
  ])("words %s as one sentence", async (_label, status, body, sentence) => {
    patchRefusal = { status, body };
    await renderQuestion();

    fireEvent.click(yes("Orange County Special"));

    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
  });

  it("does not render the closed-show sentence for a 403 without a code", async () => {
    patchRefusal = { status: 403, body: { error: "Forbidden" } };
    await renderQuestion();

    fireEvent.click(yes("Orange County Special"));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(screen.queryByText(CLOSED_SHOW_SENTENCE)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
