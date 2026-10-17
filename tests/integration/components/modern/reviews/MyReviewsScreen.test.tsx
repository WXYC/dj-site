import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders } from "@/tests/helpers";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import MyReviewsScreen from "@/src/components/experiences/modern/reviews/MyReviewsScreen";
import { useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";
import type { ComponentProps } from "react";

// The screen takes the shared write wiring from its caller, as ReviewsScreen supplies it.
function WithWrite(props: Omit<ComponentProps<typeof MyReviewsScreen>, "write" | "lock">) {
  const { write, lock } = useReviewWrite(props.items);
  return <MyReviewsScreen {...props} write={write} lock={lock} />;
}

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});

describe("MyReviewsScreen", () => {
  it("renders the request, checkout and My reviews lanes around the slot between them", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(
      <WithWrite
        items={[intakeItem({ id: 7, state: "requested", effective_state: "requested", requested_dj_id: "dj-me" })]}
        myReviews={[]}
        formats={undefined}
        me="dj-me"
        between={<p>between the lanes</p>}
      />,
    );

    for (const name of [REVIEW_COPY.screen.requestsTitle, REVIEW_COPY.screen.checkoutsTitle, REVIEW_COPY.myReviews.title]) {
      expect(await screen.findByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: REVIEW_COPY.writeReview })).toBeInTheDocument();
    expect(screen.getByText("between the lanes")).toBeInTheDocument();
  });
});
