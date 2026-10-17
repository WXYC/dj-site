import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders } from "@/tests/helpers";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ReviewShelfScreen from "@/src/components/experiences/modern/reviews/ReviewShelfScreen";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

describe("ReviewShelfScreen", () => {
  it("renders the shelf lane with a checkout button for a record on the shelf", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(
      <ReviewShelfScreen items={[intakeItem({ id: 5, artist_name: "Stereolab" })]} formats={undefined} isMD={false} />,
    );

    expect(await screen.findByRole("heading", { level: 3, name: REVIEW_COPY.screen.shelfTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: REVIEW_COPY.screen.checkOut })).toBeInTheDocument();
  });
});
