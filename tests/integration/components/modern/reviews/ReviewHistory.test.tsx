import { Component, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, renderWithProviders, review, reviewRevision } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: Authorization.DJ } },
    authenticating: false,
    authenticated: true,
  }),
}));

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

  it("lists versions newest first, marks the current and printed ones, and words version 1 as submitted", async () => {
    fakeReviewsEndpoints({ reviews: [submitted({ printed_revision_id: 101 })], revisions: { "40": revisions } });
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
    fakeReviewsEndpoints({ reviews: [submitted({ status: "draft", revision_count: 0 })], revisions: { "40": revisions } });
    renderHistory();

    expect(await screen.findByText(REVIEW_COPY.history.draft)).toBeInTheDocument();
    expect(screen.queryByText("Version 1")).not.toBeInTheDocument();
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
