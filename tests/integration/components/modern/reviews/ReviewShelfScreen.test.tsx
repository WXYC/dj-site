import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders } from "@/tests/helpers";
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
});
