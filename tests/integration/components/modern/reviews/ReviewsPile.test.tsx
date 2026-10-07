import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const ME = "dj-me";
const mockAuth = vi.hoisted(() => ({ authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: ME, authority: mockAuth.authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import { toast } from "sonner";
import ReviewsPile from "@/src/components/experiences/modern/reviews/ReviewsPile";

const item = (overrides: Partial<IntakeItem>): IntakeItem =>
  ({
    id: 1,
    artist_name: "Stereolab",
    album_title: "Aluminum Tunes",
    record_label: "Duophonic",
    format_id: 1,
    state: "pool",
    effective_state: "pool",
    overdue: false,
    logged_at: "2026-09-01T12:00:00Z",
    requested_dj_id: null,
    requested_at: null,
    checked_out_by: null,
    checked_out_at: null,
    ...overrides,
  }) as IntakeItem;

function serveIntake(open: IntakeItem[], reviewed: IntakeItem[] = []) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) =>
      HttpResponse.json(new URL(request.url).searchParams.get("state") === "reviewed" ? reviewed : open),
    ),
    http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
      HttpResponse.json([{ id: 1, format_name: "cd" }]),
    ),
  );
}

const section = (name: string) => screen.findByRole("region", { name });

const RACE_LINE = "Someone else got to this record first. The lists are up to date.";
const FAILURE_LINE = "Couldn't do that. Please try again.";

describe("ReviewsPile", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    vi.mocked(toast).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lists the Pile with Check out, and a checkout sends the POST", async () => {
    serveIntake([item({ id: 5 })]);
    let posted: string | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/checkout`, ({ request }) => {
        posted = new URL(request.url).pathname;
        return HttpResponse.json(item({ id: 5, state: "checked_out" }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsPile />);
    const pile = await section("The Pile");
    expect(within(pile).getByText(/Aluminum Tunes/)).toBeInTheDocument();
    expect(within(pile).getByText(/cd/)).toBeInTheDocument();
    await user.click(within(pile).getByRole("button", { name: "Check out" }));

    await waitFor(() => expect(posted).toBe("/intake/5/checkout"));
  });

  it("shows my checked-out records with the overdue mark, and not someone else's", async () => {
    serveIntake([
      item({ id: 2, effective_state: "checked_out", checked_out_by: ME, checked_out_at: "2026-08-01T12:00:00Z", overdue: true }),
      item({ id: 3, artist_name: "Cat Power", effective_state: "checked_out", checked_out_by: "someone-else" }),
    ]);

    renderWithProviders(<ReviewsPile />);
    const mine = await section("My checkouts");
    await within(mine).findByText(/Stereolab/);
    expect(within(mine).getByText("Overdue")).toBeInTheDocument();
    expect(within(mine).queryByText(/Cat Power/)).not.toBeInTheDocument();
  });

  it("keeps a reviewed record I hold, marked, and the release sends and clears the row", async () => {
    let released = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        const reviewedOnly = new URL(request.url).searchParams.get("state") === "reviewed";
        return HttpResponse.json(
          reviewedOnly && !released
            ? [
                item({ id: 8, state: "reviewed", effective_state: "reviewed", checked_out_by: ME, overdue: true }),
                item({ id: 9, artist_name: "Cat Power", state: "reviewed", effective_state: "reviewed", checked_out_by: "someone-else" }),
                item({ id: 10, artist_name: "Jessica Pratt", state: "reviewed", effective_state: "reviewed", checked_out_by: null }),
              ]
            : [],
        );
      }),
      http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/intake/8/release`, () => {
        released = true;
        return HttpResponse.json(item({ id: 8, state: "reviewed", effective_state: "reviewed" }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsPile />);
    const mine = await section("My checkouts");
    await within(mine).findByText("Reviewed. Bring the record back to the music office.");
    expect(within(mine).getByText("Overdue")).toBeInTheDocument();
    expect(within(mine).queryByText(/Cat Power|Jessica Pratt/)).not.toBeInTheDocument();

    await user.click(within(mine).getByRole("button", { name: "Return to the Pile" }));
    expect(await screen.findByText("Have you brought this record back to the station?")).toBeInTheDocument();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Return to the Pile" }));

    await waitFor(() => expect(released).toBe(true));
    await waitFor(() => expect(within(mine).queryByText(/Stereolab/)).not.toBeInTheDocument());
  });

  it("asks before returning an ordinary checkout, then releases that record and clears the row", async () => {
    let released: string | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get("state") === "reviewed" || released
            ? []
            : [item({ id: 2, state: "checked_out", effective_state: "checked_out", checked_out_by: ME })],
        ),
      ),
      http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/intake/:id/release`, ({ request }) => {
        released = new URL(request.url).pathname;
        return HttpResponse.json(item({ id: 2 }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsPile />);
    const mine = await section("My checkouts");
    await within(mine).findByText(/Stereolab/);

    await user.click(within(mine).getByRole("button", { name: "Return to the Pile" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Put this record back in the Pile?")).toBeInTheDocument();
    expect(within(dialog).queryByText("Have you brought this record back to the station?")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Return to the Pile" }));

    await waitFor(() => expect(released).toBe("/intake/2/release"));
    await waitFor(() => expect(within(mine).queryByText(/Stereolab/)).not.toBeInTheDocument());
  });

  it("lets me accept or pass a request made of me, and hides one made of someone else", async () => {
    serveIntake([
      item({ id: 11, state: "requested", effective_state: "requested", requested_dj_id: ME, requested_at: "2026-09-30T12:00:00Z" }),
      item({ id: 12, artist_name: "Cat Power", state: "requested", effective_state: "requested", requested_dj_id: "other" }),
    ]);
    const paths: string[] = [];
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, ({ request }) => {
        paths.push(new URL(request.url).pathname);
        return HttpResponse.json(item({}));
      }),
    );

    const { user } = renderWithProviders(<ReviewsPile />);
    const requests = await section("Requests for me");
    await within(requests).findByText(/Stereolab/);
    expect(within(requests).queryByText(/Cat Power/)).not.toBeInTheDocument();
    await user.click(within(requests).getByRole("button", { name: "Accept" }));
    await user.click(within(requests).getByRole("button", { name: "Pass" }));

    await waitFor(() => expect(paths).toEqual(["/intake/11/accept", "/intake/11/pass"]));
  });

  it("answers a lost race with our own line as a neutral toast, never an error toast or the server's message, and refetches", async () => {
    let lists = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => {
        lists += 1;
        return HttpResponse.json([item({ id: 5 })]);
      }),
      http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () =>
        HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
      ),
    );

    const { user } = renderWithProviders(<ReviewsPile />);
    const pile = await section("The Pile");
    await within(pile).findByText(/Aluminum Tunes/);
    const before = lists;
    await user.click(within(pile).getByRole("button", { name: "Check out" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(RACE_LINE));
    await waitFor(() => expect(lists).toBeGreaterThan(before));
    expect(toast).not.toHaveBeenCalledWith("server words");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("answers a failed write with the generic line as an error toast, not the race line", async () => {
    serveIntake([item({ id: 5 })]);
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () =>
        HttpResponse.json({ message: "server words" }, { status: 500 }),
      ),
    );

    const { user } = renderWithProviders(<ReviewsPile />);
    const pile = await section("The Pile");
    await within(pile).findByText(/Aluminum Tunes/);
    await user.click(within(pile).getByRole("button", { name: "Check out" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(FAILURE_LINE));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    // The lists refetch and the row is still in the Pile, so it unlocks.
    await waitFor(() => expect(within(pile).getByRole("button", { name: "Check out" })).toBeEnabled());
  });

  // The row only leaves its section once the refetched lists land; until then
  // a second click would 409 and claim someone else took the record.
  it("keeps the row locked after a successful write until the refetched lists land", async () => {
    let moved = false;
    const posts: string[] = [];
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        if (moved) await delay(300);
        return HttpResponse.json(
          new URL(request.url).searchParams.get("state") === "reviewed" || moved ? [] : [item({ id: 5 })],
        );
      }),
      http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () => {
        posts.push("checkout");
        if (moved) return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        moved = true;
        return HttpResponse.json(item({ id: 5, state: "checked_out" }));
      }),
    );

    const { user } = renderWithProviders(<ReviewsPile />);
    const pile = await section("The Pile");
    await within(pile).findByText(/Stereolab/);
    await user.click(within(pile).getByRole("button", { name: "Check out" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));

    expect(within(pile).getByText(/Stereolab/)).toBeInTheDocument();
    const again = within(pile).getByRole("button", { name: "Check out" });
    expect(again).toBeDisabled();
    // user-event refuses a pointer on a locked button; a DJ's click still lands.
    fireEvent.click(again);

    await waitFor(() => expect(within(pile).queryByText(/Stereolab/)).not.toBeInTheDocument());
    expect(posts).toHaveLength(1);
    expect(toast).not.toHaveBeenCalledWith(RACE_LINE);
    expect(toast.error).not.toHaveBeenCalled();
  });

  // The second POST of a double-click would find the record already moved and
  // answer 409 state_changed, telling the DJ someone else took the record they
  // just took.
  it.each([
    ["Check out", "The Pile", item({ id: 5 }), "/intake/5/checkout"],
    [
      "Accept",
      "Requests for me",
      item({ id: 5, state: "requested", effective_state: "requested", requested_dj_id: ME }),
      "/intake/5/accept",
    ],
  ] as const)("sends one POST when %s is double-clicked, and shows no race line", async (button, title, row, path) => {
    let moved = false;
    const posts: string[] = [];
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get("state") === "reviewed" || moved ? [] : [row]),
      ),
      http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, async ({ request }) => {
        posts.push(new URL(request.url).pathname);
        await delay(100);
        if (moved) return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
        moved = true;
        return HttpResponse.json(row);
      }),
    );

    const { user } = renderWithProviders(<ReviewsPile />);
    const region = await section(title);
    await within(region).findByText(/Stereolab/);
    await user.dblClick(within(region).getByRole("button", { name: button }));

    await waitFor(() => expect(within(region).queryByText(/Stereolab/)).not.toBeInTheDocument());
    expect(posts).toEqual([path]);
    expect(toast).not.toHaveBeenCalledWith(RACE_LINE);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says the Pile could not load rather than showing it empty when the body is not JSON", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => new HttpResponse("<html>Bad Gateway</html>", { status: 200, headers: { "Content-Type": "text/html" } })),
      http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
    );

    renderWithProviders(<ReviewsPile />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the Pile");
  });

  it.each([
    ["the flag is off", "", Authorization.MD],
    ["a DJ is under staff", "staff", Authorization.DJ],
  ])("renders nothing and reads nothing when %s", async (_label, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    serveIntake([item({})]);
    const requested: string[] = [];
    const log = ({ request }: { request: Request }) => {
      requested.push(new URL(request.url).pathname);
    };
    server.events.on("request:start", log);

    try {
      const { container } = renderWithProviders(<ReviewsPile />);

      await new Promise((r) => setTimeout(r, 50));
      expect(requested.filter((p) => p.startsWith("/intake"))).toEqual([]);
      expect(container).toBeEmptyDOMElement();
    } finally {
      server.events.removeListener("request:start", log);
    }
  });
});
