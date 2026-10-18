import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { digitalItem, fakeReviewsEndpoints, intakeItem, renderWithProviders, returnedByMusicDirector, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ReviewShelfScreen from "@/src/components/experiences/modern/reviews/ReviewShelfScreen";
import { ACTIVE_ITEMS, useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";
import { useGetIntakeItemsQuery } from "@/lib/features/reviews/intakeApi";
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

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});

const MINE = "/dashboard/reviews/mine";

// The screen over the list as the server answers it, beside the My reviews tab's count pill the cover flies to, so a checkout's reload takes its row away.
function Live() {
  const items = useGetIntakeItemsQuery(ACTIVE_ITEMS).data;
  if (!items) {
    return null;
  }
  return (
    <>
      <a href={MINE} data-tab={MINE}>My reviews<span data-tab-count={MINE}>1</span></a>
      <WithWrite items={items} isMD={false} />
    </>
  );
}

// jsdom has no Web Animations API, so a spec that wants to see the motion supplies it.
const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
const reduceMotion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
const answerCheckout = (status: number, body: Record<string, string>) =>
  server.use(http.post(`${TEST_BACKEND_URL}/intake/5/checkout`, () => HttpResponse.json(body, { status })));

describe("ReviewShelfScreen", () => {
  beforeEach(() => {
    router.push.mockClear();
    vi.mocked(toast).mockClear();
    vi.mocked(toast.error).mockClear();
    animate.mockReset();
    animate.mockImplementation(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
  });
  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    vi.unstubAllGlobals();
  });

  it("renders the review shelf lane with a checkout button for a record on the review shelf", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(
      <WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab" })]} isMD={false} />,
    );

    expect(await screen.findByRole("heading", { level: 3, name: REVIEW_COPY.screen.shelfTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: REVIEW_COPY.screen.review })).toBeInTheDocument();
  });

  it.each([
    ["a DJ", false, 0],
    ["a music director", true, 1],
  ])("draws More beside the checkout button for %s only when they are a music director", async (_who, isMD, more) => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab" })]} isMD={isMD} />);

    expect(await screen.findByRole("button", { name: REVIEW_COPY.screen.review })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: new RegExp(`^${REVIEW_COPY.intake.moreButton}`) })).toHaveLength(more);
    expect(screen.queryByRole("button", { name: new RegExp(`^${REVIEW_COPY.intake.askADj}`) })).not.toBeInTheDocument();
  });

  it("leaves out a checked out record with a submitted review that a music director returned", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab", ...returnedByMusicDirector })]} isMD={false} />);

    expect(await screen.findByText(REVIEW_COPY.screen.shelfEmpty)).toBeInTheDocument();
    expect(screen.queryByText("Stereolab", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REVIEW_COPY.screen.review })).not.toBeInTheDocument();
  });

  it("leaves out a record with a submitted review and shows it again once that review is deleted", async () => {
    fakeReviewsEndpoints();
    const item = intakeItem({ id: 5, artist_name: "Stereolab", submitted_review_count: 1 });
    const { rerender } = renderWithProviders(<WithWrite items={[item]} isMD={false} />);

    expect(await screen.findByText(REVIEW_COPY.screen.shelfEmpty)).toBeInTheDocument();

    rerender(<WithWrite items={[{ ...item, submitted_review_count: 0 }]} isMD={false} />);

    expect(await screen.findByRole("button", { name: REVIEW_COPY.screen.review })).toBeInTheDocument();
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
  describe("checking a record out", () => {
    const ROW = (kind: "disc" | "digital", id = 5) => (kind === "disc" ? intakeItem({ id }) : digitalItem({ id }));
    const serveShelf = (rows: ReturnType<typeof ROW>[], afterCheckout: ReturnType<typeof ROW>[] = []) => {
      fakeReviewsEndpoints({ open: rows });
      let moved = false;
      server.use(
        http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(moved ? afterCheckout : rows)),
        http.post(`${TEST_BACKEND_URL}/intake/:id/checkout`, () => {
          moved = true;
          return HttpResponse.json({ ...rows[0], state: "checked_out" });
        }),
      );
    };

    it.each([
      ["a disc", "disc", REVIEW_COPY.screen.yoursToReview],
      ["a digital album", "digital", REVIEW_COPY.screen.yoursToReviewDigital],
    ] as const)("shows one Review button for %s, toasts where it went, and Open it opens My reviews on that row", async (_name, kind, line) => {
      serveShelf([ROW(kind)]);
      const { user } = renderWithProviders(<Live />);

      const buttons = await screen.findAllByRole("button", { name: REVIEW_COPY.screen.review });
      expect(buttons).toHaveLength(1);
      expect(screen.queryByText(/Check out|^Take$/)).not.toBeInTheDocument();

      await user.click(buttons[0]);

      await waitFor(() => expect(toast).toHaveBeenCalledWith(line, { action: { label: REVIEW_COPY.screen.openIt, onClick: expect.any(Function) } }));
      expect(router.push).not.toHaveBeenCalled();
      const { action } = vi.mocked(toast).mock.calls[0][1] as unknown as { action: { onClick: () => void } };
      action.onClick();
      expect(router.push).toHaveBeenCalledWith(`${MINE}?stage=open&highlight=5`);
    });

    it.each([
      ["reduced motion", true, 0],
      ["motion", false, 2],
    ])("under %s makes the right animation calls once the checkout has landed, and the row goes", async (_name, reduce, calls) => {
      reduceMotion(reduce);
      serveShelf([ROW("disc")]);
      const { user } = renderWithProviders(<Live />);

      await user.click(await screen.findByRole("button", { name: REVIEW_COPY.screen.review }));

      await waitFor(() => expect(screen.queryByRole("button", { name: REVIEW_COPY.screen.review })).not.toBeInTheDocument());
      expect(animate).toHaveBeenCalledTimes(calls);
      expect(toast).toHaveBeenCalledWith(REVIEW_COPY.screen.yoursToReview, expect.anything());
    });

    it.each([
      ["a failed checkout", 500, { message: "boom" }, () => expect(toast.error).toHaveBeenCalledWith(REVIEW_COPY.screen.writeFailed)],
      ["a lost checkout", 409, { message: "server words", reason: "state_changed" }, () => expect(toast).toHaveBeenCalledWith(REVIEW_COPY.screen.raceCheckout)],
    ])("moves nothing after %s", async (_name, status, body, notice) => {
      reduceMotion(false);
      fakeReviewsEndpoints({ open: [ROW("disc")] });
      answerCheckout(status, body);
      const { user } = renderWithProviders(<Live />);

      await user.click(await screen.findByRole("button", { name: REVIEW_COPY.screen.review }));

      await waitFor(notice);
      expect(animate).not.toHaveBeenCalled();
    });

    it("reports no failure when the animation is cancelled after the checkout has landed", async () => {
      reduceMotion(false);
      animate.mockImplementation(() => ({ finished: Promise.reject(new Error("cancelled")), cancel: vi.fn() }));
      serveShelf([ROW("disc")]);
      const { user } = renderWithProviders(<Live />);

      await user.click(await screen.findByRole("button", { name: REVIEW_COPY.screen.review }));

      await waitFor(() => expect(screen.queryByRole("button", { name: REVIEW_COPY.screen.review })).not.toBeInTheDocument());
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledTimes(1);
    });

    it("leaves the focus on the next row's Review button, past its Preview link, once a row leaves", async () => {
      const first = ROW("disc", 5);
      const second = { ...ROW("disc", 6), logged_at: "2026-09-02T12:00:00Z", spotify_url: "https://open.spotify.com/album/x" };
      serveShelf([first, second], [second]);
      const { user } = renderWithProviders(<Live />);

      const [firstButton] = await screen.findAllByRole("button", { name: REVIEW_COPY.screen.review });
      await user.click(firstButton);

      await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("button", { name: REVIEW_COPY.screen.review }).at(-1)));
      expect(document.activeElement).toHaveTextContent(REVIEW_COPY.screen.review);
    });

    it("leaves the focus on the list when the row was the last", async () => {
      serveShelf([ROW("disc")]);
      const { user } = renderWithProviders(<Live />);

      await user.click(await screen.findByRole("button", { name: REVIEW_COPY.screen.review }));

      await waitFor(() => expect(document.activeElement).toHaveAttribute("tabindex", "-1"));
    });
  });
});

describe("ReviewShelfScreen tooltips", () => {
  it.each([
    ["a disc", intakeItem({ id: 5, artist_name: "Stereolab" }), REVIEW_COPY.screen.review, REVIEW_COPY.tooltips.reviewDisc],
    ["a digital album", digitalItem({ id: 5, artist_name: "Stereolab" }), REVIEW_COPY.screen.review, REVIEW_COPY.tooltips.reviewDigital],
  ])("describes the button on %s with its approved text", async (_kind, item, name, description) => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={[item]} isMD={false} />);

    expect(await screen.findByRole("button", { name, description })).toBeInTheDocument();
  });

  it("describes More with its approved text", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(<WithWrite items={[intakeItem({ id: 5, artist_name: "Stereolab" })]} isMD />);

    expect(await screen.findByRole("button", { name: new RegExp(`^${REVIEW_COPY.intake.moreButton}`), description: REVIEW_COPY.tooltips.more })).toBeInTheDocument();
  });
});
