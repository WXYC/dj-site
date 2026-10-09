import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { Review } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, fccNote, intakeItem, renderWithProviders, review, reviewRevision, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const mockAuth = vi.hoisted(() => ({
  authority: 1 as number,
  djName: "DJ Me" as string | undefined,
  realName: "Juana Molina" as string | undefined,
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: mockAuth.authority, djName: mockAuth.djName, realName: mockAuth.realName } },
    authenticating: false,
    authenticated: true,
  }),
}));

import { toast } from "sonner";
import ReviewEditor from "@/src/components/experiences/modern/reviews/ReviewEditor";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const CONSENT = { publish_website: false, publish_apps: false, publish_instagram: false, credit: null, in_use: false } as Partial<Review>;
const DRAFT = review({ ...CONSENT, author_user_id: "dj-me" });
const SUBMITTED = review({ ...CONSENT, author_user_id: "dj-me", status: "submitted" });
const IN_USE = "A music director is using this as the record's review. Ask them to remove it.";

const PRIVACY = "Only you can read this draft. Music directors can see that you have one in progress, not what it says.";

const RECORD = intakeItem({ id: 2 });

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
      const { container } = renderWithProviders(<ReviewEditor id={40} />);
      await new Promise((r) => setTimeout(r, 50));
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
      renderWithProviders(<ReviewEditor id={40} />);

      await screen.findByRole("link", { name: "History" });
      if (expected) {
        expect(await screen.findByText(expected)).toBeInTheDocument();
      } else {
        await new Promise((r) => setTimeout(r, 50));
        expect(screen.queryByText(/printed on the cover|earlier version of this review|printed version/)).not.toBeInTheDocument();
        expect(requested).not.toHaveBeenCalled();
      }
    });
  });
});
