import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, returnedByMusicDirector } from "@/tests/helpers";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ReviewShelfScreen from "@/src/components/experiences/modern/reviews/ReviewShelfScreen";
import { useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import type { ComponentProps } from "react";

// The screen takes the reviewers read and the shared write wiring from its caller, as ReviewsScreen supplies them.
function WithWrite(props: Omit<ComponentProps<typeof ReviewShelfScreen>, "write" | "lock" | "reviewers">) {
  const reviewers = useGetReviewersQuery(undefined, { skip: !props.isMD });
  const { write, lock } = useReviewWrite(props.items);
  return <ReviewShelfScreen {...props} reviewers={reviewers} write={write} lock={lock} />;
}

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

describe("ReviewShelfScreen", () => {
  it("renders the review shelf lane with a checkout button for a record on the review shelf", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(
      <WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab" })]} formats={undefined} isMD={false} />,
    );

    expect(await screen.findByRole("heading", { level: 3, name: REVIEW_COPY.screen.shelfTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: REVIEW_COPY.screen.checkOut })).toBeInTheDocument();
  });

  it("leaves out a checked out record with a submitted review that a music director returned", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab", ...returnedByMusicDirector })]} formats={undefined} isMD={false} />);

    expect(await screen.findByText(REVIEW_COPY.screen.shelfEmpty)).toBeInTheDocument();
    expect(screen.queryByText("Stereolab", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REVIEW_COPY.screen.checkOut })).not.toBeInTheDocument();
  });

  it("leaves out a record with a submitted review and shows it again once that review is deleted", async () => {
    fakeReviewsEndpoints();
    const item = intakeItem({ id: 5, artist_name: "Stereolab", submitted_review_count: 1 });
    const { rerender } = renderWithProviders(<WithWrite items={[item]} formats={undefined} isMD={false} />);

    expect(await screen.findByText(REVIEW_COPY.screen.shelfEmpty)).toBeInTheDocument();

    rerender(<WithWrite items={[{ ...item, submitted_review_count: 0 }]} formats={undefined} isMD={false} />);

    expect(await screen.findByRole("button", { name: REVIEW_COPY.screen.checkOut })).toBeInTheDocument();
  });
});
