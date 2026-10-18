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
  const { write, lock } = useReviewWrite();
  return <ReviewShelfScreen {...props} reviewers={reviewers} write={write} lock={lock} />;
}

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

describe("ReviewShelfScreen", () => {
  it("renders the review shelf lane with a checkout button for a record on the review shelf", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(
      <WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab" })]} isMD={false} />,
    );

    expect(await screen.findByRole("heading", { level: 3, name: REVIEW_COPY.screen.shelfTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: REVIEW_COPY.screen.checkOut })).toBeInTheDocument();
  });

  it("leaves out a checked out record with a submitted review that a music director returned", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab", ...returnedByMusicDirector })]} isMD={false} />);

    expect(await screen.findByText(REVIEW_COPY.screen.shelfEmpty)).toBeInTheDocument();
    expect(screen.queryByText("Stereolab", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REVIEW_COPY.screen.checkOut })).not.toBeInTheDocument();
  });

  it("leaves out a record with a submitted review and shows it again once that review is deleted", async () => {
    fakeReviewsEndpoints();
    const item = intakeItem({ id: 5, artist_name: "Stereolab", submitted_review_count: 1 });
    const { rerender } = renderWithProviders(<WithWrite items={[item]} isMD={false} />);

    expect(await screen.findByText(REVIEW_COPY.screen.shelfEmpty)).toBeInTheDocument();

    rerender(<WithWrite items={[{ ...item, submitted_review_count: 0 }]} isMD={false} />);

    expect(await screen.findByRole("button", { name: REVIEW_COPY.screen.checkOut })).toBeInTheDocument();
  });

  it.each([
    ["three records added on different days", [
      { id: 1, artist_name: "Stereolab", logged_at: "2026-10-03T12:00:00Z" },
      { id: 2, artist_name: "Cat Power", logged_at: "2026-10-01T12:00:00Z" },
      { id: 3, artist_name: "Jessica Pratt", logged_at: "2026-10-02T12:00:00Z" },
    ], ["Cat Power", "Jessica Pratt", "Stereolab"]],
    ["two records added at the same moment", [
      { id: 9, artist_name: "Stereolab", logged_at: "2026-10-01T12:00:00Z" },
      { id: 4, artist_name: "Cat Power", logged_at: "2026-10-01T12:00:00Z" },
    ], ["Cat Power", "Stereolab"]],
  ])("lists %s oldest first", async (_name, records, expected) => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={records.map((r) => intakeItem(r))} isMD={false} />);

    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => expected.find((artist) => row.textContent?.includes(artist)))).toEqual(expected);
  });

  it.each([
    ["a DJ", false],
    ["a music director", true],
  ])("says what the review shelf is above the list for %s, and keeps the region named", async (_who, isMD) => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab" })]} isMD={isMD} />);

    const line = await screen.findByText(REVIEW_COPY.screen.shelfLine);
    const region = screen.getByRole("region", { name: REVIEW_COPY.screen.shelfTitle });
    expect(line.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region).not.toContainElement(line);
  });

  it("takes the lane's heading off the screen while the section stays named The review shelf", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab" })]} isMD={false} />);

    const heading = await screen.findByRole("heading", { level: 3, name: REVIEW_COPY.screen.shelfTitle });
    expect(screen.getByRole("region", { name: REVIEW_COPY.screen.shelfTitle })).toBeInTheDocument();
    expect(heading).toHaveStyle({ position: "absolute", width: "1px", height: "1px" });
  });
});
