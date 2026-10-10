import { Component, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, renderWithProviders, review, reviewRevision, reviewsSettled, server } from "@/tests/helpers";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import ReviewHistory from "@/src/components/experiences/modern/reviews/ReviewHistory";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError = (error: Error) => ({ error });
  render = () => (this.state.error ? <div>{this.state.error.message}</div> : this.props.children);
}

const submitted = (overrides = {}) =>
  review({ id: 40, status: "submitted", author: "Reviewer One", printed_revision_id: null, submitted_at: null, revision_count: 3, ...overrides });
const revisions = [
  reviewRevision({ id: 101, revision: 1, edited_by: "Reviewer One", edited_at: "2026-10-01T16:00:00Z", review: "First take." }),
  reviewRevision({ id: 102, revision: 2, edited_by: "Music Director", edited_at: "2026-10-02T16:00:00Z", review: "Second take." }),
  reviewRevision({ id: 103, revision: 3, edited_by: "Reviewer One", edited_at: "2026-10-03T16:00:00Z", review: "Third take." }),
];

const renderHistory = () => renderWithProviders(<Boundary><ReviewHistory id={40} /></Boundary>);

describe("ReviewHistory", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
  });

  it.each([
    ["link", REVIEW_COPY.history.link, "History"],
    ["version", REVIEW_COPY.history.version(2), "Version 2"],
    ["editedBy", REVIEW_COPY.history.editedBy("Pat"), "edited by Pat"],
    ["submittedBy", REVIEW_COPY.history.submittedBy("Pat"), "submitted by Pat"],
    ["current", REVIEW_COPY.history.current, "Current"],
    ["onTheCover", REVIEW_COPY.history.onTheCover, "On the cover"],
    ["draft", REVIEW_COPY.history.draft, "This review has not been submitted yet, so it has no history."],
    ["loadFailed", REVIEW_COPY.history.loadFailed, "Couldn't load this review's history. Please try again."],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it("lists versions newest first, marks the current and printed ones, and words version 1 as submitted", async () => {
    fakeReviewsEndpoints({ reviews: [submitted({ printed_revision_id: 101, in_use: true })], revisions: { "40": revisions } });
    renderHistory();

    await screen.findByText("Version 3");
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => /Version \d/.exec(r.textContent ?? "")?.[0])).toEqual(["Version 3", "Version 2", "Version 1"]);
    expect(within(rows[0]).getByText(REVIEW_COPY.history.current)).toBeInTheDocument();
    expect(within(rows[1]).queryByText(REVIEW_COPY.history.current)).not.toBeInTheDocument();
    expect(within(rows[2]).getByText(REVIEW_COPY.history.onTheCover)).toBeInTheDocument();
    expect(rows[2]).toHaveAttribute("id", "printed");
    expect(within(rows[2]).getByText(/submitted by Reviewer One/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/edited by Music Director/)).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Oct 1, 2026/)).toBeInTheDocument();
    expect(within(rows[2]).getByText("First take.")).toBeInTheDocument();
  });

  it("does not mark the printed version as on the cover once the review is no longer in use", async () => {
    fakeReviewsEndpoints({ reviews: [submitted({ printed_revision_id: 101, in_use: false })], revisions: { "40": revisions } });
    renderHistory();

    await screen.findByText("Version 3");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText(REVIEW_COPY.history.onTheCover)).not.toBeInTheDocument();
  });

  it("scrolls to the printed row when opened with #printed", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.location.hash = "#printed";
    fakeReviewsEndpoints({ reviews: [submitted({ printed_revision_id: 101 })], revisions: { "40": revisions } });
    renderHistory();

    await screen.findByText("Version 3");
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts[0]).toHaveAttribute("id", "printed");
    window.location.hash = "";
  });

  it("says a draft has no history and reads no revisions", async () => {
    const requested = vi.fn();
    fakeReviewsEndpoints({ reviews: [submitted({ status: "draft", revision_count: 0 })], revisions: { "40": revisions } });
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => { requested(); return HttpResponse.json(revisions); }));
    const { store } = renderHistory();

    expect(await screen.findByText(REVIEW_COPY.history.draft)).toBeInTheDocument();
    expect(reviewApi.endpoints.getReviewRevisions.select(40)(store.getState()).isUninitialized).toBe(true);
    await reviewsSettled(store);
    expect(screen.queryByText("Version 1")).not.toBeInTheDocument();
    expect(requested).not.toHaveBeenCalled();
  });

  it("states a load failure when the revisions cannot be read", async () => {
    fakeReviewsEndpoints({ reviews: [submitted()] });
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => HttpResponse.json({}, { status: 500 })));
    renderHistory();

    expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_COPY.history.loadFailed);
  });

  it("shows no empty Reviewer row on any version", async () => {
    fakeReviewsEndpoints({ reviews: [submitted()], revisions: { "40": revisions } });
    renderHistory();

    await screen.findByText("Version 3");
    expect(screen.queryByText(REVIEW_COPY.slip.reviewer)).not.toBeInTheDocument();
  });

  it("shows a submitted review with no recorded versions as one current row, with no label and no date when never stamped", async () => {
    fakeReviewsEndpoints({ reviews: [submitted({ revision_count: 0, review: "Old text." })] });
    renderHistory();

    await screen.findByText("Old text.");
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText(REVIEW_COPY.history.current)).toBeInTheDocument();
    expect(rows[0].textContent).toContain("submitted by Reviewer One");
    expect(rows[0].textContent).not.toMatch(/Version|·/);
    expect(screen.queryByText(REVIEW_COPY.history.draft)).not.toBeInTheDocument();
  });

  it("dates the single row by submitted_at in station time", async () => {
    fakeReviewsEndpoints({ reviews: [submitted({ revision_count: 0, submitted_at: "2026-09-30T03:30:00Z" })] });
    renderHistory();

    expect(await screen.findByText(/Sep 29, 2026, 11:30 PM EDT/)).toBeInTheDocument();
  });

  it("renders the not-found state for a review that does not exist", async () => {
    fakeReviewsEndpoints({ reviews: [] });
    renderHistory();

    expect(await screen.findByText("NEXT_NOT_FOUND")).toBeInTheDocument();
  });

  it("renders nothing with reviews off", () => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "");
    fakeReviewsEndpoints({ reviews: [submitted()] });
    const { container } = renderHistory();

    expect(container).toBeEmptyDOMElement();
  });
});
