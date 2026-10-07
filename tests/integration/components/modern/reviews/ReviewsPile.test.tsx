import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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

describe("ReviewsPile", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
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

  it("answers a lost race with our own line, not the server's message, and refetches", async () => {
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

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Someone else got to this record first. The lists are up to date."),
    );
    await waitFor(() => expect(lists).toBeGreaterThan(before));
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
  ])("renders nothing when %s", async (_label, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    serveIntake([item({})]);

    const { container } = renderWithProviders(<ReviewsPile />);

    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });
});
