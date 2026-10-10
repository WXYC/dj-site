import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, fccNote, renderWithProviders, reviewsSettled, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

const mockAuth = vi.hoisted(() => ({ authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: mockAuth.authority } },
    authenticating: false,
    authenticated: true,
  }),
}));

import FccNotesPanel from "@/src/components/experiences/modern/reviews/FccNotesPanel";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const ALBUM_ID = 7;
const ITEM_ID = 3;

describe("FccNotesPanel", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.authority = Authorization.DJ;
  });

  it.each([
    ["title", REVIEW_COPY.fccNotes.title, "FCC notes"],
    ["empty", REVIEW_COPY.fccNotes.empty, "No FCC notes for this record."],
    ["reportedBy", REVIEW_COPY.fccNotes.reportedBy("Pat"), "Reported by Pat, not yet confirmed"],
    ["confirmed", REVIEW_COPY.fccNotes.confirmed, "Confirmed"],
    ["report", REVIEW_COPY.fccNotes.report, "Report an FCC note"],
    ["intro", REVIEW_COPY.fccNotes.intro, "Heard something that can't go on air? Say which track and what's in it. Every DJ sees your note straight away, with your name. A music director will confirm it."],
    ["track", REVIEW_COPY.fccNotes.track, "Track"],
    ["trackPlaceholder", REVIEW_COPY.fccNotes.trackPlaceholder, "A2, or the track's name"],
    ["note", REVIEW_COPY.fccNotes.note, "What's in it"],
    ["needBoth", REVIEW_COPY.fccNotes.needBoth, "Say which track and what's in it."],
    ["submit", REVIEW_COPY.fccNotes.submit, "Report"],
    ["cancel", REVIEW_COPY.fccNotes.cancel, "Cancel"],
    ["couldNotReport", REVIEW_COPY.fccNotes.couldNotReport, "Couldn't report the note. Please try again."],
    ["loadFailed", REVIEW_COPY.fccNotes.loadFailed, "Couldn't load the FCC notes. Please try again."],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });

  it("lists confirmed notes first, then reported ones, each newest first, with their status lines", async () => {
    fakeReviewsEndpoints({
      fccNotesForRelease: {
        [ALBUM_ID]: [
          fccNote({ id: 1, track: "A1", note: "old reported", reported_at: "2026-10-01T10:00:00Z" }),
          fccNote({ id: 2, track: "A2", note: "old confirmed", status: "confirmed", reported_at: "2026-10-01T09:00:00Z" }),
          fccNote({ id: 3, track: "B1", note: "new reported", reported_by: "DJ Cat", reported_at: "2026-10-02T10:00:00Z" }),
          fccNote({ id: 4, track: "B2", note: "new confirmed", status: "confirmed", reported_at: "2026-10-02T09:00:00Z" }),
        ],
      },
    });
    renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);

    const items = await screen.findAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "B2: new confirmedConfirmed",
      "A2: old confirmedConfirmed",
      "B1: new reportedReported by DJ Cat, not yet confirmed",
      "A1: old reportedReported by DJ Me, not yet confirmed",
    ]);
    expect(screen.getByText("FCC notes")).toBeInTheDocument();
  });

  it("says so when the record has no notes", async () => {
    fakeReviewsEndpoints();
    renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);

    expect(await screen.findByText("No FCC notes for this record.")).toBeInTheDocument();
  });

  it("shows the load-failure line when the read fails with nothing to show", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/fcc-notes`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the FCC notes. Please try again.");
  });

  it.each([
    { label: "the flag is off", flag: "", authority: Authorization.MD, shown: false },
    { label: "a DJ is under staff", flag: "staff", authority: Authorization.DJ, shown: false },
    { label: "a music director is under staff", flag: "staff", authority: Authorization.MD, shown: true },
  ])("when $label, the panel renders: $shown", async ({ flag, authority, shown }) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    fakeReviewsEndpoints();
    const requested: string[] = [];
    const log = ({ request }: { request: Request }) => void requested.push(new URL(request.url).pathname);
    server.events.on("request:start", log);

    try {
      const { container, store } = renderWithProviders(<FccNotesPanel intakeItemId={ITEM_ID} />);
      if (shown) expect(await screen.findByText("FCC notes")).toBeInTheDocument();
      else {
        await reviewsSettled(store);
        expect(requested).toEqual([]);
        expect(container).toBeEmptyDOMElement();
      }
    } finally {
      server.events.removeListener("request:start", log);
    }
  });

  describe("reporting", () => {
    const open = async () => {
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Report an FCC note" }));
      expect(screen.getByText(/Heard something that can't go on air\?/)).toBeInTheDocument();
      return user;
    };
    const fill = async (user: ReturnType<typeof userEvent.setup>, track: string, note: string) => {
      const trackBox = screen.getByPlaceholderText("A2, or the track's name");
      const noteBox = screen.getByLabelText("What's in it");
      await user.clear(trackBox);
      await user.clear(noteBox);
      if (track) await user.type(trackBox, track);
      if (note) await user.type(noteBox, note);
    };
    const capturePosts = () => {
      const posts: unknown[] = [];
      server.use(
        http.post(`${TEST_BACKEND_URL}/fcc-notes`, async ({ request }) => {
          posts.push(await request.json());
          return HttpResponse.json(fccNote({ id: 9, album_id: ALBUM_ID, intake_item_id: null }), { status: 201 });
        }),
      );
      return posts;
    };

    it.each([
      ["a blank track", "  ", "A word."],
      ["a blank note", "A2", "   "],
    ])("stops %s before the request", async (_label, track, note) => {
      fakeReviewsEndpoints();
      const posts = capturePosts();
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);
      const user = await open();

      await fill(user, track, note);
      await user.click(screen.getByRole("button", { name: "Report" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Say which track and what's in it.");
      expect(posts).toEqual([]);
    });

    it("lists the new note as reported after a success, and closes the form", async () => {
      let reported = false;
      fakeReviewsEndpoints();
      server.use(
        http.get(`${TEST_BACKEND_URL}/fcc-notes`, () =>
          HttpResponse.json(reported ? [fccNote({ id: 9, track: "A2", note: "A word.", reported_by: "DJ Me" })] : []),
        ),
        http.post(`${TEST_BACKEND_URL}/fcc-notes`, () => {
          reported = true;
          return HttpResponse.json(fccNote({ id: 9 }), { status: 201 });
        }),
      );
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);
      const user = await open();

      await fill(user, "A2", "A word.");
      await user.click(screen.getByRole("button", { name: "Report" }));

      const item = await screen.findByRole("listitem");
      expect(item).toHaveTextContent("A2: A word.");
      expect(within(item).getByText("Reported by DJ Me, not yet confirmed")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
    });

    it.each([
      ["the album page", <FccNotesPanel key="a" albumId={ALBUM_ID} />, { album_id: ALBUM_ID, track: "A2", note: "A word." }],
      ["a logged record", <FccNotesPanel key="i" intakeItemId={ITEM_ID} />, { intake_item_id: ITEM_ID, track: "A2", note: "A word." }],
    ])("the request on %s carries exactly one subject id", async (_label, panel, expected) => {
      fakeReviewsEndpoints();
      const posts = capturePosts();
      renderWithProviders(panel);
      const user = await open();

      await fill(user, " A2 ", " A word. ");
      await user.click(screen.getByRole("button", { name: "Report" }));

      await waitFor(() => expect(posts).toEqual([expected]));
    });

    it.each([
      [400, "Track is too long."],
      [403, "Your account has no name to report under."],
    ])("shows the server's message for a %i and writes nothing", async (status, message) => {
      fakeReviewsEndpoints();
      server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes`, () => HttpResponse.json({ message }, { status })));
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);
      const user = await open();

      await fill(user, "A2", "A word.");
      await user.click(screen.getByRole("button", { name: "Report" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.getByText("No FCC notes for this record.")).toBeInTheDocument();
    });

    it.each<[string, () => Response]>([
      ["a 500 with a server message", () => HttpResponse.json({ message: "Internal server error" }, { status: 500 })],
      ["a network error", () => HttpResponse.error()],
    ])("shows the screen's own line, not the server's message, for %s", async (_label, respond) => {
      fakeReviewsEndpoints();
      server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes`, respond));
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);
      const user = await open();

      await fill(user, "A2", "A word.");
      await user.click(screen.getByRole("button", { name: "Report" }));

      expect((await screen.findByRole("alert")).textContent).toBe("Couldn't report the note. Please try again.");
    });
  });
});
