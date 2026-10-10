import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, renderWithProviders, review, reviewRevision, server } from "@/tests/helpers";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

const mockAuth = vi.hoisted(() => ({ authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: mockAuth.authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import PrintedVersionNote from "@/src/components/experiences/modern/reviews/PrintedVersionNote";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const printed = (overrides = {}) =>
  review({ id: 40, status: "submitted", printed_revision_id: 101, printed_at: "2026-10-02T16:00:00Z", ...overrides });
const first = reviewRevision({ id: 101, revision: 1 });
const second = reviewRevision({ id: 102, revision: 2 });

describe("PrintedVersionNote", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
  });

  it.each([
    ["isCurrent", REVIEW_COPY.printedNote.isCurrent, "This is the version printed on the cover."],
    ["edited", REVIEW_COPY.printedNote.edited("Friday, October 2, 2026"), "The cover has an earlier version of this review, printed Friday, October 2, 2026."],
    ["seePrinted", REVIEW_COPY.printedNote.seePrinted, "See the printed version"],
    ["printNew", REVIEW_COPY.printedNote.printNew, "Print a new slip"],
    ["loadFailed", REVIEW_COPY.printedNote.loadFailed, "Couldn't check which version is on the cover."],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it("says so when the printed version is the current one", async () => {
    fakeReviewsEndpoints({ revisions: { "40": [first] } });
    renderWithProviders(<PrintedVersionNote onCover review={printed()} />);

    expect(await screen.findByText("This is the version printed on the cover.")).toBeInTheDocument();
  });

  it("says the cover is earlier after an edit, and links to the printed version", async () => {
    fakeReviewsEndpoints({ revisions: { "40": [second, first] } });
    renderWithProviders(<PrintedVersionNote onCover review={printed()} />);

    expect(await screen.findByText("The cover has an earlier version of this review, printed Friday, October 2, 2026.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the printed version" })).toHaveAttribute("href", "/dashboard/reviews/40/history#printed");
    expect(screen.queryByRole("link", { name: "Print a new slip" })).not.toBeInTheDocument();
  });

  it("offers a new slip only when given where it is", async () => {
    fakeReviewsEndpoints({ revisions: { "40": [first, second] } });
    renderWithProviders(<PrintedVersionNote onCover review={printed()} newSlipHref="/dashboard/admin/intake/9/slip" />);

    expect(await screen.findByRole("link", { name: "Print a new slip" })).toHaveAttribute("href", "/dashboard/admin/intake/9/slip");
  });

  it("does not offer a new slip when the cover is current", async () => {
    fakeReviewsEndpoints({ revisions: { "40": [first] } });
    renderWithProviders(<PrintedVersionNote onCover review={printed()} newSlipHref="/dashboard/admin/intake/9/slip" />);

    await screen.findByText(REVIEW_COPY.printedNote.isCurrent);
    expect(screen.queryByRole("link", { name: "Print a new slip" })).not.toBeInTheDocument();
  });

  it.each<[string, Parameters<typeof printed>[0], ReturnType<typeof reviewRevision>[]]>([
    ["the revisions list is empty", {}, []],
    ["the print has no date", { printed_at: null }, [first, second]],
    ["the print date is not a date", { printed_at: "" }, [first, second]],
  ])("renders nothing rather than throwing when %s", async (_name, overrides, list) => {
    fakeReviewsEndpoints({ revisions: { "40": list } });
    const { container } = renderWithProviders(<PrintedVersionNote onCover review={printed(overrides)} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing and requests no revisions for a review that was never printed", async () => {
    const requested = vi.fn();
    fakeReviewsEndpoints();
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => { requested(); return HttpResponse.json([]); }));
    const { container } = renderWithProviders(<PrintedVersionNote onCover review={printed({ printed_revision_id: null, printed_at: null })} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
    expect(requested).not.toHaveBeenCalled();
  });

  it.each<[string, ReturnType<typeof reviewRevision>[]]>([
    ["the newest revision was printed", [first]],
    ["it was edited after printing", [first, second]],
  ])("renders nothing and requests no revisions for a printed review that is not on a cover now, when %s", async (_name, list) => {
    const requested = vi.fn();
    fakeReviewsEndpoints();
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => { requested(); return HttpResponse.json(list); }));
    const { container } = renderWithProviders(<PrintedVersionNote onCover={false} review={printed()} newSlipHref="/dashboard/admin/intake/9/slip" />);

    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
    expect(requested).not.toHaveBeenCalled();
  });

  it.each<[string, string, number]>([
    ["off", "", Authorization.MD],
    ["staff, for a DJ", "staff", Authorization.DJ],
  ])("renders nothing with the flag %s", async (_name, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    fakeReviewsEndpoints({ revisions: { "40": [first] } });
    const { container } = renderWithProviders(<PrintedVersionNote onCover review={printed()} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("states a load failure when there is nothing else to show", async () => {
    fakeReviewsEndpoints();
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<PrintedVersionNote onCover review={printed()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_COPY.printedNote.loadFailed);
  });
});
