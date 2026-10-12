import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { Review } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, fccNote, intakeItem, renderWithProviders, review, reviewRevision, reviewsSettled, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { reviewApi } from "@/lib/features/reviews/reviewApi";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const mockAuth = vi.hoisted(() => ({
  id: "dj-me",
  authority: 1 as number,
  djName: "DJ Me" as string | undefined,
  realName: "Juana Molina" as string | undefined,
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { toast } from "sonner";
import ReviewEditor from "@/src/components/experiences/modern/reviews/ReviewEditor";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import { STICKY_ROOM_PROPERTY } from "@/src/components/experiences/modern/reviews/useStickyRoom";
import { APPBAR_CLEARANCE_PX, APPBAR_HEIGHT_PX, APPBAR_OFFSET_PX } from "@/src/components/shared/Theme/Appbar";

const CONSENT = { publish_website: false, publish_apps: false, publish_instagram: false, credit: null, in_use: false } as Partial<Review>;
const DRAFT = review({ ...CONSENT, author_user_id: "dj-me" });
const SUBMITTED = review({ ...CONSENT, author_user_id: "dj-me", status: "submitted" });
const IN_USE = "A music director is using this as the record's review. Ask them to remove it.";

const PRIVACY = "Only you can read this draft. Music directors can see that you have one in progress, not what it says.";

const RECORD = intakeItem({ id: 2 });

/** Every stylesheet rule emotion wrote, as one string, for pinning the layout's declarations. */
const allCss = () => [...document.querySelectorAll("style")].map((el) => el.textContent ?? "").join("\n") + [...document.styleSheets].map((sheet) => [...sheet.cssRules].map((r) => r.cssText).join("\n")).join("\n");
/** The body of the rule block that follows `selectorStart` in the page's CSS, braces balanced. */
const blockAfter = (css: string, selectorStart: string) => {
  const from = css.indexOf(selectorStart);
  if (from < 0) return "";
  let depth = 0;
  for (let i = css.indexOf("{", from); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", from) + 1, i);
  }
  return "";
};
/** The CSS emotion generated for an element, with the contents of every `@container`/`@media` block it has. */
const cssOf = (el: HTMLElement) => {
  const cls = [...el.classList].find((c) => c.startsWith("css-"))!;
  const css = allCss();
  return { all: [...css.matchAll(new RegExp(`\\.${cls}[^{]*\\{[^}]*\\}`, "g"))].map((m) => m[0]).join("\n"), css, cls };
};

function serve(served: Review = DRAFT) {
  fakeReviewsEndpoints({ reviews: [served], records: [RECORD] });
}

describe("ReviewEditor", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
    mockAuth.djName = "DJ Me";
    mockAuth.realName = "Juana Molina";
    router.replace.mockClear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("shows the draft-privacy line and the five slip fields with their help text", async () => {
    serve();
    renderWithProviders(<ReviewEditor id={40} />);

    expect(await screen.findByText(PRIVACY)).toBeInTheDocument();
    for (const { label, help } of Object.values(REVIEW_COPY.fields)) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
      expect(screen.getByText(help)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Review")).toHaveValue("Warm.");
  });

  it.each([
    ["save", REVIEW_COPY.save, "Save"],
    ["savedChange", REVIEW_COPY.savedChange, "Saved."],
    ["cancel", REVIEW_COPY.cancel, "Cancel"],
    ["leave.title", REVIEW_COPY.leave.title, "Leave without saving?"],
    ["leave.body", REVIEW_COPY.leave.body, "Your changes since the last save will be lost."],
    ["leave.leave", REVIEW_COPY.leave.leave, "Leave"],
    ["leave.keepEditing", REVIEW_COPY.leave.keepEditing, "Keep editing"],
    ["submitNeedsReview", REVIEW_COPY.submitNeedsReview, "Write the review before you submit it."],
    ["couldNotSubmit", REVIEW_COPY.couldNotSubmit, "Couldn't submit the review. Please try again."],
    ["alreadySubmitted", REVIEW_COPY.alreadySubmitted, "This review was already submitted."],
    ["couldNotDelete", REVIEW_COPY.couldNotDelete, "Couldn't delete the review. Please try again."],
    ["slip.heading", REVIEW_COPY.slip.heading, "As it will print"],
    ["consent.legend", REVIEW_COPY.consent.legend, "Where may this review be published?"],
    ["consent.creditLegend", REVIEW_COPY.consent.creditLegend, "How should we credit you?"],
    ["consent.notPublishedYet", REVIEW_COPY.consent.notPublishedYet, "FCC notes are never published. Nothing is published yet; the station is collecting your answer for later."],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it("previews the library release of a library-release review", async () => {
    fakeReviewsEndpoints({
      reviews: [review({ intake_item_id: null, album_id: 7 })],
      releases: [{ id: 7, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos", format_name: "CD", legacy_release_id: 1 }],
    });
    renderWithProviders(<ReviewEditor id={40} />);

    const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
    expect(await within(preview).findByText("Juana Molina")).toBeInTheDocument();
    expect(within(preview).getByText("DOGA")).toBeInTheDocument();
    expect(within(preview).getByText("Sonamos")).toBeInTheDocument();
  });

  it.each([
    ["a submitted review shows the date it was submitted", { status: "submitted", submitted_at: "2026-10-07T16:00:00Z" }, "DJ Me 2026-10-07"],
    ["a review submitted on an evening in station time shows the station day, not the UTC day", { status: "submitted", submitted_at: "2026-10-08T01:30:00Z" }, "DJ Me 2026-10-07"],
    ["a draft shows the date it was added", { submitted_at: null }, "DJ Me 2026-10-01"],
  ] as const)("%s", async (_name, overrides, expected) => {
    serve({ ...DRAFT, add_date: "2026-10-01", ...overrides } as Review);
    renderWithProviders(<ReviewEditor id={40} />);

    const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
    expect(within(preview).getByText(expected)).toBeInTheDocument();
  });

  it("reflects each field in the slip preview as it is typed", async () => {
    serve();
    const { user } = renderWithProviders(<ReviewEditor id={40} />);
    const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
    expect(await within(preview).findByText("Stereolab")).toBeInTheDocument();
    expect(within(preview).getByText("Duophonic")).toBeInTheDocument();

    // Every typed value differs from every value the fixtures carry, so a
    // preview that shows the saved review instead of the typing cannot pass.
    const typed = [
      ["buzzwords", "hushed"],
      ["artist_blurb", "A Paris band"],
      ["review", "Bright."],
      ["recommended_tracks", "A1, B4"],
      ["fcc", "Track two"],
    ] as const;
    const fixtureValues = [...Object.values(DRAFT), ...Object.values(RECORD)].map(String);
    for (const [name, text] of typed) {
      expect(fixtureValues).not.toContain(text);
      const field = screen.getByLabelText(REVIEW_COPY.fields[name].label);
      await user.clear(field);
      await user.type(field, text);
      expect(within(preview).getByText(text)).toBeInTheDocument();
    }
    expect(within(preview).queryByText("Warm.")).not.toBeInTheDocument();
  });

  it("labels the slip's rows from the copy module, in the printed slip's order", async () => {
    serve();
    renderWithProviders(<ReviewEditor id={40} />);
    const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });

    const { slip, fields } = REVIEW_COPY;
    expect(Array.from(preview.querySelectorAll("strong"), (el) => el.textContent)).toEqual([
      slip.artist,
      slip.album,
      slip.label,
      fields.buzzwords.label,
      slip.artistBlurb,
      slip.review,
      slip.reviewer,
      slip.recommended,
      fields.fcc.label,
    ]);
  });

  it.each([
    ["shows", "draft", true],
    ["does not show", "submitted", false],
  ] as const)("%s the draft-privacy line for a %s review", async (_verb, status, shown) => {
    serve({ ...DRAFT, status } as Review);
    renderWithProviders(<ReviewEditor id={40} />);

    expect(await screen.findByLabelText(REVIEW_COPY.fields.review.label)).toHaveValue("Warm.");
    if (shown) expect(screen.getByText(PRIVACY)).toBeInTheDocument();
    else expect(screen.queryByText(PRIVACY)).not.toBeInTheDocument();
  });

  it("saves the draft with a PATCH of the fields", async () => {
    serve();
    let seen: { path: string; body: unknown } | undefined;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/reviews/40`, async ({ request }) => {
        seen = { path: new URL(request.url).pathname, body: await request.json() };
        return HttpResponse.json(DRAFT);
      }),
    );

    const { user } = renderWithProviders(<ReviewEditor id={40} />);
    await user.type(await screen.findByLabelText("Buzzwords"), "hushed");
    await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(REVIEW_COPY.saved));
    expect(seen).toEqual({
      path: "/reviews/40",
      body: {
        buzzwords: "hushed",
        artist_blurb: null,
        review: "Warm.",
        recommended_tracks: null,
        fcc: null,
        publish_website: false,
        publish_apps: false,
        publish_instagram: false,
        credit: null,
      },
    });
  });

  it("says the review could not load on an outage", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
    renderWithProviders(<ReviewEditor id={40} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_COPY.couldNotLoad);
  });

  it("shows the record's FCC notes beside the editor for a logged record, and none for a library release", async () => {
    fakeReviewsEndpoints({
      reviews: [review({ intake_item_id: 2 }), review({ id: 41, intake_item_id: null, album_id: 7 })],
      records: [RECORD],
      fccNotesForItem: { "2": [fccNote({ intake_item_id: 2, track: "B1", note: "A word." })] },
      fccNotesForRelease: { "7": [fccNote({ id: 2, album_id: 7, intake_item_id: null })] },
    });
    const logged = renderWithProviders(<ReviewEditor id={40} />);
    expect(await screen.findByText("B1: A word.")).toBeInTheDocument();
    logged.unmount();

    renderWithProviders(<ReviewEditor id={41} />);
    await screen.findByLabelText("Review");
    expect(screen.queryByText("FCC notes")).not.toBeInTheDocument();
  });

  it.each([
    ["the flag is off", "", Authorization.MD],
    ["a DJ is under staff", "staff", Authorization.DJ],
  ])("renders nothing and reads nothing when %s", async (_label, flag, authority) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    serve();
    const requested: string[] = [];
    const log = ({ request }: { request: Request }) => void requested.push(new URL(request.url).pathname);
    server.events.on("request:start", log);

    try {
      const { container, store } = renderWithProviders(<ReviewEditor id={40} />);
      await reviewsSettled(store);
      expect(requested.filter((p) => p.startsWith("/reviews"))).toEqual([]);
      expect(container).toBeEmptyDOMElement();
    } finally {
      server.events.removeListener("request:start", log);
    }
  });

  describe("publishing consent", () => {
    it("hides the credit choice until a surface is ticked, then offers the DJ name only to an account that has one", async () => {
      serve();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await screen.findByLabelText("Review");
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: "Instagram" }));
      expect(screen.getAllByRole("radio")).toHaveLength(3);
      for (const name of ["DJ name (DJ Me)", "Real name (Juana Molina)", "No name"]) {
        expect(screen.getByRole("radio", { name })).toBeInTheDocument();
      }
    });

    it("omits the DJ name option for an account without one", async () => {
      mockAuth.djName = undefined;
      serve();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("checkbox", { name: "Website" }));

      expect(screen.queryByRole("radio", { name: /DJ name/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole("radio")).toHaveLength(2);
    });

    it("sends unticked surfaces as false and the chosen credit", async () => {
      serve();
      let body: unknown;
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, async ({ request }) => ((body = await request.json()), HttpResponse.json(DRAFT))));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("checkbox", { name: "WXYC apps" }));
      await user.click(screen.getByRole("radio", { name: /Real name/ }));
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));

      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(body).toMatchObject({ publish_website: false, publish_apps: true, publish_instagram: false, credit: "real_name" });
    });

    it("shows the block to the linked author of an on-behalf review", async () => {
      serve(review({ author: "Typed Name", author_user_id: "dj-me", recorded_by_user_id: "md-1" } as Partial<Review>));
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByRole("checkbox", { name: "Website" })).toBeInTheDocument();
    });

    it("shows a music director the slip and no consent controls, and sends no publish_* or credit", async () => {
      mockAuth.authority = Authorization.MD;
      serve(review({ author_user_id: "dj-other", author: "Cat Power" }));
      let body: Record<string, unknown> = {};
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, async ({ request }) => ((body = (await request.json()) as Record<string, unknown>), HttpResponse.json(DRAFT))));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByText("Only the author can answer the publishing question.")).toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(Object.keys(body).sort()).toEqual(["artist_blurb", "buzzwords", "fcc", "recommended_tracks", "review"]);
    });
  });

  describe("a music director editing another person's review", () => {
    const EDITING = "You are editing Cat Power's review. Your change is saved under your name in the review's history";
    it.each([
      ["a submitted, linked review", { status: "submitted", author_user_id: "dj-other" }, `${EDITING}, and the author is emailed that it was edited.`],
      ["an unlinked review", { status: "submitted", author_user_id: null }, `${EDITING}.`],
      ["a draft", { status: "draft", author_user_id: "dj-other" }, `${EDITING}.`],
    ] as const)("words the line for %s", async (_label, fields, line) => {
      mockAuth.authority = Authorization.MD;
      serve(review({ author: "Cat Power", ...fields } as Partial<Review>));
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByText(line)).toBeInTheDocument();
      expect(screen.getByLabelText("Review")).not.toBeDisabled();
    });
  });

  describe("submitting", () => {
    it.each([
      ["a logged record", { intake_item_id: 2, album_id: null }, "Submit this review? The music directors will be emailed that it is ready. You can keep editing it afterwards."],
      ["a library release", { intake_item_id: null, album_id: 7 }, "Submit this review? It will appear on the record's page. You can keep editing it afterwards."],
    ] as const)("confirms a review of %s, saves, then submits", async (_label, subject, confirmation) => {
      serve(review({ author_user_id: "dj-me", ...subject } as Partial<Review>));
      const seen: string[] = [];
      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => (seen.push("patch"), HttpResponse.json(DRAFT))),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => (seen.push("submit"), HttpResponse.json(SUBMITTED))),
      );
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: "Submit" }));

      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText(confirmation)).toBeInTheDocument();
      expect(seen).toEqual([]);
      await user.click(within(dialog).getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(seen).toEqual(["patch", "submit"]));
    });

    it.each([null, "   "])("disables Submit with a reason while a typed review's text is %j", async (text) => {
      serve(review({ author_user_id: "dj-me", medium: "typed", review: text }));
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByRole("button", { name: "Submit" })).toBeDisabled();
      expect(screen.getByText(REVIEW_COPY.submitNeedsReview)).toBeInTheDocument();
    });

    it("submits a handwritten review that has no text", async () => {
      serve(review({ author_user_id: "dj-me", medium: "handwritten", review: null }));
      const seen: string[] = [];
      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => (seen.push("patch"), HttpResponse.json(DRAFT))),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => (seen.push("submit"), HttpResponse.json(SUBMITTED))),
      );
      const { user } = renderWithProviders(<ReviewEditor id={40} />);

      const submit = await screen.findByRole("button", { name: "Submit" });
      expect(submit).toBeEnabled();
      expect(screen.queryByText(REVIEW_COPY.submitNeedsReview)).not.toBeInTheDocument();
      await user.click(submit);
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(seen).toEqual(["patch", "submit"]));
    });

    it("shows the server's message for a 400 on submit", async () => {
      serve();
      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => HttpResponse.json({ message: "A typed review needs text." }, { status: 400 })),
      );
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: "Submit" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A typed review needs text."));
    });

    it("says the review was already submitted on a 409 not_draft", async () => {
      serve();
      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => HttpResponse.json({ message: "x", reason: "not_draft" }, { status: 409 })),
      );
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: "Submit" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REVIEW_COPY.alreadySubmitted));
    });

    it("shows the message when a Save would blank a submitted review", async () => {
      serve(SUBMITTED);
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json({ message: "A submitted review needs text." }, { status: 400 })));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.clear(await screen.findByLabelText("Review"));
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.save }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A submitted review needs text."));
    });
  });

  describe.each([
    ["has not been printed", null],
    ["has been printed", "2026-10-05T12:00:00Z"],
  ])("a submitted review that %s", (_label, printed_at) => {
    it("stays editable for its author under the submitted banner", async () => {
      serve({ ...SUBMITTED, printed_at } as Review);
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByText("Submitted. You can keep editing; each saved change is kept in the review's history.")).toBeInTheDocument();
      expect(screen.getByLabelText("Review")).not.toBeDisabled();
      expect(screen.getByRole("button", { name: REVIEW_COPY.save })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    it("confirms, deletes, and leaves the editor", async () => {
      serve(SUBMITTED);
      let deleted = 0;
      server.use(http.delete(`${TEST_BACKEND_URL}/reviews/40`, () => (deleted++, new HttpResponse(null, { status: 204 }))));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: "Delete" }));

      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText("Delete this review? Its history goes with it. This cannot be undone.")).toBeInTheDocument();
      expect(deleted).toBe(0);
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews"));
      expect(deleted).toBe(1);
    });

    it("answers a 409 in_use with the approved sentence and keeps the review editable", async () => {
      serve();
      server.use(http.delete(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json({ message: "server words", reason: "in_use" }, { status: 409 })));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText(IN_USE)).toBeInTheDocument();
      expect(screen.queryByText("server words")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Review")).not.toBeDisabled();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it("disables Delete beside the sentence when the review is already in use", async () => {
      serve({ ...SUBMITTED, in_use: true } as Review);
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByRole("button", { name: "Delete" })).toBeDisabled();
      expect(screen.getByText(IN_USE)).toBeInTheDocument();
    });

    it("offers Delete to the author only", async () => {
      mockAuth.authority = Authorization.MD;
      serve(review({ author_user_id: "dj-other" }));
      renderWithProviders(<ReviewEditor id={40} />);

      await screen.findByLabelText("Review");
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });
  });

  describe("history", () => {
    it("links to the history once the review is submitted", async () => {
      serve(SUBMITTED);
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByRole("link", { name: "History" })).toHaveAttribute("href", "/dashboard/reviews/40/history");
    });

    it("has no history link on a draft", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      await screen.findByText(PRIVACY);
      expect(screen.queryByRole("link", { name: "History" })).not.toBeInTheDocument();
    });

    it.each<[string, boolean, number, string | null]>([
      ["in use, newest revision printed", true, 1, "This is the version printed on the cover."],
      ["in use, edited after printing", true, 2, "See the printed version"],
      ["not in use, newest revision printed", false, 1, null],
      ["not in use, edited after printing", false, 2, null],
    ])("printed-version note on a printed review that is %s", async (_name, inUse, count, expected) => {
      const requested = vi.fn();
      fakeReviewsEndpoints({
        reviews: [{ ...SUBMITTED, in_use: inUse, printed_revision_id: 11, printed_at: "2026-10-02T16:00:00Z" } as Review],
        records: [RECORD],
      });
      server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => {
        requested();
        return HttpResponse.json([reviewRevision({ id: 11, revision: 1 }), reviewRevision({ id: 12, revision: 2 })].slice(0, count));
      }));
      const { store } = renderWithProviders(<ReviewEditor id={40} />);

      await screen.findByRole("link", { name: "History" });
      if (expected) {
        expect(await screen.findByText(expected)).toBeInTheDocument();
      } else {
        expect(reviewApi.endpoints.getReviewRevisions.select(40)(store.getState()).isUninitialized).toBe(true);
        await reviewsSettled(store);
        expect(screen.queryByText(/printed on the cover|earlier version of this review|printed version/)).not.toBeInTheDocument();
        expect(requested).not.toHaveBeenCalled();
      }
    });
  });

  describe("layout", () => {
    it("heads the page with the record's artist", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByRole("heading", { name: "Stereolab" })).toBeInTheDocument();
    });

    it.each<[string, number, string, "draft" | "submitted", string]>([
      ["the author's draft", Authorization.DJ, "dj-me", "draft", PRIVACY],
      ["the author's submitted review", Authorization.DJ, "dj-me", "submitted", REVIEW_COPY.submittedBanner],
      ["a music director on someone else's draft", Authorization.MD, "dj-other", "draft", "You are editing"],
      ["a music director on someone else's submitted review", Authorization.MD, "dj-other", "submitted", "You are editing"],
    ])("shows exactly one status line for %s", async (_name, authority, author, status, expected) => {
      mockAuth.authority = authority;
      serve({ ...DRAFT, author_user_id: author, status } as Review);
      renderWithProviders(<ReviewEditor id={40} />);

      await screen.findByRole("heading", { name: "Stereolab" });
      const lines = [PRIVACY, REVIEW_COPY.submittedBanner, /^You are editing/].map((line) => screen.queryAllByText(line).length);
      expect(lines.reduce((a, b) => a + b, 0)).toBe(1);
      expect(screen.getByText(new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeInTheDocument();
    });

    it("puts each field's help before its box, and describes the box with it", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      for (const { label, help } of Object.values(REVIEW_COPY.fields)) {
        const box = await screen.findByLabelText(label);
        const text = screen.getByText(help);
        expect(text.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(box).toHaveAccessibleDescription(help);
      }
    });

    it("asks the publishing question in a group named by its legend, after the slip fields", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const group = await screen.findByRole("group", { name: REVIEW_COPY.consent.legend });
      const last = screen.getByLabelText(REVIEW_COPY.fields.fcc.label);
      expect(last.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("labels the slip preview region, with the FCC panel after it", async () => {
      fakeReviewsEndpoints({ reviews: [{ ...DRAFT, intake_item_id: 2 } as Review], records: [RECORD] });
      renderWithProviders(<ReviewEditor id={40} />);

      const region = await screen.findByRole("region", { name: REVIEW_COPY.slip.heading });
      expect(within(region).getByRole("group", { name: REVIEW_COPY.slip.name })).toBeInTheDocument();
      const fcc = await screen.findByRole("region", { name: "FCC notes" });
      expect(region.compareDocumentPosition(fcc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("keeps Save draft, Submit and Delete in one action bar, with the reason right beside a disabled Submit", async () => {
      serve({ ...DRAFT, review: "" } as Review);
      renderWithProviders(<ReviewEditor id={40} />);

      const submit = await screen.findByRole("button", { name: REVIEW_COPY.submit });
      const bar = submit.parentElement!;
      expect(within(bar).getByRole("button", { name: REVIEW_COPY.saveDraft })).toBeInTheDocument();
      expect(submit).toBeDisabled();
      expect(within(bar).getByRole("button", { name: REVIEW_COPY.delete })).toBeInTheDocument();
      const reason = within(bar).getByText(REVIEW_COPY.submitNeedsReview);
      expect(submit.previousElementSibling).toBe(reason);
      expect(submit).toHaveAccessibleDescription(REVIEW_COPY.submitNeedsReview);
    });

    it("is not a toolbar, which would promise arrow-key focus it does not have", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      await screen.findByRole("button", { name: REVIEW_COPY.submit });
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("names the slip region with a heading under the record's h3", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const heading = await screen.findByRole("heading", { name: REVIEW_COPY.slip.heading, level: 4 });
      expect(screen.getByRole("region", { name: REVIEW_COPY.slip.heading })).toContainElement(heading);
    });

    it("goes to two columns at an editor width of 800px, with a bounded slip column that sticks within the viewport", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const column = (await screen.findByRole("region", { name: REVIEW_COPY.slip.heading })).parentElement!;
      const grid = column.parentElement!;
      const { css } = cssOf(grid);
      expect(css).toContain("@container (min-width: 800px)");
      expect(css).not.toContain("1280px");
      expect(css).toMatch(/grid-template-columns:\s*minmax\(20rem, 1fr\) minmax\(0, 4\.25in\)/);
      // The column's own rules only (its class), not the sticky bar's later in the sheet.
      const { all: own } = cssOf(column);
      expect(own).toMatch(/position:\s*sticky/);
      expect(own).toMatch(/top:\s*0/);
      expect(own).toMatch(/align-self:\s*start/);
      expect(own).toMatch(new RegExp(`max-height:\\s*var\\(${STICKY_ROOM_PROPERTY},\\s*none\\)`));
      expect(own).not.toMatch(/100dvh/);
      expect(own).toMatch(/overflow-y:\s*auto/);
    });

    it("sets the slip column's room to the scroll region's height minus the action bar's, and keeps it current", async () => {
      const observers: Array<() => void> = [];
      vi.stubGlobal("ResizeObserver", class { constructor(cb: () => void) { observers.push(cb); } observe() {} disconnect() {} });
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const bar = (await screen.findByRole("button", { name: REVIEW_COPY.submit })).parentElement!;
      const root = bar.parentElement!;
      const region = root.parentElement!;
      let regionHeight = 700;
      Object.defineProperty(region, "clientHeight", { configurable: true, get: () => regionHeight });
      Object.defineProperty(bar, "offsetHeight", { configurable: true, get: () => 53 });
      observers.forEach((notify) => notify());
      expect(root.style.getPropertyValue(STICKY_ROOM_PROPERTY)).toBe("647px");

      regionHeight = 500;
      observers.forEach((notify) => notify());
      expect(root.style.getPropertyValue(STICKY_ROOM_PROPERTY)).toBe("447px");
      vi.unstubAllGlobals();
    });

    it("clears the fixed Appbar by its own geometry below md, and not above it", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const bar = (await screen.findByRole("button", { name: REVIEW_COPY.submit })).parentElement!;
      const { all } = cssOf(bar);
      expect(APPBAR_CLEARANCE_PX).toBe(APPBAR_OFFSET_PX + APPBAR_HEIGHT_PX);
      expect(all).toMatch(new RegExp(`padding-bottom:\\s*${APPBAR_CLEARANCE_PX}px`));
      expect(all).not.toMatch(/padding-right:\s*(?!0)/);
      const css = allCss();
      const md = blockAfter(css, "@media (min-width:900px)") || blockAfter(css, "@media (min-width: 900px)");
      expect(md).toMatch(new RegExp(`\\.${[...bar.classList].find((c) => c.startsWith("css-"))}[^{]*\\{[^}]*padding-bottom:\\s*8px`));
    });
  });

  describe("links while the record loads", () => {
    it.each<[string, () => void]>([
      ["is still pending", () => server.use(http.get(`${TEST_BACKEND_URL}/intake/:id`, async () => { await delay("infinite"); return HttpResponse.json({}); }))],
      ["fails", () => server.use(http.get(`${TEST_BACKEND_URL}/intake/:id`, () => new HttpResponse(null, { status: 500 })))],
    ])("shows the History link and the printed-version note when the record read %s", async (_name, break_) => {
      fakeReviewsEndpoints({
        reviews: [{ ...SUBMITTED, intake_item_id: 2, in_use: true, printed_revision_id: 11, printed_at: "2026-10-02T16:00:00Z" } as Review],
        records: [RECORD],
      });
      break_();
      server.use(http.get(`${TEST_BACKEND_URL}/reviews/:id/revisions`, () => HttpResponse.json([reviewRevision({ id: 11, revision: 1 })])));
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByRole("link", { name: "History" })).toBeInTheDocument();
      expect(await screen.findByText("This is the version printed on the cover.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: REVIEW_COPY.slip.heading, level: 3 })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Stereolab" })).not.toBeInTheDocument();
    });
  });

  describe("leaving with unsaved changes", () => {
    const TARGET = "/dashboard/flowsheet";
    const renderEditor = (served: Review = DRAFT) => {
      serve(served);
      const view = renderWithProviders(
        <>
          <a href={TARGET}>Flowsheet</a>
          <a href="https://example.org/elsewhere">Elsewhere</a>
          <ReviewEditor id={40} />
        </>,
      );
      return view;
    };
    const makeDirty = async (user: ReturnType<typeof renderEditor>["user"]) => {
      await user.type(await screen.findByLabelText("Review"), " More.");
    };
    /** True when nothing stopped the click from navigating; jsdom cannot navigate, so the page cancels it last. */
    const navigates = async (user: ReturnType<typeof renderEditor>["user"], name: string, modifiers = "") => {
      let reached = false;
      const last = (event: Event) => { reached = !event.defaultPrevented; event.preventDefault(); };
      document.addEventListener("click", last);
      if (modifiers) await user.keyboard(modifiers);
      await user.click(screen.getByRole("link", { name }));
      if (modifiers) await user.keyboard("{/Control}");
      document.removeEventListener("click", last);
      return reached;
    };
    const beforeUnload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    beforeEach(() => {
      router.push.mockClear();
    });

    it("asks before an in-app link, and Keep editing stays with the text intact", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      expect(await navigates(user, "Flowsheet")).toBe(false);

      const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
      expect(within(dialog).getByText("Your changes since the last save will be lost.")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Keep editing" })).toHaveFocus();
      await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(router.push).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Review")).toHaveValue("Warm. More.");
    });

    it("goes to the link's target on Leave", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      await navigates(user, "Flowsheet");
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Leave" }));

      expect(router.push).toHaveBeenCalledWith(TARGET);
    });

    it("lets a clean form's link navigate without asking", async () => {
      const { user } = renderEditor();
      await screen.findByLabelText("Review");
      expect(await navigates(user, "Flowsheet")).toBe(true);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("leaves other sites' links and modified clicks to the browser", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      expect(await navigates(user, "Elsewhere")).toBe(true);
      expect(await navigates(user, "Flowsheet", "{Control>}")).toBe(true);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("treats a field changed and changed back as clean", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      await user.type(screen.getByLabelText("Review"), "{Backspace>6/}");
      expect(screen.getByLabelText("Review")).toHaveValue("Warm.");

      expect(await navigates(user, "Flowsheet")).toBe(true);
      expect(beforeUnload()).toBe(false);
    });

    it("cancels beforeunload while dirty and not while clean", async () => {
      const { user } = renderEditor();
      await screen.findByLabelText("Review");
      expect(beforeUnload()).toBe(false);
      await makeDirty(user);
      expect(beforeUnload()).toBe(true);
    });

    it("keeps the page on back while dirty, and goes back past the guard on Leave", async () => {
      const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
      const { user } = renderEditor();
      await makeDirty(user);
      window.dispatchEvent(new PopStateEvent("popstate"));

      const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
      expect(go).not.toHaveBeenCalled();
      await user.click(within(dialog).getByRole("button", { name: "Leave" }));
      expect(go).toHaveBeenCalledWith(-2);
      go.mockRestore();
    });

    it("lets back through when the form is clean", async () => {
      renderEditor();
      await screen.findByLabelText("Review");
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("disarms every path once a save lands, and measures later edits against the save", async () => {
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)));
      const { user } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());

      expect(beforeUnload()).toBe(false);
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(await navigates(user, "Flowsheet")).toBe(true);

      await user.type(screen.getByLabelText("Review"), "!");
      expect(beforeUnload()).toBe(true);
    });

    it("disarms once a submit lands", async () => {
      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => HttpResponse.json(SUBMITTED)),
      );
      const { user } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(beforeUnload()).toBe(false));
    });

    it("does not interrupt the redirect after a delete", async () => {
      server.use(http.delete(`${TEST_BACKEND_URL}/reviews/40`, () => new HttpResponse(null, { status: 204 })));
      const { user } = renderEditor(SUBMITTED);
      await makeDirty(user);
      await user.click(screen.getByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews"));
      expect(screen.queryByRole("alertdialog", { name: "Leave without saving?" })).not.toBeInTheDocument();
    });

    it("removes its listeners on unmount", async () => {
      const { user, unmount } = renderEditor();
      await makeDirty(user);
      unmount();
      expect(beforeUnload()).toBe(false);
    });
  });
});
