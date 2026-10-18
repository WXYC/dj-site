import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { Review } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { deletingReview, digitalItem, fakeReviewsEndpoints, fccNote, heldBy, holdResponse, intakeItem, outline, renderWithProviders, returned, review, reviewRevision, reviewsSettled, rulesOf, server, TEST_BACKEND_URL } from "@/tests/helpers";
import Link from "next/link";
import { applicationSlice } from "@/lib/features/application/frontend";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { closeSidebarCSS, openSidebarCSS } from "@/src/utilities/modern/catalog/utilities";

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
import ScrollRegion, { SCROLL_REGION_ATTRIBUTE } from "@/src/components/experiences/modern/ScrollRegion";
import ReviewEditor from "@/src/components/experiences/modern/reviews/ReviewEditor";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import { FIELD_NAMES } from "@/lib/features/reviews/draftKeys";
import { readReviewDraft, writeReviewDraft } from "@/lib/features/reviews/reviewDrafts";
import { toFieldPatch, toFieldValues } from "@/src/components/experiences/modern/reviews/SlipFields";
import { STICKY_ROOM_PROPERTY } from "@/src/components/experiences/modern/reviews/useStickyRoom";
import { APPBAR_CLEARANCE_PX, APPBAR_HEIGHT_PX, APPBAR_OFFSET_PX } from "@/src/components/shared/Theme/Appbar";

const CONSENT = { publish_website: false, publish_apps: false, publish_instagram: false, credit: null, in_use: false } as Partial<Review>;
const DRAFT = review({ ...CONSENT, author_user_id: "dj-me" });
const SUBMITTED = review({ ...CONSENT, author_user_id: "dj-me", status: "submitted" });
const IN_USE = "A music director is using this as the record's review. Ask them to remove it.";

const PRIVACY = "Only you can read this draft. Music directors can see that you have one in progress, not what it says.";

const RECORD = intakeItem({ id: 2 });

const TWO_COLUMN_QUERY = "(min-width: 800px)";
/** The rules that apply in every layout: those outside any `@container`, which is where a declaration meant for one layout must not be. */
const outsideContainer = ({ base, media }: ReturnType<typeof rulesOf>) => base + "\n" + Object.values(media).join("\n");

function serve(served: Review = DRAFT) {
  fakeReviewsEndpoints({ reviews: [served], records: [RECORD] });
}

describe("ReviewEditor", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.id = "dj-me";
    mockAuth.authority = Authorization.DJ;
    mockAuth.djName = "DJ Me";
    mockAuth.realName = "Juana Molina";
    router.replace.mockClear();
    sessionStorage.clear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  /** True when the page cancelled `beforeunload`, which is what a dirty form does; a clean one lets the tab close. */
  const beforeUnload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  /** Every way the page could add to, rewrite or move through the history; each spy calls through. */
  const spyOnHistory = () => ({
    pushState: vi.spyOn(window.history, "pushState"),
    replaceState: vi.spyOn(window.history, "replaceState"),
    back: vi.spyOn(window.history, "back"),
    go: vi.spyOn(window.history, "go"),
  });
  type HistorySpies = ReturnType<typeof spyOnHistory>;
  const historyCalls = (spies: HistorySpies) => Object.fromEntries(Object.entries(spies).map(([name, spy]) => [name, spy.mock.calls.length]));
  const NO_HISTORY_CALLS = { pushState: 0, replaceState: 0, back: 0, go: 0 };
  const restoreHistory = (spies: HistorySpies) => Object.values(spies).forEach((spy) => spy.mockRestore());
  const stored = () => readReviewDraft("dj-me", 40);
  type User = ReturnType<typeof renderWithProviders>["user"];
  /** Opens the delete confirmation and confirms it. */
  const confirmDelete = async (user: User) => {
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
  };
  /** Opens the submit confirmation and confirms it. */
  const submitFromDialog = async (user: User) => {
    await user.click(await screen.findByRole("button", { name: "Submit" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Submit" }));
  };

  describe("the arrival line", () => {
    const ARRIVED_DISC = "It's yours to review now, so other DJs can see that you have it. Write when you've listened; your draft saves here.";
    const ARRIVED_DIGITAL = "It's yours to review now, and the music directors have been told to send you the files. Write when you've listened; your draft saves here.";
    const HELD = { state: "checked_out", effective_state: "checked_out", ...heldBy("dj-me", "DJ Me") } as const;
    const arrivedFrom = (record: ReturnType<typeof intakeItem>, served: Review = DRAFT) =>
      fakeReviewsEndpoints({ reviews: [served], records: [{ ...record, id: DRAFT.intake_item_id! }] });
    /** The record's heading comes from the same intake read the line needs, so once it shows, a line that was going to show would have. */
    const recordLoaded = () => screen.findByRole("heading", { level: 2, name: "Stereolab" });

    it.each([
      ["a disc", intakeItem(HELD), ARRIVED_DISC],
      ["a digital album", digitalItem(HELD), ARRIVED_DIGITAL],
    ])("says what the DJ holds now when %s arrived from a request", async (_kind, record, line) => {
      arrivedFrom(record);
      renderWithProviders(<ReviewEditor id={40} arrivedFromRequest />);

      expect(await screen.findByText(line)).toBeInTheDocument();
    });

    // The marker stays in the URL through a submit, a reload and Back, so the line also checks that it is still true.
    it.each([
      ["the editor was opened without the marker", intakeItem(HELD), DRAFT, false, "dj-me"],
      ["the review has been submitted", intakeItem(HELD), SUBMITTED, true, "dj-me"],
      ["the record is no longer held by the DJ", intakeItem({ ...HELD, ...returned, state: "pool", effective_state: "pool" }), DRAFT, true, "dj-me"],
      ["the record is held by someone else", intakeItem({ ...HELD, ...heldBy("dj-other", "DJ Other") }), DRAFT, true, "dj-me"],
      ["someone other than the author opens it", intakeItem(HELD), DRAFT, true, "md-1"],
    ] as const)("says nothing when %s", async (_why, record, served, arrived, viewer) => {
      mockAuth.id = viewer;
      arrivedFrom(record, served);
      renderWithProviders(<ReviewEditor id={40} arrivedFromRequest={arrived} />);

      await recordLoaded();
      expect(screen.queryByText(REVIEW_COPY.arrived.disc)).not.toBeInTheDocument();
      expect(screen.queryByText(REVIEW_COPY.arrived.digital)).not.toBeInTheDocument();
    });

    it("takes the line away once the review is submitted from the editor", async () => {
      arrivedFrom(intakeItem(HELD));
      let submitted = false;
      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => {
          submitted = true;
          return HttpResponse.json(SUBMITTED);
        }),
        http.get(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(submitted ? SUBMITTED : DRAFT)),
      );
      const { user } = renderWithProviders(<ReviewEditor id={40} arrivedFromRequest />);
      await screen.findByText(ARRIVED_DISC);

      await submitFromDialog(user);

      await waitFor(() => expect(screen.queryByText(ARRIVED_DISC)).not.toBeInTheDocument());
    });
  });

  describe.each([
    ["a draft", DRAFT, REVIEW_COPY.saveDraft],
    ["a submitted review", SUBMITTED, REVIEW_COPY.save],
  ])("the save button of %s", (_kind, served, saveName) => {
    const patches = () => {
      const seen: unknown[] = [];
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, async ({ request }) => (seen.push(await request.json()), HttpResponse.json(served))));
      return seen;
    };

    it("is off with the line reading All changes saved on load", async () => {
      serve(served);
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByRole("button", { name: saveName })).toBeDisabled();
      expect(screen.getByText(REVIEW_COPY.allChangesSaved)).toHaveAttribute("role", "status");
    });

    it("turns on after typing and off again after the save", async () => {
      serve(served);
      patches();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.type(await screen.findByLabelText("Buzzwords"), "hushed");

      expect(screen.getByRole("button", { name: saveName })).toBeEnabled();
      expect(screen.getByText(REVIEW_COPY.unsavedChanges)).toHaveAttribute("role", "status");
      await user.click(screen.getByRole("button", { name: saveName }));

      await waitFor(() => expect(screen.getByRole("button", { name: saveName })).toBeDisabled());
      expect(screen.getByText(REVIEW_COPY.allChangesSaved)).toHaveAttribute("role", "status");
    });

    it("stays off when a field is changed and changed back", async () => {
      serve(served);
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.type(await screen.findByLabelText("Buzzwords"), "x");
      expect(screen.getByRole("button", { name: saveName })).toBeEnabled();
      await user.type(screen.getByLabelText("Buzzwords"), "{Backspace}");

      expect(screen.getByRole("button", { name: saveName })).toBeDisabled();
      expect(screen.getByText(REVIEW_COPY.allChangesSaved)).toBeInTheDocument();
    });

    it("sends no PATCH when clicked while off", async () => {
      serve(served);
      const seen = patches();
      renderWithProviders(<ReviewEditor id={40} />);
      fireEvent.click(await screen.findByRole("button", { name: saveName }));
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      expect(seen).toEqual([]);
    });

    it("reads Unsaved changes, with Save off, while the offer to restore kept text stands", async () => {
      serve(served);
      writeReviewDraft("dj-me", 40, { ...toFieldPatch(toFieldValues(served)), review: "Kept text." });
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByText(REVIEW_COPY.restore.notice)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: saveName })).toBeDisabled();
      expect(screen.getByText(REVIEW_COPY.unsavedChanges)).toBeInTheDocument();
    });

    it("turns on when the kept text is restored", async () => {
      serve(served);
      writeReviewDraft("dj-me", 40, { ...toFieldPatch(toFieldValues(served)), review: "Kept text." });
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: REVIEW_COPY.restore.restore }));

      expect(screen.getByRole("button", { name: saveName })).toBeEnabled();
      expect(screen.getByText(REVIEW_COPY.unsavedChanges)).toBeInTheDocument();
    });

    it("stays off, with the line reading All changes saved, once the kept text is discarded", async () => {
      serve(served);
      writeReviewDraft("dj-me", 40, { ...toFieldPatch(toFieldValues(served)), review: "Kept text." });
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: REVIEW_COPY.restore.discard }));

      expect(screen.getByRole("button", { name: saveName })).toBeDisabled();
      expect(screen.getByText(REVIEW_COPY.allChangesSaved)).toBeInTheDocument();
    });

    it("stays off when a kept entry differs only in FCC text the editor does not offer", async () => {
      serve(served);
      writeReviewDraft("dj-me", 40, { ...toFieldPatch(toFieldValues(served)), fcc: "  " });
      renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByRole("button", { name: saveName })).toBeDisabled();
      expect(screen.queryByRole("textbox", { name: REVIEW_COPY.fields.fcc.label })).not.toBeInTheDocument();
      expect(screen.queryByText(REVIEW_COPY.restore.notice)).not.toBeInTheDocument();
      expect(screen.getByText(REVIEW_COPY.allChangesSaved)).toBeInTheDocument();
    });
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
    ["allChangesSaved", REVIEW_COPY.allChangesSaved, "All changes saved"],
    ["unsavedChanges", REVIEW_COPY.unsavedChanges, "Unsaved changes"],
    ["cancel", REVIEW_COPY.cancel, "Cancel"],
    ["restore.notice", REVIEW_COPY.restore.notice, "You left this review with unsaved changes."],
    ["restore.restore", REVIEW_COPY.restore.restore, "Restore my changes"],
    ["restore.discard", REVIEW_COPY.restore.discard, "Discard them"],
    ["leave.title", REVIEW_COPY.leave.title, "Leave without saving?"],
    ["leave.body", REVIEW_COPY.leave.body, "Your changes since the last save will be lost."],
    ["leave.leave", REVIEW_COPY.leave.leave, "Leave"],
    ["leave.keepEditing", REVIEW_COPY.leave.keepEditing, "Keep editing"],
    ["leave.recordBody", REVIEW_COPY.leave.recordBody, "The review you've typed here will be lost."],
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
    serve({ ...DRAFT, medium: "handwritten" } as Review);
    const { user } = renderWithProviders(<ReviewEditor id={40} />);
    const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
    expect(await within(preview).findByText("Stereolab")).toBeInTheDocument();
    expect(within(preview).getByText("Duophonic")).toBeInTheDocument();

    // Every typed value differs from every value the fixtures carry, so a
    // preview that shows the saved review instead of the typing cannot pass.
    const typed = [
      ["buzzwords", "hushed"],
      ["review", "Bright."],
      ["recommended_tracks", "A1, B4"],
      ["fcc", "Track two"],
    ] as const;
    const fixtureValues = [...Object.values(DRAFT), ...Object.values(RECORD)].map(String);
    for (const [name, text] of typed) {
      expect(fixtureValues).not.toContain(text);
      const field = screen.getByRole("textbox", { name: REVIEW_COPY.fields[name].label });
      await user.clear(field);
      await user.type(field, text);
      expect(within(preview).getByText(text)).toBeInTheDocument();
    }
    expect(within(preview).queryByText("Warm.")).not.toBeInTheDocument();
  });

  it("has no About the artist field, and the slip has one Artist row, even for a review with a stored paragraph", async () => {
    serve({ ...DRAFT, artist_blurb: "Argentine songwriter." } as Review);
    renderWithProviders(<ReviewEditor id={40} />);
    const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });

    expect(screen.queryByLabelText("About the artist")).not.toBeInTheDocument();
    expect(within(preview).queryByText("Argentine songwriter.")).not.toBeInTheDocument();
    expect(within(preview).getAllByText(REVIEW_COPY.slip.artist)).toHaveLength(1);
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
        review: "Warm.",
        recommended_tracks: null,
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

  describe("the preview's FCC row", () => {
    const confirmed = (overrides: Parameters<typeof fccNote>[0]) =>
      fccNote({ status: "confirmed", confirmed_by: "A Music Director", confirmed_at: "2026-10-02T12:00:00Z", ...overrides });
    const fccLines = (preview: HTMLElement) =>
      Array.from(within(preview).getByText(REVIEW_COPY.fields.fcc.label).nextElementSibling!.children, (el) => el.textContent);

    it("shows the review's FCC text, then the record's confirmed notes, and not a reported one", async () => {
      fakeReviewsEndpoints({
        reviews: [review({ ...CONSENT, intake_item_id: 2, fcc: "Cleared by the librarian." })],
        records: [RECORD],
        fccNotesForItem: {
          "2": [
            confirmed({ id: 1, intake_item_id: 2, track: "B1", note: "A word." }),
            fccNote({ id: 2, intake_item_id: 2, track: "C3", note: "Not yet confirmed." }),
          ],
        },
      });
      renderWithProviders(<ReviewEditor id={40} />);

      const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
      await within(preview).findByText("B1: A word.");
      expect(fccLines(preview)).toEqual(["Cleared by the librarian.", "B1: A word."]);
      expect(within(preview).queryByText("C3: Not yet confirmed.")).not.toBeInTheDocument();
    });

    it("shows the release's confirmed notes for a library-release review", async () => {
      fakeReviewsEndpoints({
        reviews: [review({ ...CONSENT, intake_item_id: null, album_id: 7 })],
        releases: [{ id: 7, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos", format_name: "CD", legacy_release_id: 1 }],
        fccNotesForRelease: { "7": [confirmed({ id: 3, album_id: 7, intake_item_id: null, track: "A1", note: "Release note." })] },
      });
      renderWithProviders(<ReviewEditor id={40} />);

      const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
      expect(await within(preview).findByText("A1: Release note.")).toBeInTheDocument();
    });

    it("shows a note carrying both ids once, after an older one, in reported order", async () => {
      const both = confirmed({ id: 5, intake_item_id: 2, album_id: 7, track: "D4", note: "On both.", reported_at: "2026-10-02T12:00:00Z" });
      fakeReviewsEndpoints({
        reviews: [review({ ...CONSENT, intake_item_id: 2, album_id: 7 })],
        records: [RECORD],
        fccNotesForItem: { "2": [both] },
        fccNotesForRelease: { "7": [both, confirmed({ id: 4, album_id: 7, intake_item_id: null, track: "A1", note: "Older." })] },
      });
      renderWithProviders(<ReviewEditor id={40} />);

      const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
      await within(preview).findByText("D4: On both.");
      await within(preview).findByText("A1: Older.");
      expect(fccLines(preview)).toEqual(["A1: Older.", "D4: On both."]);
    });

    it("previews no notes when the read fails", async () => {
      fakeReviewsEndpoints({ reviews: [review({ ...CONSENT, intake_item_id: 2, fcc: "Cleared." })], records: [RECORD] });
      server.use(http.get(`${TEST_BACKEND_URL}/fcc-notes`, () => new HttpResponse(null, { status: 500 })));
      const { store } = renderWithProviders(<ReviewEditor id={40} />);

      const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
      await within(preview).findByText("Cleared.");
      // "Cleared." is the review's own field and renders before the reads start, so wait for the 500 to be answered.
      await reviewsSettled(store);
      expect(fccLines(preview)).toEqual(["Cleared."]);
    });

    it("previews the release's notes when only the item's read fails", async () => {
      fakeReviewsEndpoints({
        reviews: [review({ ...CONSENT, intake_item_id: 2, album_id: 7, fcc: "Cleared." })],
        records: [RECORD],
        fccNotesForRelease: { "7": [confirmed({ id: 4, album_id: 7, intake_item_id: null, track: "A1", note: "Release note." })] },
      });
      server.use(
        http.get(`${TEST_BACKEND_URL}/fcc-notes`, ({ request }) =>
          new URL(request.url).searchParams.has("intake_item_id") ? new HttpResponse(null, { status: 500 }) : undefined,
        ),
      );
      const { store } = renderWithProviders(<ReviewEditor id={40} />);

      const preview = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
      await within(preview).findByText("A1: Release note.");
      await reviewsSettled(store);
      expect(fccLines(preview)).toEqual(["Cleared.", "A1: Release note."]);
    });
  });

  describe("the FCC field and the FCC notes panel", () => {
    const NOTES = {
      fccNotesForItem: { "2": [fccNote({ intake_item_id: 2, track: "B1", note: "A word." })] },
      fccNotesForRelease: { "7": [fccNote({ id: 2, album_id: 7, intake_item_id: null, track: "A2", note: "Another word." })] },
    };
    const FIELD = REVIEW_COPY.fields.fcc;

    // The free-text field is for a paper review (handwritten or printed), or one whose stored FCC already has text; the panel, titled "FCC" with the field's help line, is for the record or the release.
    it.each<{ name: string; overrides: Partial<Review>; fieldShown: boolean; note: string }>([
      { name: "a typed review with no stored FCC", overrides: {}, fieldShown: false, note: "B1: A word." },
      { name: "a typed review with stored FCC text", overrides: { fcc: "Mild language" }, fieldShown: true, note: "B1: A word." },
      { name: "a handwritten review", overrides: { medium: "handwritten" }, fieldShown: true, note: "B1: A word." },
      { name: "a printed review", overrides: { medium: "printed" }, fieldShown: true, note: "B1: A word." },
      { name: "a typed review with only whitespace stored as FCC", overrides: { fcc: "  " }, fieldShown: false, note: "B1: A word." },
      { name: "a typed review of a library release", overrides: { intake_item_id: null, album_id: 7 }, fieldShown: false, note: "A2: Another word." },
      { name: "a handwritten review of a library release", overrides: { intake_item_id: null, album_id: 7, medium: "handwritten" }, fieldShown: true, note: "A2: Another word." },
    ])("for $name: free-text field shown $fieldShown; the FCC panel lists $note", async ({ overrides, fieldShown, note }) => {
      fakeReviewsEndpoints({ reviews: [{ ...DRAFT, ...overrides } as Review], records: [RECORD], ...NOTES });
      let body: Record<string, unknown> = {};
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, async ({ request }) => ((body = (await request.json()) as Record<string, unknown>), HttpResponse.json(DRAFT))));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByText(note)).toBeInTheDocument();
      expect(!!screen.queryByRole("textbox", { name: FIELD.label })).toBe(fieldShown);
      const panel = screen.getByRole("region", { name: FIELD.label });
      expect(within(panel).getByText(note)).toBeInTheDocument();
      expect(within(panel).getByText(FIELD.help)).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "FCC notes" })).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("Buzzwords"), "hushed");
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect("fcc" in body).toBe(fieldShown);
    });

    it("keeps the field after the DJ clears its text, saves, and the review is read again with no FCC", async () => {
      fakeReviewsEndpoints({ reviews: [DRAFT], records: [RECORD], ...NOTES });
      // The service as it behaves: the read after the save returns what the save stored.
      let stored: Review = { ...DRAFT, fcc: "Mild language" } as Review;
      let reads = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/reviews/40`, () => ((reads += 1), HttpResponse.json(stored))),
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, async ({ request }) => ((stored = { ...stored, ...((await request.json()) as Partial<Review>) }), HttpResponse.json(stored))),
      );
      const { user, store } = renderWithProviders(<ReviewEditor id={40} />);
      await user.clear(await screen.findByRole("textbox", { name: FIELD.label }));
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      await waitFor(() => expect(reads).toBe(2));
      await reviewsSettled(store);

      expect(stored.fcc).toBeNull();
      expect(screen.getByRole("textbox", { name: FIELD.label })).toHaveValue("");
    });
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
      await user.type(screen.getByLabelText("Buzzwords"), "hushed");
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(Object.keys(body).sort()).toEqual(["buzzwords", "recommended_tracks", "review"]);
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
      expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    it("confirms, deletes, and leaves the editor", async () => {
      serve(SUBMITTED);
      let deleted = 0;
      server.use(deletingReview(() => deleted++));
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
      await confirmDelete(user);

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

      expect(await screen.findByRole("heading", { level: 2, name: "Stereolab" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: REVIEW_COPY.pageTitle })).not.toBeInTheDocument();
    });

    it("keeps a visually hidden h2 Review while the record has not loaded, so the outline starts at h2", async () => {
      fakeReviewsEndpoints({ reviews: [{ ...DRAFT, intake_item_id: 2 } as Review], records: [RECORD] });
      server.use(http.get(`${TEST_BACKEND_URL}/intake/:id`, async () => { await delay("infinite"); return HttpResponse.json({}); }));
      renderWithProviders(<ReviewEditor id={40} />);

      // The slip's heading draws only once the review has loaded; the hidden h2 also draws while the review is still loading, so waiting on it alone would assert too early.
      await screen.findByRole("heading", { level: 3, name: REVIEW_COPY.slip.heading });
      const heading = screen.getByRole("heading", { level: 2, name: REVIEW_COPY.pageTitle });
      expect(heading).toHaveStyle({ position: "absolute" });
      expect(screen.getAllByRole("heading").map((h) => h.tagName)).toEqual(["H2", "H3", "H3"]);
    });

    it.each<[string, () => void, string[]]>([
      ["a loaded record and its FCC panel", () => fakeReviewsEndpoints({ reviews: [{ ...DRAFT, intake_item_id: 2 } as Review], records: [RECORD] }), ["h2 Stereolab", `h3 ${REVIEW_COPY.fields.fcc.label}`, `h3 ${REVIEW_COPY.slip.heading}`]],
      [
        "a record still loading",
        () => {
          fakeReviewsEndpoints({ reviews: [{ ...DRAFT, intake_item_id: 2 } as Review], records: [RECORD] });
          server.use(http.get(`${TEST_BACKEND_URL}/intake/:id`, async () => { await delay("infinite"); return HttpResponse.json({}); }));
        },
        [`h2 ${REVIEW_COPY.pageTitle}`, `h3 ${REVIEW_COPY.fields.fcc.label}`, `h3 ${REVIEW_COPY.slip.heading}`],
      ],
      ["a library release's review and no record heading", () => fakeReviewsEndpoints({ reviews: [{ ...DRAFT, intake_item_id: null, album_id: 7 } as Review], records: [RECORD] }), [`h2 ${REVIEW_COPY.pageTitle}`, `h3 ${REVIEW_COPY.fields.fcc.label}`, `h3 ${REVIEW_COPY.slip.heading}`]],
    ])("outlines the editor as one h2 and then h3 sections with %s", async (_case, setUp, expected) => {
      setUp();
      renderWithProviders(<ReviewEditor id={40} />);

      await screen.findByRole("heading", { level: 3, name: REVIEW_COPY.slip.heading });
      await waitFor(() => expect(outline()).toEqual(expected));
    });

    it("keeps a visually hidden h2 Review when the review could not load", async () => {
      server.use(http.get(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json({ message: "down" }, { status: 500 })));
      renderWithProviders(<ReviewEditor id={40} />);

      await screen.findByRole("alert");
      expect(screen.getByRole("heading", { level: 2, name: REVIEW_COPY.pageTitle })).toBeInTheDocument();
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
      serve({ ...DRAFT, fcc: "Mild language" } as Review);
      renderWithProviders(<ReviewEditor id={40} />);

      for (const { label, help } of Object.values(REVIEW_COPY.fields)) {
        const box = await screen.findByRole("textbox", { name: label });
        // The FCC panel repeats the FCC field's help under its own title; the field's is the one outside it.
        const text = screen.getAllByText(help).find((el) => !el.closest("section"))!;
        expect(text.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(box).toHaveAccessibleDescription(help);
      }
    });

    it("asks the publishing question in a group named by its legend, after the slip fields", async () => {
      serve({ ...DRAFT, fcc: "Mild language" } as Review);
      renderWithProviders(<ReviewEditor id={40} />);

      const group = await screen.findByRole("group", { name: REVIEW_COPY.consent.legend });
      const last = screen.getByRole("textbox", { name: REVIEW_COPY.fields.fcc.label });
      expect(last.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("labels the slip preview region, with the FCC panel in the form column before the publishing question and the slip", async () => {
      fakeReviewsEndpoints({ reviews: [{ ...DRAFT, intake_item_id: 2 } as Review], records: [RECORD] });
      renderWithProviders(<ReviewEditor id={40} />);

      const region = await screen.findByRole("region", { name: REVIEW_COPY.slip.heading });
      expect(within(region).getByRole("group", { name: REVIEW_COPY.slip.name })).toBeInTheDocument();
      const fcc = await screen.findByRole("region", { name: REVIEW_COPY.fields.fcc.label });
      const follows = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(within(region).queryByRole("region", { name: REVIEW_COPY.fields.fcc.label })).not.toBeInTheDocument();
      expect(follows(screen.getByLabelText(REVIEW_COPY.fields.recommended_tracks.label), fcc)).toBe(true);
      expect(follows(fcc, screen.getByRole("group", { name: REVIEW_COPY.consent.legend }))).toBe(true);
      expect(follows(fcc, region)).toBe(true);
      expect(within(fcc).getByRole("heading", { name: REVIEW_COPY.fields.fcc.label, level: 3 })).toBeInTheDocument();
      await screen.findByRole("heading", { level: 2, name: "Stereolab" });
      expect(screen.getAllByRole("heading").map((h) => `${h.tagName} ${h.textContent}`)).toEqual(["H2 Stereolab", `H3 ${REVIEW_COPY.fields.fcc.label}`, `H3 ${REVIEW_COPY.slip.heading}`]);
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

    it("names the slip region with an h3 under the record's h2", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const heading = await screen.findByRole("heading", { name: REVIEW_COPY.slip.heading, level: 3 });
      expect(screen.getByRole("region", { name: REVIEW_COPY.slip.heading })).toContainElement(heading);
    });

    it("goes to two columns at an editor width of 800px, with a bounded slip column that sticks within the viewport", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const column = (await screen.findByRole("region", { name: REVIEW_COPY.slip.heading })).parentElement!;
      const grid = column.parentElement!;
      const gridRules = rulesOf(grid);
      const gridCss = outsideContainer(gridRules) + Object.values(gridRules.container).join("\n");
      expect(Object.keys(gridRules.container)).toEqual([TWO_COLUMN_QUERY]);
      expect(gridCss).not.toContain("1280px");
      expect(gridRules.container[TWO_COLUMN_QUERY]).toMatch(/grid-template-columns:\s*minmax\(20rem, 1fr\) minmax\(0, min-content\);/);
      // The column's own rules, split by whether they sit inside the two-column container query: sticking is for two columns only.
      const columnRules = rulesOf(column);
      expect(outsideContainer(columnRules)).not.toMatch(/sticky|max-height|overflow|100dvh/);
      const own = columnRules.container[TWO_COLUMN_QUERY];
      expect(own).toMatch(/position:\s*sticky/);
      expect(own).toMatch(/top:\s*0/);
      expect(own).toMatch(/align-self:\s*start/);
      expect(own).toMatch(new RegExp(`max-height:\\s*var\\(${STICKY_ROOM_PROPERTY},\\s*none\\)`));
      expect(own).not.toMatch(/100dvh/);
      expect(own).toMatch(/overflow-y:\s*auto/);
      // The scrollbar's room is reserved (so scrolling never narrows the slip) and the slip's shadow (0 1px 4px, so 3px above and 5px below) has padding to fall into on every side.
      expect(own).toMatch(/scrollbar-gutter:\s*stable/);
      // The CSSOM folds four equal sides into the shorthand, so a side left out would show as `padding: 8px 0px` and fail this.
      expect(own).toMatch(/(?<![-\w])padding:\s*8px;/);
      // overflow-wrap is inherited, so it is not on the column: the slip must wrap as it does in one column and on paper.
      expect(own).not.toMatch(/overflow-wrap/);
    });

    it("wraps a long unbroken token in the FCC panel only, never in the slip preview", async () => {
      fakeReviewsEndpoints({ reviews: [{ ...DRAFT, intake_item_id: 2 } as Review], records: [RECORD] });
      renderWithProviders(<ReviewEditor id={40} />);

      const fcc = await screen.findByRole("region", { name: REVIEW_COPY.fields.fcc.label });
      const wrapper = fcc.parentElement!;
      // jsdom applies no @container rule, so computed style cannot pin this either way: read the rules by at-rule.
      const wrapperRules = rulesOf(wrapper);
      expect(wrapperRules.container[TWO_COLUMN_QUERY]).toMatch(/overflow-wrap:\s*anywhere/);
      expect(wrapperRules.base).not.toMatch(/overflow-wrap/);
      const section = screen.getByRole("region", { name: REVIEW_COPY.slip.heading });
      const slipRules = rulesOf(section, screen.getByRole("group", { name: REVIEW_COPY.slip.name }));
      expect([slipRules.base, ...Object.values(slipRules.media), ...Object.values(slipRules.container)].join("\n")).not.toMatch(/overflow-wrap/);
    });

    it("sizes the slip column from its content, so a scrollbar's gutter and the shadow's padding sit outside a slip that stays 4.25in", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const slip = await screen.findByRole("group", { name: REVIEW_COPY.slip.name });
      const column = screen.getByRole("region", { name: REVIEW_COPY.slip.heading }).parentElement!;
      const gridRules = rulesOf(column.parentElement!);
      expect(gridRules.container[TWO_COLUMN_QUERY]).toMatch(/grid-template-columns:\s*minmax\(20rem, 1fr\) minmax\(0, min-content\);/);
      expect(outsideContainer(gridRules) + Object.values(gridRules.container).join("\n")).not.toMatch(/calc\(4\.25in/);
      // jsdom resolves the inch to pixels: 4.25 * 96.
      expect(getComputedStyle(slip).width).toBe("408px");
    });

    describe("the slip column's room", () => {
      const observed: Array<{ notify: () => void; targets: Element[] }> = [];
      /** Notifies every observer that is watching `target`, as a real one does when that box resizes. */
      const resize = (target: Element) => observed.filter((o) => o.targets.includes(target)).forEach((o) => o.notify());
      beforeEach(() => {
        observed.length = 0;
        vi.stubGlobal("ResizeObserver", class {
          entry = { notify: () => {}, targets: [] as Element[] };
          constructor(cb: () => void) { this.entry.notify = cb; observed.push(this.entry); }
          observe(target: Element) { this.entry.targets.push(target); }
          disconnect() {}
        });
      });
      afterEach(() => vi.unstubAllGlobals());

      /** The editor one wrapper deeper than the scroll region's child, so a parent-element guess measures the wrong box. */
      const renderDeeper = async () => {
        serve();
        renderWithProviders(<ScrollRegion><div><ReviewEditor id={40} /></div></ScrollRegion>);
        const bar = (await screen.findByRole("button", { name: REVIEW_COPY.submit })).parentElement!;
        const root = bar.parentElement!;
        const region = document.querySelector<HTMLElement>(`[${SCROLL_REGION_ATTRIBUTE}]`)!;
        return { bar, root, region };
      };

      it("sets the slip column's room to the scroll region's height minus the action bar's, and keeps it current", async () => {
        const { bar, root, region } = await renderDeeper();
        let regionHeight = 700;
        let barHeight = 53;
        Object.defineProperty(region, "clientHeight", { configurable: true, get: () => regionHeight });
        Object.defineProperty(bar, "offsetHeight", { configurable: true, get: () => barHeight });
        resize(region);
        expect(root.style.getPropertyValue(STICKY_ROOM_PROPERTY)).toBe("647px");

        regionHeight = 500;
        resize(region);
        expect(root.style.getPropertyValue(STICKY_ROOM_PROPERTY)).toBe("447px");

        // A bar that wraps at a narrow width grows without the region changing.
        barHeight = 90;
        resize(bar);
        expect(root.style.getPropertyValue(STICKY_ROOM_PROPERTY)).toBe("410px");
      });

      it("observes both the scroll region and the action bar", async () => {
        const { bar, region } = await renderDeeper();
        const targets = observed.flatMap((o) => o.targets);
        expect(targets).toContain(bar);
        expect(targets).toContain(region);
      });
    });

    it("clears the fixed Appbar by its own geometry below md, and not above it", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);

      const bar = (await screen.findByRole("button", { name: REVIEW_COPY.submit })).parentElement!;
      expect(APPBAR_CLEARANCE_PX).toBe(APPBAR_OFFSET_PX + APPBAR_HEIGHT_PX);
      // jsdom applies no @media rule to computed style (the base value wins at any width), so the clearance can only be read from the rules by at-rule: Joy's xs is `min-width: 0`, md is 900px.
      const { base, media } = rulesOf(bar);
      expect(media["(min-width:0px)"]).toMatch(new RegExp(`padding-bottom:\\s*${APPBAR_CLEARANCE_PX}px`));
      expect(media["(min-width:900px)"]).toMatch(/padding-bottom:\s*8px/);
      expect([base, ...Object.values(media)].join("\n")).not.toMatch(/padding-right:\s*(?!0)/);
      expect(media["(min-width:900px)"]).not.toContain(`${APPBAR_CLEARANCE_PX}px`);
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
      expect(screen.getByRole("heading", { level: 2, name: REVIEW_COPY.pageTitle })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: REVIEW_COPY.slip.heading, level: 3 })).toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: REVIEW_COPY.fields.fcc.label, level: 3 })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Stereolab" })).not.toBeInTheDocument();
    });
  });

  describe("leaving with unsaved changes", () => {
    const TARGET = "/dashboard/flowsheet?view=week#entries";
    /**
     * Next's Link runs its `onClick` prop first, from React's root listener in the bubble phase, then
     * `preventDefault`s and navigates. So this spy is called exactly when the click got past the guard:
     * a bubble-phase guard would run after it, and the spy would be called while the form is dirty.
     */
    const linkReached = vi.fn();
    const renderEditor = (served: Review = DRAFT) => {
      serve(served);
      return renderWithProviders(
        <>
          <Link href={TARGET} prefetch={false} onClick={linkReached}>Flowsheet</Link>
          <a href="https://example.org/elsewhere">Elsewhere</a>
          <a href="/dashboard/playlists" target="_blank">New tab</a>
          <a href="/dashboard/reviews/40/slip" download>Download</a>
          <ReviewEditor id={40} />
        </>,
      );
    };
    const makeDirty = async (user: User) => {
      await user.type(await screen.findByLabelText("Review"), " More.");
    };
    /** True when nothing stopped the click from navigating; jsdom cannot navigate, so the page cancels it last. */
    const navigates = async (user: User, name: string, { modifiers = "", button = 0 } = {}) => {
      let reached = false;
      const last = (event: Event) => { reached = !event.defaultPrevented; event.preventDefault(); };
      document.addEventListener("click", last);
      if (modifiers) await user.keyboard(modifiers);
      if (button) fireEvent.click(screen.getByRole("link", { name }), { button });
      else await user.click(screen.getByRole("link", { name }));
      if (modifiers) await user.keyboard("{/Control}");
      document.removeEventListener("click", last);
      return reached;
    };
    const drawer = (store: ReturnType<typeof renderEditor>["store"]) => ({
      open: store.getState().application.rightbar.sidebarOpen,
      slideIn: document.documentElement.style.getPropertyValue("--SideNavigation-slideIn"),
    });
    const dialog = () => screen.findByRole("alertdialog", { name: "Leave without saving?" });
    beforeEach(() => {
      router.push.mockClear();
      linkReached.mockClear();
    });
    afterEach(closeSidebarCSS);

    it("asks before an in-app next/link, and Keep editing stays with the text intact", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));

      const asking = await dialog();
      expect(within(asking).getByText("Your changes since the last save will be lost.")).toBeInTheDocument();
      expect(within(asking).getByRole("button", { name: "Keep editing" })).toHaveFocus();
      expect(linkReached).not.toHaveBeenCalled();
      await user.click(within(asking).getByRole("button", { name: "Keep editing" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(router.push).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Review")).toHaveValue("Warm. More.");
    });

    it("lets a clean form's next/link navigate without asking", async () => {
      const { user } = renderEditor();
      await screen.findByLabelText("Review");
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      expect(linkReached).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("on Leave by link, pushes the link's path, search and hash, and does not replace", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await user.click(within(await dialog()).getByRole("button", { name: "Leave" }));

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith(TARGET);
      expect(router.replace).not.toHaveBeenCalled();
      expect(linkReached).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("leaves other sites' links and modified clicks to the browser", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      expect(await navigates(user, "Elsewhere")).toBe(true);
      expect(await navigates(user, "Flowsheet", { modifiers: "{Control>}" })).toBe(true);
      expect(await navigates(user, "New tab")).toBe(true);
      expect(await navigates(user, "Download")).toBe(true);
      expect(await navigates(user, "Flowsheet", { button: 1 })).toBe(true);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(router.push).not.toHaveBeenCalled();
    });

    it("counts a publishing consent choice alone as unsaved", async () => {
      const { user } = renderEditor();
      await user.click(await screen.findByRole("checkbox", { name: "Website" }));
      expect(beforeUnload()).toBe(true);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await dialog();
      expect(linkReached).not.toHaveBeenCalled();
    });

    it("closes the mobile drawer as it asks, and leaves an open drawer alone when the form is clean", async () => {
      const { user, store } = renderEditor();
      await screen.findByLabelText("Review");
      act(() => { store.dispatch(applicationSlice.actions.toggleSidebar()); });
      openSidebarCSS();
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      expect(linkReached).toHaveBeenCalledTimes(1);
      expect(drawer(store)).toEqual({ open: true, slideIn: "1" });

      // Below 900px the open drawer covers the form, so a DJ dirties it first and opens the drawer after.
      act(() => { store.dispatch(applicationSlice.actions.toggleSidebar()); });
      closeSidebarCSS();
      await makeDirty(user);
      act(() => { store.dispatch(applicationSlice.actions.toggleSidebar()); });
      openSidebarCSS();
      expect(drawer(store)).toEqual({ open: true, slideIn: "1" });
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      const asking = await dialog();
      expect(drawer(store)).toEqual({ open: false, slideIn: "" });
      await user.click(within(asking).getByRole("button", { name: "Keep editing" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(drawer(store)).toEqual({ open: false, slideIn: "" });
    });

    it("treats a field changed and changed back as clean", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      await user.type(screen.getByLabelText("Review"), "{Backspace>6/}");
      expect(screen.getByLabelText("Review")).toHaveValue("Warm.");

      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      expect(linkReached).toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(beforeUnload()).toBe(false);
    });

    it("cancels beforeunload while dirty and not while clean", async () => {
      const { user } = renderEditor();
      await screen.findByLabelText("Review");
      expect(beforeUnload()).toBe(false);
      await makeDirty(user);
      expect(beforeUnload()).toBe(true);
    });

    it("never calls history: not on going dirty, Keep editing, Leave, a save, more typing or unmount", async () => {
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)));
      const history = spyOnHistory();
      const { user, unmount } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await user.click(within(await dialog()).getByRole("button", { name: "Keep editing" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await user.click(within(await dialog()).getByRole("button", { name: "Leave" }));
      await waitFor(() => expect(router.push).toHaveBeenCalledWith(TARGET));
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      await user.type(screen.getByLabelText("Review"), "!");
      unmount();

      expect(historyCalls(history)).toEqual(NO_HISTORY_CALLS);
      restoreHistory(history);
    });

    it("stays guarded after a Leave that left the editor in place: a second link asks again and beforeunload is still cancelled", async () => {
      const { user } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      // router.push is a no-op here, as Next's is when the navigation does not take the editor away.
      await user.click(within(await dialog()).getByRole("button", { name: "Leave" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(beforeUnload()).toBe(true);

      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await dialog();
      expect(linkReached).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(beforeUnload()).toBe(true);
    });

    it("closes the question a link click opened while a save was out, once that save lands and the form is clean", async () => {
      const save = holdResponse("patch", `${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT));
      const { user } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(save.calls.count).toBe(1));
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await dialog();

      save.release();
      await save.answered;

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(router.push).not.toHaveBeenCalled();
    });

    it("disarms every path once a save lands, and measures later edits against the save", async () => {
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)));
      const { user } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());

      expect(beforeUnload()).toBe(false);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      expect(linkReached).toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("Review"), "!");
      expect(beforeUnload()).toBe(true);
    });

    it("keeps the guard armed when the save fails", async () => {
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => new HttpResponse(null, { status: 500 })));
      const { user } = renderEditor();
      await makeDirty(user);
      await user.click(screen.getByRole("button", { name: REVIEW_COPY.saveDraft }));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());

      expect(beforeUnload()).toBe(true);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await dialog();
      expect(linkReached).not.toHaveBeenCalled();
    });

    it("keeps the guard armed when the update inside a submit fails", async () => {
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => new HttpResponse(null, { status: 500 })));
      const { user } = renderEditor();
      await makeDirty(user);
      await submitFromDialog(user);
      await waitFor(() => expect(toast.error).toHaveBeenCalled());

      expect(beforeUnload()).toBe(true);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await dialog();
      expect(linkReached).not.toHaveBeenCalled();
    });

    it("disarms once a submit lands", async () => {
      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => HttpResponse.json(SUBMITTED)),
      );
      const { user } = renderEditor();
      await makeDirty(user);
      await submitFromDialog(user);
      await waitFor(() => expect(beforeUnload()).toBe(false));
    });

    it("lets a delete's redirect through while the form is dirty, without asking and with no history call before it, and is clean from then on", async () => {
      server.use(deletingReview());
      const history = spyOnHistory();
      let callsAtRedirect: Record<string, number> | undefined;
      router.replace.mockImplementationOnce(() => { callsAtRedirect = historyCalls(history); });
      const { user } = renderEditor(SUBMITTED);
      await makeDirty(user);
      await confirmDelete(user);

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews"));
      expect(callsAtRedirect).toEqual(NO_HISTORY_CALLS);
      expect(screen.queryByRole("alertdialog", { name: "Leave without saving?" })).not.toBeInTheDocument();
      await waitFor(() => expect(beforeUnload()).toBe(false));
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      expect(linkReached).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      restoreHistory(history);
    });

    it("is clean after a delete whatever was typed while the request was in flight: no entry kept, even at the redirect, and no guard", async () => {
      const delete40 = holdResponse("delete", `${TEST_BACKEND_URL}/reviews/40`, () => new HttpResponse(null, { status: 204 }));
      // The redirect may be a full load that unmounts before any effect runs, so the entry must already be gone when it is asked for.
      let storedAtRedirect: unknown = "unset";
      router.replace.mockImplementationOnce(() => { storedAtRedirect = stored(); });
      const { user } = renderEditor(SUBMITTED);
      await makeDirty(user);
      await waitFor(() => expect(stored()).not.toBeNull());
      await confirmDelete(user);
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      await user.type(screen.getByLabelText("Review"), " Still typing.");
      delete40.release();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews"));
      expect(storedAtRedirect).toBeNull();
      await waitFor(() => expect(stored()).toBeNull());
      await waitFor(() => expect(beforeUnload()).toBe(false));
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      expect(linkReached).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it.each([
      ["refused as in use", () => HttpResponse.json({ message: "server words", reason: "in_use" }, { status: 409 }), () => screen.findByText(IN_USE)],
      ["failed", () => new HttpResponse(null, { status: 500 }), () => waitFor(() => expect(toast.error).toHaveBeenCalledWith(REVIEW_COPY.couldNotDelete))],
    ])("keeps the guard armed and the entry when the delete is %s", async (_name, respond, settled) => {
      server.use(http.delete(`${TEST_BACKEND_URL}/reviews/40`, respond));
      const { user } = renderEditor(SUBMITTED);
      await makeDirty(user);
      await waitFor(() => expect(stored()).not.toBeNull());
      await confirmDelete(user);
      await settled();

      expect(router.replace).not.toHaveBeenCalled();
      expect(stored()).toMatchObject({ review: (screen.getByLabelText("Review") as HTMLTextAreaElement).value });
      expect(beforeUnload()).toBe(true);
      await user.click(screen.getByRole("link", { name: "Flowsheet" }));
      await dialog();
      expect(linkReached).not.toHaveBeenCalled();
    });

    it("removes its listeners on unmount", async () => {
      const { user, unmount } = renderEditor();
      await makeDirty(user);
      const fromWindow = vi.spyOn(window, "removeEventListener");
      const fromDocument = vi.spyOn(document, "removeEventListener");
      unmount();
      expect(beforeUnload()).toBe(false);
      expect(fromWindow).toHaveBeenCalledWith("beforeunload", expect.any(Function));
      expect(fromDocument).toHaveBeenCalledWith("click", expect.any(Function), true);
      fromWindow.mockRestore();
      fromDocument.mockRestore();
    });
  });

  describe("unsaved text kept for the tab", () => {
    const NOTICE = "You left this review with unsaved changes.";
    const RESTORE = "Restore my changes";
    const DISCARD = "Discard them";
    const keepTyped = async (user: ReturnType<typeof renderWithProviders>["user"]) => {
      await user.type(await screen.findByLabelText("Review"), " More.");
      await waitFor(() => expect(stored()).not.toBeNull());
    };
    const leftWithUnsaved = async () => {
      serve();
      const first = renderWithProviders(<ReviewEditor id={40} />);
      await keepTyped(first.user);
      first.unmount();
    };

    it("keeps what was typed, consent included, under the review's key, and removes it when the form goes clean", async () => {
      serve();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await keepTyped(user);
      expect(stored()).toMatchObject({ review: "Warm. More.", publish_website: false });

      await user.type(screen.getByLabelText("Review"), "{Backspace>6/}");
      await waitFor(() => expect(stored()).toBeNull());
    });

    it("keeps nothing while the form is clean", async () => {
      serve();
      renderWithProviders(<ReviewEditor id={40} />);
      await screen.findByLabelText("Review");
      expect(sessionStorage).toHaveLength(0);
    });

    it("offers to restore a stored entry that differs, above a form that stays usable and shows the saved text", async () => {
      await leftWithUnsaved();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByText(NOTICE)).toBeInTheDocument();
      expect(screen.getByLabelText("Review")).toHaveValue("Warm.");
      expect(stored()).not.toBeNull();
      await user.type(screen.getByLabelText("Review"), "!");
      expect(screen.getByLabelText("Review")).toHaveValue("Warm.!");
    });

    it("Restore fills the form, leaves it dirty and closes the offer", async () => {
      await leftWithUnsaved();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: RESTORE }));

      expect(screen.getByLabelText("Review")).toHaveValue("Warm. More.");
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      expect(stored()).toMatchObject({ review: "Warm. More." });
      expect(beforeUnload()).toBe(true);
    });

    it("Discard removes the entry, keeps the review as saved and closes the offer", async () => {
      await leftWithUnsaved();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: DISCARD }));

      expect(screen.getByLabelText("Review")).toHaveValue("Warm.");
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      expect(stored()).toBeNull();
    });

    it("the offer goes away on the first edit and the new text replaces the stored copy", async () => {
      await leftWithUnsaved();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await screen.findByText(NOTICE);
      await user.type(screen.getByLabelText("Review"), "?");

      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      await waitFor(() => expect(stored()).toMatchObject({ review: "Warm.?" }));
    });

    /** An entry equal to the loaded typed review (which stores no FCC) in every field but FCC, with the given FCC. */
    const keepWithFcc = (fcc: Partial<Review>) =>
      writeReviewDraft("dj-me", 40, { ...toFieldPatch(toFieldValues(DRAFT), FIELD_NAMES.filter((n) => n !== "fcc")), ...fcc, publish_website: false, publish_apps: false, publish_instagram: false, credit: null });

    // A typed review with no stored FCC does not offer the field, so an entry with no FCC text has nothing this editor would restore.
    it.each<{ name: string; fcc: Partial<Review> }>([
      { name: "no FCC", fcc: {} },
      { name: "an empty FCC", fcc: { fcc: null } },
      { name: "a blank FCC", fcc: { fcc: "   " } },
    ])("removes an entry equal to the loaded review, carrying $name, without an offer", async ({ fcc }) => {
      keepWithFcc(fcc);
      serve();
      renderWithProviders(<ReviewEditor id={40} />);
      await screen.findByLabelText("Review");

      await waitFor(() => expect(stored()).toBeNull());
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: REVIEW_COPY.fields.fcc.label })).not.toBeInTheDocument();
    });

    // The stored FCC was cleared (by this DJ's own save, or by a music director in another tab) after the entry kept FCC text: the field is offered so the text can come back.
    it.each<{ name: string; fcc: string }>([
      { name: "FCC text the loaded review no longer stores", fcc: "Mild language" },
      { name: "FCC text typed after the stored FCC was cleared and saved", fcc: "B2: one word" },
    ])("offers the FCC field and the entry when it carries $name, and Restore brings the text back", async ({ fcc }) => {
      keepWithFcc({ fcc });
      serve();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);

      expect(await screen.findByText(NOTICE)).toBeInTheDocument();
      const field = screen.getByRole("textbox", { name: REVIEW_COPY.fields.fcc.label });
      expect(field).toHaveValue("");
      expect(stored()).toMatchObject({ fcc });

      await user.click(screen.getByRole("button", { name: RESTORE }));
      expect(field).toHaveValue(fcc);
      expect(screen.getByLabelText("Review")).toHaveValue("Warm.");
      expect(stored()).toMatchObject({ fcc });
    });

    it("keeps one review's entry out of another's editor", async () => {
      await leftWithUnsaved();
      fakeReviewsEndpoints({ reviews: [review({ id: 41, ...CONSENT, author_user_id: "dj-me" })] });
      renderWithProviders(<ReviewEditor id={41} />);
      await screen.findByLabelText("Review");

      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      expect(stored()).not.toBeNull();
    });

    it("a successful save removes the entry; a failed one keeps it", async () => {
      serve();
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json({ message: "no" }, { status: 500 })));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await keepTyped(user);
      await user.click(screen.getByRole("button", { name: "Save draft" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(stored()).toMatchObject({ review: "Warm. More." });

      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)));
      await user.click(screen.getByRole("button", { name: "Save draft" }));
      await waitFor(() => expect(stored()).toBeNull());
    });

    it("a successful submit removes the entry; a failed one keeps it", async () => {
      serve();
      // A submit saves first, so the text is only kept while that save is what fails.
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json({ message: "no" }, { status: 500 })));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await keepTyped(user);
      await submitFromDialog(user);
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(stored()).not.toBeNull();

      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => HttpResponse.json(SUBMITTED)),
      );
      await submitFromDialog(user);
      await waitFor(() => expect(stored()).toBeNull());
    });

    it("a successful delete removes the entry", async () => {
      serve();
      server.use(deletingReview());
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await keepTyped(user);
      await confirmDelete(user);

      await waitFor(() => expect(router.replace).toHaveBeenCalled());
      expect(stored()).toBeNull();
    });

    it.each([
      ["unparseable JSON", "{not json"],
      ["an array", '["x"]'],
      ["a text field of the wrong type", '{"review":5}'],
      ["a consent key of the wrong type", '{"review":"Warm. More.","publish_website":"yes"}'],
      ["a credit of the wrong type", '{"review":"Warm. More.","credit":3}'],
      ["only unknown keys", '{"colour":"red"}'],
      ["a bare string", '"Warm. More."'],
    ])("removes a stored entry that is %s and offers nothing", async (_name, raw) => {
      sessionStorage.setItem("review-draft:dj-me:40", raw);
      serve();
      renderWithProviders(<ReviewEditor id={40} />);
      await screen.findByLabelText("Review");

      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      expect(screen.getByLabelText("Review")).toHaveValue("Warm.");
      await waitFor(() => expect(sessionStorage.getItem("review-draft:dj-me:40")).toBeNull());
    });

    it("restores the other fields of a kept entry that still carries artist_blurb", async () => {
      sessionStorage.setItem("review-draft:dj-me:40", JSON.stringify({ review: "Warm. More.", artist_blurb: "Old paragraph." }));
      serve();
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: RESTORE }));

      expect(screen.getByLabelText("Review")).toHaveValue("Warm. More.");
      expect(screen.queryByText("Old paragraph.")).not.toBeInTheDocument();
    });

    it("Restore keeps the stored FCC text when the kept entry carries none", async () => {
      sessionStorage.setItem("review-draft:dj-me:40", JSON.stringify({ review: "Warm. More." }));
      serve({ ...DRAFT, fcc: "Mild language", buzzwords: "Dreamy" } as Review);
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await user.click(await screen.findByRole("button", { name: RESTORE }));

      expect(screen.getByLabelText("Review")).toHaveValue("Warm. More.");
      expect(screen.getByRole("textbox", { name: REVIEW_COPY.fields.fcc.label })).toHaveValue("Mild language");
      expect(screen.getByLabelText(REVIEW_COPY.fields.buzzwords.label)).toHaveValue("Dreamy");
    });

    it("offers nothing for an entry stored under another user's key", async () => {
      writeReviewDraft("dj-other", 40, { review: "Someone else's text.", publish_website: false, publish_apps: false, publish_instagram: false, credit: null });
      serve();
      renderWithProviders(<ReviewEditor id={40} />);
      await screen.findByLabelText("Review");

      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      expect(readReviewDraft("dj-other", 40)).not.toBeNull();
    });

    describe("under the wrong user", () => {
      it("never stores the first user's text under a second user who signs in while the editor is open", async () => {
        serve();
        const first = renderWithProviders(<ReviewEditor id={40} />);
        await keepTyped(first.user);

        mockAuth.id = "dj-second";
        first.rerender(<ReviewEditor id={40} />);
        first.unmount();

        renderWithProviders(<ReviewEditor id={40} />);
        await screen.findByLabelText("Review");
        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
        expect(readReviewDraft("dj-second", 40)).toBeNull();
      });

      it("keeps the first user's entry through the switch and offers it when they sign back in", async () => {
        serve();
        const first = renderWithProviders(<ReviewEditor id={40} />);
        await keepTyped(first.user);

        mockAuth.id = "dj-second";
        first.rerender(<ReviewEditor id={40} />);
        await screen.findByLabelText("Review");
        expect(readReviewDraft("dj-me", 40)).not.toBeNull();
        first.unmount();

        mockAuth.id = "dj-me";
        renderWithProviders(<ReviewEditor id={40} />);
        expect(await screen.findByText(NOTICE)).toBeInTheDocument();
      });

      it("keeps what is typed when the same user's session is renewed under the open editor", async () => {
        serve();
        const { user, rerender } = renderWithProviders(<ReviewEditor id={40} />);
        await user.type(await screen.findByLabelText("Review"), " More.");

        rerender(<ReviewEditor id={40} />);

        expect(screen.getByLabelText("Review")).toHaveValue("Warm. More.");
        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      });

      it("neither writes nor offers an entry for an empty user id", async () => {
        sessionStorage.setItem("review-draft::40", JSON.stringify({ review: "Orphaned text." }));
        mockAuth.id = "";
        serve();
        const { user } = renderWithProviders(<ReviewEditor id={40} />);
        await user.type(await screen.findByLabelText("Review"), " More.");

        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
        expect(sessionStorage.getItem("review-draft::40")).toBe(JSON.stringify({ review: "Orphaned text." }));
        expect(Object.keys(sessionStorage)).toEqual(["review-draft::40"]);
      });
    });

    it("a submit made while the offer stands removes the entry and the notice; a failed one keeps both", async () => {
      await leftWithUnsaved();
      server.use(http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json({ message: "no" }, { status: 500 })));
      const { user } = renderWithProviders(<ReviewEditor id={40} />);
      await screen.findByText(NOTICE);
      await submitFromDialog(user);
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(screen.getByText(NOTICE)).toBeInTheDocument();
      expect(stored()).not.toBeNull();

      server.use(
        http.patch(`${TEST_BACKEND_URL}/reviews/40`, () => HttpResponse.json(DRAFT)),
        http.post(`${TEST_BACKEND_URL}/reviews/40/submit`, () => HttpResponse.json(SUBMITTED)),
      );
      await submitFromDialog(user);
      await waitFor(() => expect(stored()).toBeNull());
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });

    it("works as on main when storage throws", async () => {
      const broken = () => { throw new Error("quota"); };
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(broken);
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(broken);
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(broken);
      try {
        serve();
        const { user } = renderWithProviders(<ReviewEditor id={40} />);
        await user.type(await screen.findByLabelText("Review"), " More.");

        expect(screen.getByLabelText("Review")).toHaveValue("Warm. More.");
        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("never calls history", async () => {
      const history = spyOnHistory();
      try {
        await leftWithUnsaved();
        const { user } = renderWithProviders(<ReviewEditor id={40} />);
        await user.click(await screen.findByRole("button", { name: RESTORE }));
        expect(historyCalls(history)).toEqual(NO_HISTORY_CALLS);
      } finally {
        restoreHistory(history);
      }
    });
  });
});
