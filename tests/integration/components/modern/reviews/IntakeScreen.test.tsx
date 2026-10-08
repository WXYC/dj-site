import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";

const roster = vi.hoisted(() => ({ listUsers: vi.fn(), listMembers: vi.fn() }));

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  const mock = createAuthClientModuleMock();
  return {
    ...mock,
    authClient: { ...mock.authClient, admin: { listUsers: roster.listUsers }, organization: { listMembers: roster.listMembers } },
  };
});

vi.mock("@/lib/features/authentication/organization-utils", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveOrganizationIdAdmin: async () => "org-1",
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

let authority = Authorization.MD;
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "md-me", authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import { toast } from "sonner";
import IntakeScreen from "@/src/components/experiences/modern/reviews/IntakeScreen";

const moonPix = (overrides = {}) =>
  intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", ...overrides });

const waiting = (id: number, overrides = {}) =>
  moonPix({ id, state: "checked_out", effective_state: "checked_out", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam", submitted_review_count: 1, accepted_review_id: null, ...overrides });

const lane = (name: string) => screen.findByRole("region", { name });

const account = (id: string, djName: string, role: string) => ({
  id, name: djName, email: `${id}@example.org`, username: id, role, emailVerified: true, djName,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});
const ROSTER = [
  account("dj-sam", "DJ Sam", "dj"),
  account("dj-pat", "DJ Pat", "dj"),
  account("md-me", "DJ Me", "musicDirector"),
  account("mem-1", "Member Max", "member"),
];

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  roster.listUsers.mockReset().mockImplementation(async () => ({ data: { users: ROSTER, total: ROSTER.length }, error: null }));
  roster.listMembers.mockReset().mockImplementation(async () => ({
    data: { members: ROSTER.map((u) => ({ userId: u.id, role: u.role })) },
    error: null,
  }));
});

describe("IntakeScreen", () => {
  beforeEach(() => {
    authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["off", "", Authorization.MD],
    ["staff-only for a DJ", "staff", Authorization.DJ],
  ])("renders nothing when the flag is %s", async (_label, flag, who) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    authority = who;
    fakeReviewsEndpoints({ open: [moonPix()] });

    const { container } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("names each record with the one record line, in the lane for its state", async () => {
    fakeReviewsEndpoints({
      open: [
        moonPix({ id: 1 }),
        moonPix({ id: 2, state: "requested", effective_state: "requested", requested_dj_name: "DJ Pat" }),
        waiting(3, { album_title: "Dark Side" }),
      ],
      reviewed: [moonPix({ id: 4, state: "reviewed", effective_state: "reviewed" })],
      filed: [moonPix({ id: 5, state: "filed", effective_state: "filed" })],
    });

    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);

    const shelf = await lane("On the review shelf");
    expect(within(shelf).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
    expect(within(await lane("Requested")).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
    expect(within(await lane("Checked out")).getByText("Cat Power · Dark Side · Matador · cd")).toBeInTheDocument();
    expect(within(await lane("Reviewed")).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
    expect(within(await lane("Filed")).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
    expect(within(shelf).getByRole("link")).toHaveAttribute("href", "/dashboard/admin/intake/1");
  });

  it("puts each state's rows in its own lane only, and reads intake exactly twice", async () => {
    const reads: string[] = [];
    fakeReviewsEndpoints({
      open: [moonPix({ id: 1, album_title: "On Shelf" }), waiting(3, { album_title: "Out" })],
      reviewed: [moonPix({ id: 4, album_title: "Done", state: "reviewed", effective_state: "reviewed" })],
      filed: [moonPix({ id: 5, album_title: "Shelved", state: "filed", effective_state: "filed" })],
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        reads.push(new URL(request.url).search);
      }),
    );

    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);

    const where = { "On the review shelf": "On Shelf", "Checked out": "Out", Reviewed: "Done", Filed: "Shelved" };
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

    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);

    await lane("On the review shelf");
    expect(screen.queryByRole("region", { name: /Review waiting/ })).not.toBeInTheDocument();
  });

  it.each([
    [1, "1 review"],
    [2, "2 reviews"],
  ])("counts %i submitted reviews as %s, and marks the record in its physical lane", async (count, text) => {
    const item = waiting(7, { submitted_review_count: count });
    fakeReviewsEndpoints({ open: [item, waiting(8, { submitted_review_count: 3 })], awaiting: [item, waiting(8, { submitted_review_count: 3 })] });

    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);

    const lane1 = await lane("Review waiting (2)");
    expect(within(lane1).getAllByText("Checked out to DJ Sam")).toHaveLength(2);
    expect(within(lane1).getByText(text)).toBeInTheDocument();
    const checkedOut = await lane("Checked out");
    expect(within(checkedOut).getAllByText("review waiting")).toHaveLength(2);
  });

  it("names a removed holder in the Review waiting lane instead of printing null", async () => {
    const orphan = waiting(9, { checked_out_by: null, checked_out_by_name: null });
    fakeReviewsEndpoints({ open: [orphan], awaiting: [orphan] });

    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);

    const lane1 = await lane("Review waiting (1)");
    expect(within(lane1).getByText("Holder removed")).toBeInTheDocument();
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

    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);

    const reviewed = await lane("Reviewed");
    expect(within(reviewed).getByText("Still out: checked out to DJ Sam")).toBeInTheDocument();
    expect(within(reviewed).getByText("Still out: holder removed")).toBeInTheDocument();
    expect(within(reviewed).getAllByText(/^Still out/)).toHaveLength(2);
    expect(within(reviewed).getAllByRole("button", { name: "Mark as returned" })).toHaveLength(2);
    expect(within(reviewed).getAllByText("Overdue")).toHaveLength(1);
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

    const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    await user.click(await screen.findByRole("button", { name: "Mark as returned" }));

    await waitFor(() => expect(screen.queryByText(/^Still out/)).not.toBeInTheDocument());
    expect(within(await lane("Reviewed")).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
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
          }
          return HttpResponse.json(key === "unfiltered" ? [moonPix({ id: 11, effective_state: "reviewed", ...HOLDER })] : []);
        }),
        http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => {
          lost = true;
          return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        }),
      );

      const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
      const returned = await screen.findByRole("button", { name: "Mark as returned" });
      await user.click(returned);

      // The other read has long since landed; only the held one is outstanding.
      await waitFor(() => expect(heldReads).toBeGreaterThan(0));
      await new Promise((resolve) => setTimeout(resolve, 100));
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

    const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
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

  it("logs an item with the typed fields", async () => {
    let body: unknown;
    fakeReviewsEndpoints();
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "cd" }));
    await user.type(screen.getByLabelText("Discogs release id (optional)"), "123");
    await user.click(screen.getByRole("button", { name: "Log item" }));

    await waitFor(() =>
      expect(body).toEqual({ artist_name: "Cat Power", album_title: "Moon Pix", format_id: 1, discogs_release_id: 123 }),
    );
  });
});

describe("IntakeScreen — a failed background refetch", () => {
  beforeEach(() => {
    authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the loaded lanes and shows no load-failure line when the reload after a write fails", async () => {
    fakeReviewsEndpoints({ reviewed: [moonPix({ id: 11, effective_state: "reviewed", checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam" })] });
    const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    const button = await screen.findByRole("button", { name: "Mark as returned" });

    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })),
      http.post(`${TEST_BACKEND_URL}/intake/11/release`, () => HttpResponse.json(moonPix({ id: 11 }))),
    );
    await user.click(button);

    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(await lane("Reviewed")).getByText(/Cat Power · Moon Pix/)).toBeInTheDocument();
  });

  it("shows the load-failure line when a first load fails", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

const HELD = { checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam" };
const requestedRow = (id: number) =>
  moonPix({ id, state: "requested", effective_state: "requested", requested_dj_id: "dj-pat", requested_dj_name: "DJ Pat" });
const outRow = (id: number, overrides = {}) =>
  moonPix({ id, state: "checked_out", effective_state: "checked_out", ...HELD, ...overrides });

describe("IntakeScreen — request, cancel and release", () => {
  beforeEach(() => {
    authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("offers only accounts that can review in the picker, and requests the chosen DJ", async () => {
    let body: unknown;
    let asked = false;
    fakeReviewsEndpoints({
      open: () => [asked ? requestedRow(11) : moonPix({ id: 11 })],
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/request`, async ({ request }) => {
        body = await request.json();
        asked = true;
        return HttpResponse.json(requestedRow(11));
      }),
    );

    const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    await user.click(await screen.findByRole("combobox", { name: "DJ to ask" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["DJ Sam", "DJ Pat", "DJ Me"]);
    await user.click(screen.getByRole("option", { name: "DJ Pat" }));
    await user.click(screen.getByRole("button", { name: "Request a review" }));

    await waitFor(() => expect(body).toEqual({ dj_id: "dj-pat" }));
    expect(await within(await lane("Requested")).findByText("Held for DJ Pat")).toBeInTheDocument();
  });

  it("keeps Request a review off until a DJ is chosen", async () => {
    fakeReviewsEndpoints({ open: [moonPix({ id: 11 })] });
    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    expect(await screen.findByRole("button", { name: "Request a review" })).toBeDisabled();
  });

  it("answers a 400 on /request with the approved line, no server message, and a fresh DJ list", async () => {
    fakeReviewsEndpoints({ open: [moonPix({ id: 11 })] });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/request`, () =>
        HttpResponse.json({ message: "dj_id must name an account that can review" }, { status: 400 }),
      ),
    );

    const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    await user.click(await screen.findByRole("combobox", { name: "DJ to ask" }));
    await user.click(screen.getByRole("option", { name: "DJ Pat" }));
    await waitFor(() => expect(roster.listUsers).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Request a review" }));

    expect(await screen.findByText(
      "That DJ can't be asked to review: their account was removed, or it's no longer a DJ account. Pick someone else.",
    )).toBeInTheDocument();
    await waitFor(() => expect(roster.listUsers).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/dj_id must name/)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the load-failure line in place of the picker when the DJ list cannot be read", async () => {
    roster.listUsers.mockImplementation(async () => ({ data: null, error: { message: "down" } }));
    fakeReviewsEndpoints({ open: [moonPix({ id: 11 })] });
    renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the review shelf. Please try again.");
    expect(screen.queryByRole("combobox", { name: "DJ to ask" })).not.toBeInTheDocument();
  });

  it("cancels a request from the Requested lane", async () => {
    let cancelled = false;
    fakeReviewsEndpoints({ open: () => [cancelled ? moonPix({ id: 11 }) : requestedRow(11)] });
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/11/cancel-request`, () => {
        cancelled = true;
        return HttpResponse.json(moonPix({ id: 11 }));
      }),
    );

    const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    await user.click(await within(await lane("Requested")).findByRole("button", { name: "Cancel request" }));

    await waitFor(() => expect(within(screen.getByRole("region", { name: "Requested" })).queryByRole("button")).not.toBeInTheDocument());
    expect(within(await lane("On the review shelf")).getByText(/Moon Pix/)).toBeInTheDocument();
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

    const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
    const checkedOut = await lane("Checked out");
    expect(within(checkedOut).getByText("Holder removed")).toBeInTheDocument();
    expect(within(checkedOut).getByText("Checked out to DJ Sam")).toBeInTheDocument();
    expect(within(checkedOut).getAllByRole("button", { name: "Release" })).toHaveLength(2);
    await user.click(within(within(checkedOut).getByText("Holder removed").closest("li")!).getByRole("button", { name: "Release" }));

    await waitFor(() => expect(released).toEqual(["12"]));
  });

});

describe("IntakeScreen — lost races", () => {
  beforeEach(() => {
    authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  });
  afterEach(() => vi.unstubAllEnvs());

  const RACE_LINES = {
    request: "This record has left the review shelf since the page loaded, so it can't be requested. The lists have been reloaded.",
    cancel: "This request was already answered, or it expired. The lists have been reloaded.",
    release: "This record has already been returned. The lists have been reloaded.",
    return: "This record has already been returned or filed. The lists have been reloaded.",
  };

  it.each([
    ["request", "request", () => ({ open: [moonPix({ id: 11 })] }), "Request a review"],
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
      const { user } = renderWithProviders(<IntakeScreen organizationSlug="wxyc" />);
      if (action === "request") {
        await user.click(await screen.findByRole("combobox", { name: "DJ to ask" }));
        await user.click(screen.getByRole("option", { name: "DJ Pat" }));
      }
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
