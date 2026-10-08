import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

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

import IntakeScreen from "@/src/components/experiences/modern/reviews/IntakeScreen";

const moonPix = (overrides = {}) =>
  intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", ...overrides });

const waiting = (id: number, overrides = {}) =>
  moonPix({ id, state: "checked_out", effective_state: "checked_out", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam", submitted_review_count: 1, accepted_review_id: null, ...overrides });

const lane = (name: string) => screen.findByRole("region", { name });

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

    const { container } = renderWithProviders(<IntakeScreen />);

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

    renderWithProviders(<IntakeScreen />);

    const shelf = await lane("On the review shelf");
    expect(within(shelf).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
    expect(within(await lane("Requested")).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
    expect(within(await lane("Checked out")).getByText("Cat Power · Dark Side · Matador · cd")).toBeInTheDocument();
    expect(within(await lane("Reviewed")).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
    expect(within(await lane("Filed")).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
    expect(within(shelf).getByRole("link")).toHaveAttribute("href", "/dashboard/admin/intake/1");
  });

  it("renders no Review waiting lane when only open records are served", async () => {
    fakeReviewsEndpoints({ open: [moonPix()] });

    renderWithProviders(<IntakeScreen />);

    await lane("On the review shelf");
    expect(screen.queryByRole("region", { name: /Review waiting/ })).not.toBeInTheDocument();
  });

  it.each([
    [1, "1 review"],
    [2, "2 reviews"],
  ])("counts %i submitted reviews as %s, and marks the record in its physical lane", async (count, text) => {
    const item = waiting(7, { submitted_review_count: count });
    fakeReviewsEndpoints({ open: [item, waiting(8, { submitted_review_count: 3 })], awaiting: [item, waiting(8, { submitted_review_count: 3 })] });

    renderWithProviders(<IntakeScreen />);

    const lane1 = await lane("Review waiting (2)");
    expect(within(lane1).getAllByText("Checked out to DJ Sam")).toHaveLength(2);
    expect(within(lane1).getByText(text)).toBeInTheDocument();
    const checkedOut = await lane("Checked out");
    expect(within(checkedOut).getAllByText("review waiting")).toHaveLength(2);
  });

  it("shows a reviewed record's holder and overdue mark, and none for a returned one", async () => {
    fakeReviewsEndpoints({
      reviewed: [
        moonPix({ id: 1, effective_state: "reviewed", checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam", overdue: true }),
        moonPix({ id: 2, effective_state: "reviewed", checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: null }),
        moonPix({ id: 3, effective_state: "reviewed" }),
      ],
    });

    renderWithProviders(<IntakeScreen />);

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

    const { user } = renderWithProviders(<IntakeScreen />);
    await user.click(await screen.findByRole("button", { name: "Mark as returned" }));

    await waitFor(() => expect(screen.queryByText(/^Still out/)).not.toBeInTheDocument());
    expect(within(await lane("Reviewed")).getByText("Cat Power · Moon Pix · Matador · cd")).toBeInTheDocument();
  });

  it("a 409 state_changed reloads every lane, then shows the approved notice and no server message", async () => {
    const reads: Record<string, number> = {};
    const holder = { checked_out_at: "2026-09-01T12:00:00Z", checked_out_by: "dj-1", checked_out_by_name: "DJ Sam" };
    fakeReviewsEndpoints({ reviewed: [moonPix({ id: 11, effective_state: "reviewed", ...holder })] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        const key = query.get("awaiting_acceptance") ? "awaiting" : (query.get("state") ?? "open");
        reads[key] = (reads[key] ?? 0) + 1;
        return HttpResponse.json(key === "reviewed" ? [moonPix({ id: 11, effective_state: "reviewed", ...holder })] : []);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/11/release`, () =>
        HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
      ),
    );

    const { user } = renderWithProviders(<IntakeScreen />);
    await user.click(await screen.findByRole("button", { name: "Mark as returned" }));

    const notice = await screen.findByText("This record has already been returned or filed. The lists have been reloaded.");
    expect(notice).toBeInTheDocument();
    for (const key of ["open", "awaiting", "reviewed", "filed"]) expect(reads[key]).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("server words")).not.toBeInTheDocument();
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

    const { user } = renderWithProviders(<IntakeScreen />);
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
