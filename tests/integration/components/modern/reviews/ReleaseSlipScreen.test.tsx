import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, holdResponse, intakeSlip, renderWithProviders, review, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

let authority = Authorization.MD;
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "md-me", authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import { toast } from "sonner";
import ReleaseSlipScreen from "@/src/components/experiences/modern/reviews/ReleaseSlipScreen";

const ALBUM_ID = 7;
const REVIEW_ID = 40;
const PRINT_PATH = `${TEST_BACKEND_URL}/library/${ALBUM_ID}/print`;
const SERVER_MESSAGE = "review_id must name a typed, submitted review of this release";

const serveRecord = () =>
  fakeReviewsEndpoints({
    releases: [{ id: ALBUM_ID, album_title: "DOGA", artist_name: "Juana Molina", label: "Sonamos" }],
    reviews: [review({ id: REVIEW_ID, album_id: ALBUM_ID, intake_item_id: null, author: "DJ Me", medium: "typed", status: "submitted" })],
  });

/** Counts the prints, records their bodies, and answers them with `respond`. */
function servePrint(respond: () => Response) {
  const calls = { count: 0, bodies: [] as unknown[] };
  server.use(
    http.post(PRINT_PATH, async ({ request }) => {
      calls.count += 1;
      calls.bodies.push(await request.json());
      return respond();
    }),
  );
  return calls;
}

describe("ReleaseSlipScreen", () => {
  let print: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    print = vi.spyOn(window, "print").mockImplementation(() => {});
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    print.mockRestore();
  });

  it.each([
    ["off", "", Authorization.MD],
    ["staff-only for a DJ", "staff", Authorization.DJ],
  ])("renders nothing when the flag is %s", async (_label, flag, who) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    authority = who;
    serveRecord();

    const { container } = renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={REVIEW_ID} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("says whose review prints for which record, sends nothing on load, and sends { review_id } on the press", async () => {
    serveRecord();
    const calls = servePrint(() => HttpResponse.json(intakeSlip()));

    const { user } = renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={REVIEW_ID} />);
    const button = await screen.findByRole("button", { name: "Print the slip" });
    expect(screen.getByText("This prints DJ Me's review for the cover of Juana Molina — DOGA. If the cover already has a slip, this one replaces it.")).toBeInTheDocument();
    expect(calls.count).toBe(0);
    expect(screen.queryByRole("group", { name: "Slip preview" })).not.toBeInTheDocument();

    await user.click(button);

    await screen.findByRole("group", { name: "Slip preview" });
    expect(calls.bodies).toEqual([{ review_id: REVIEW_ID }]);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("drops the name clause from the lead line for a review with no author", async () => {
    fakeReviewsEndpoints({
      releases: [{ id: ALBUM_ID, album_title: "DOGA", artist_name: "Juana Molina", label: "Sonamos" }],
      reviews: [review({ id: REVIEW_ID, album_id: ALBUM_ID, intake_item_id: null, author: null, medium: "typed", status: "submitted" })],
    });

    renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={REVIEW_ID} />);

    await screen.findByRole("button", { name: "Print the slip" });
    expect(screen.getByText("This prints the review for the cover of Juana Molina — DOGA. If the cover already has a slip, this one replaces it.")).toBeInTheDocument();
  });

  it("renders the returned slip with its FCC line and confirmed notes", async () => {
    serveRecord();
    servePrint(() => HttpResponse.json(intakeSlip()));

    const { user } = renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={REVIEW_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    const preview = await screen.findByRole("group", { name: "Slip preview" });
    for (const text of ["Hushed and strange.", "DJ Me 2026-10-07", "A2 has a slip of the tongue", "B1: Mild language"]) {
      expect(within(preview).getByText(text)).toBeInTheDocument();
    }
    expect(preview.parentElement).toHaveClass("review-slip-print");
  });

  it("shows the approved line for a 400, never the server's message, and does not print", async () => {
    serveRecord();
    servePrint(() => HttpResponse.json({ message: SERVER_MESSAGE }, { status: 400 }));

    const { user } = renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={REVIEW_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("This review can't be printed. It may be handwritten, or it may have been deleted since the page opened.");
    expect(screen.getByRole("link")).toHaveAttribute("href", `/dashboard/album/${ALBUM_ID}`);
    expect(screen.queryByText(SERVER_MESSAGE)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(SERVER_MESSAGE);
    expect(print).not.toHaveBeenCalled();
  });

  it.each([404, 500])("words a %s with the generic write failure", async (status) => {
    serveRecord();
    servePrint(() => HttpResponse.json({ message: "server words" }, { status }));

    const { user } = renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={REVIEW_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    await waitFor(() => expect(screen.getByText("Couldn't do that. Please try again.")).toBeInTheDocument());
    expect(screen.queryByText("server words")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not open the print dialog when the page is gone before a success answers", async () => {
    serveRecord();
    const { calls, release, answered } = holdResponse("post", PRINT_PATH, () => HttpResponse.json(intakeSlip()));

    const { user, unmount } = renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={REVIEW_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));
    await waitFor(() => expect(calls.count).toBe(1));

    unmount();
    release();
    await answered;

    expect(print).not.toHaveBeenCalled();
  });
});
