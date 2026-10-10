import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, holdResponse, intakeItem, intakeSlip, renderWithProviders, review, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import IntakeSlipScreen from "@/src/components/experiences/modern/reviews/IntakeSlipScreen";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const ITEM_ID = 11;
const PRINT_PATH = `${TEST_BACKEND_URL}/intake/${ITEM_ID}/print`;

const item = (overrides = {}) =>
  intakeItem({
    id: ITEM_ID,
    artist_name: "Juana Molina",
    album_title: "DOGA",
    record_label: "Sonamos",
    state: "reviewed",
    effective_state: "reviewed",
    accepted_review_id: 40,
    printed_at: null,
    ...overrides,
  });

/** Counts the prints and answers them with `respond`. */
function servePrint(respond: () => Response) {
  const calls = { count: 0 };
  server.use(
    http.post(PRINT_PATH, () => {
      calls.count += 1;
      return respond();
    }),
  );
  return calls;
}

describe("IntakeSlipScreen", () => {
  let print: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    print = vi.spyOn(window, "print").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    print.mockRestore();
  });

  it.each([
    ["lastPrinted", REVIEW_COPY.intakeSlip.lastPrinted, "Last printed"],
    ["reprint", REVIEW_COPY.intakeSlip.reprint, "Printing again replaces the slip on the cover."],
    ["noCover", REVIEW_COPY.intakeSlip.noCover, "There is no review on the cover yet. Choose one on the record's page, then print."],
    ["backToRecord", REVIEW_COPY.intakeSlip.backToRecord, "Back to the record's page"],
    ["handwritten", REVIEW_COPY.intakeSlip.handwritten, "The record's review is handwritten, so it is already on the sleeve. There is nothing to print."],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it.each([
    ["off", "", Authorization.MD],
    ["staff-only for a DJ", "staff", Authorization.DJ],
  ])("renders nothing when the flag is %s", async (_label, flag, who) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = who;
    fakeReviewsEndpoints({ records: [item()] });

    const { container } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("sends no print on load, and one on the press, then shows every field and prints", async () => {
    fakeReviewsEndpoints({ records: [item()] });
    const calls = servePrint(() => HttpResponse.json(intakeSlip()));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    const button = await screen.findByRole("button", { name: "Print the slip" });
    expect(screen.getByText(/Juana Molina · DOGA/)).toBeInTheDocument();
    expect(calls.count).toBe(0);
    expect(screen.queryByRole("group", { name: "Slip preview" })).not.toBeInTheDocument();

    await user.click(button);

    const preview = await screen.findByRole("group", { name: "Slip preview" });
    for (const text of ["Juana Molina", "DOGA", "Sonamos", "spectral, loops", "Argentine songwriter.", "Hushed and strange.", "DJ Me 2026-10-07", "A1, B4"]) {
      expect(within(preview).getByText(text)).toBeInTheDocument();
    }
    expect(calls.count).toBe(1);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("prints the station day of a slip submitted on an evening in station time", async () => {
    fakeReviewsEndpoints({ records: [item()] });
    servePrint(() => HttpResponse.json(intakeSlip({ submitted_at: "2026-10-08T01:30:00Z" })));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    const preview = await screen.findByRole("group", { name: "Slip preview" });
    expect(within(preview).getByText("DJ Me 2026-10-07")).toBeInTheDocument();
  });

  it("prints the review's FCC line, then each confirmed note", async () => {
    fakeReviewsEndpoints({ records: [item()] });
    servePrint(() => HttpResponse.json(intakeSlip({ fcc_notes: [{ track: "B1", note: "Mild language" }, { track: "C2", note: "Static" }] })));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    const preview = await screen.findByRole("group", { name: "Slip preview" });
    const lines = ["A2 has a slip of the tongue", "B1: Mild language", "C2: Static"].map((t) => within(preview).getByText(t));
    expect(lines[0].compareDocumentPosition(lines[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lines[1].compareDocumentPosition(lines[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("adds nothing under the FCC row when there are no confirmed notes", async () => {
    fakeReviewsEndpoints({ records: [item()] });
    servePrint(() => HttpResponse.json(intakeSlip({ fcc: null, fcc_notes: [] })));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    const preview = await screen.findByRole("group", { name: "Slip preview" });
    expect(within(preview).getByText("FCC").nextElementSibling).toBeEmptyDOMElement();
  });

  it("prints an unfiled, reviewed record", async () => {
    fakeReviewsEndpoints({ records: [item({ state: "reviewed", effective_state: "reviewed", album_id: null, filed_at: null })] });
    servePrint(() => HttpResponse.json(intakeSlip()));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    expect(await screen.findByRole("group", { name: "Slip preview" })).toBeInTheDocument();
  });

  it("still shows the Label row, empty, when the record has no label", async () => {
    fakeReviewsEndpoints({ records: [item({ record_label: null })] });
    servePrint(() => HttpResponse.json(intakeSlip({ record_label: null })));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    const preview = await screen.findByRole("group", { name: "Slip preview" });
    expect(within(preview).getByText("Label").nextElementSibling).toBeEmptyDOMElement();
  });

  it("wraps the slip in the print-only structure that hides the rest of the page", async () => {
    fakeReviewsEndpoints({ records: [item()] });
    servePrint(() => HttpResponse.json(intakeSlip()));

    const { user, container } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    const preview = await screen.findByRole("group", { name: "Slip preview" });
    expect(preview.parentElement).toHaveClass("review-slip-print");
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("@media print");
    expect(css).toContain("body * { visibility: hidden; }");
    expect(css).toContain(".review-slip-print * { visibility: visible; }");
  });

  it("says when the slip was last printed", async () => {
    fakeReviewsEndpoints({ records: [item({ printed_at: "2026-10-06T16:00:00Z" })] });

    renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);

    expect(await screen.findByText("Last printed Tuesday, October 6, 2026. Printing again replaces the slip on the cover.")).toBeInTheDocument();
  });

  it("names the station-time day when the print crossed midnight UTC", async () => {
    fakeReviewsEndpoints({ records: [item({ printed_at: "2026-10-03T01:30:00Z" })] });

    renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);

    expect(await screen.findByText("Last printed Friday, October 2, 2026. Printing again replaces the slip on the cover.")).toBeInTheDocument();
  });

  it("does not say when the slip was last printed for a slip never printed", async () => {
    fakeReviewsEndpoints({ records: [item()] });

    renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);

    await screen.findByRole("button", { name: "Print the slip" });
    expect(screen.queryByText(/Last printed/)).not.toBeInTheDocument();
  });

  it("explains a record with no review on the cover, with a link back", async () => {
    fakeReviewsEndpoints({ records: [item({ accepted_review_id: null })] });
    servePrint(() => HttpResponse.json({ message: "server words", reason: "not_reviewed" }, { status: 409 }));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    expect(await screen.findByText("There is no review on the cover yet. Choose one on the record's page, then print.")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/dashboard/admin/intake/${ITEM_ID}`);
    expect(screen.queryByText("server words")).not.toBeInTheDocument();
    expect(print).not.toHaveBeenCalled();
  });

  it("explains a handwritten review, read from the review on the cover", async () => {
    fakeReviewsEndpoints({ records: [item()], reviews: [review({ id: 40, medium: "handwritten", review: null })] });
    servePrint(() => HttpResponse.json({ message: "server words", reason: "not_reviewed" }, { status: 409 }));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    expect(await screen.findByText("The record's review is handwritten, so it is already on the sleeve. There is nothing to print.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("words the refusal from the reloaded record: a cover cleared after load never reads as handwritten", async () => {
    let reads = 0;
    fakeReviewsEndpoints({ records: [item()], reviews: [review({ id: 40, medium: "handwritten", review: null })] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake/${ITEM_ID}`, async () => {
        reads += 1;
        if (reads === 1) return HttpResponse.json(item());
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(item({ accepted_review_id: null }));
      }),
    );
    const calls = servePrint(() => HttpResponse.json({ message: "server words", reason: "not_reviewed" }, { status: 409 }));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));
    await waitFor(() => expect(calls.count).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    expect(await screen.findByText("There is no review on the cover yet. Choose one on the record's page, then print.")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/dashboard/admin/intake/${ITEM_ID}`);
    expect(screen.queryByText(/handwritten/)).not.toBeInTheDocument();
  });

  it("shows the load-failure line, not a guessed case, when the reload after the refusal fails", async () => {
    let reads = 0;
    fakeReviewsEndpoints({ records: [item()], reviews: [review({ id: 40, medium: "handwritten", review: null })] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake/${ITEM_ID}`, () => {
        reads += 1;
        return reads === 1 ? HttpResponse.json(item()) : HttpResponse.json({ message: "down" }, { status: 503 });
      }),
    );
    servePrint(() => HttpResponse.json({ message: "server words", reason: "not_reviewed" }, { status: 409 }));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    expect(await screen.findByText("Couldn't load this record. Please try again.")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByText(/handwritten/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no review on the cover/)).not.toBeInTheDocument();
  });

  it("words a refusal the reloaded record does not explain, when the review on the cover is typed", async () => {
    fakeReviewsEndpoints({ records: [item()], reviews: [review({ id: 40, medium: "typed" })] });
    servePrint(() => HttpResponse.json({ message: "server words", reason: "not_reviewed" }, { status: 409 }));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    expect(await screen.findByText("Couldn't do that. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("server words")).not.toBeInTheDocument();
    expect(screen.queryByText(/handwritten/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no review on the cover/)).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this record. Please try again.")).not.toBeInTheDocument();
  });

  it("shows the load-failure line when the cover read fails after an earlier press read a typed cover", async () => {
    let coverReads = 0;
    fakeReviewsEndpoints({ records: [item()], reviews: [review({ id: 40, medium: "typed" })] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews/40`, () => {
        coverReads += 1;
        return coverReads <= 2 ? HttpResponse.json(review({ id: 40, medium: "typed" })) : HttpResponse.json({ message: "down" }, { status: 503 });
      }),
    );
    servePrint(() => HttpResponse.json({ message: "server words", reason: "not_reviewed" }, { status: 409 }));

    const { user, store } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    const button = await screen.findByRole("button", { name: "Print the slip" });
    await user.click(button);
    expect(await screen.findByText("Couldn't do that. Please try again.")).toBeInTheDocument();
    // The print invalidates "Review", which evicts an unsubscribed cover; a held subscription keeps the typed cover cached, so the failed read below meets a stale `data`.
    const subscription = store.dispatch(reviewApi.endpoints.getReview.initiate(40));
    await subscription;

    await user.click(button);

    expect(await screen.findByText("Couldn't load this record. Please try again.")).toBeInTheDocument();
    expect(coverReads).toBe(3);
    expect(screen.queryByText("Couldn't do that. Please try again.")).not.toBeInTheDocument();
    subscription.unsubscribe();
  });

  it("refreshes the record after a print, so it says when the slip was last printed", async () => {
    let printed = false;
    fakeReviewsEndpoints({ records: [item()] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake/${ITEM_ID}`, () => HttpResponse.json(item(printed ? { printed_at: "2026-10-07T16:00:00Z" } : {}))),
    );
    servePrint(() => {
      printed = true;
      return HttpResponse.json(intakeSlip());
    });

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    expect(await screen.findByText("Last printed Wednesday, October 7, 2026. Printing again replaces the slip on the cover.")).toBeInTheDocument();
  });

  it("words any other failure itself", async () => {
    fakeReviewsEndpoints({ records: [item()] });
    servePrint(() => HttpResponse.json({ message: "server words" }, { status: 500 }));

    const { user } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
    await user.click(await screen.findByRole("button", { name: "Print the slip" }));

    await waitFor(() => expect(screen.getByText("Couldn't do that. Please try again.")).toBeInTheDocument());
    expect(screen.queryByText("server words")).not.toBeInTheDocument();
  });

  describe("when the page is gone before the print answers", () => {
    it("reloads the record once, and throws nothing, when the answer is a not_reviewed refusal", async () => {
      fakeReviewsEndpoints({ records: [item()] });
      const { calls, release, answered } = holdResponse("post", PRINT_PATH, () => HttpResponse.json({ message: "server words", reason: "not_reviewed" }, { status: 409 }));
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const rejections: unknown[] = [];
      const onRejection = (reason: unknown) => rejections.push(reason);
      process.on("unhandledRejection", onRejection);

      const { user, unmount } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
      await user.click(await screen.findByRole("button", { name: "Print the slip" }));
      await waitFor(() => expect(calls.count).toBe(1));
      // The reload's read is held, so the spec sees it arrive and settle rather than sleeping.
      const reload = holdResponse("get", `${TEST_BACKEND_URL}/intake/${ITEM_ID}`, () => HttpResponse.json(item()));

      unmount();
      release();
      await answered;
      // A hook refetch() throws here before any request goes out, so the read below never happens.
      await waitFor(() => expect(reload.calls.count).toBe(1));
      reload.release();
      await reload.answered;

      expect(reload.calls.count).toBe(1);
      expect(errors).not.toHaveBeenCalled();
      expect(rejections).toEqual([]);
      process.off("unhandledRejection", onRejection);
      errors.mockRestore();
    });

    it("does not open the print dialog when the answer is a success", async () => {
      fakeReviewsEndpoints({ records: [item()] });
      const { calls, release, answered } = holdResponse("post", PRINT_PATH, () => HttpResponse.json(intakeSlip()));

      const { user, unmount } = renderWithProviders(<IntakeSlipScreen id={ITEM_ID} />);
      await user.click(await screen.findByRole("button", { name: "Print the slip" }));
      await waitFor(() => expect(calls.count).toBe(1));

      unmount();
      release();
      await answered;

      expect(print).not.toHaveBeenCalled();
    });
  });
});
