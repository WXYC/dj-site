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

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});

const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { authClient } from "@/lib/features/authentication/client";
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
          fccNote({ reported_by_user_id: "dj-other", id: 1, track: "A1", note: "old reported", reported_at: "2026-10-01T10:00:00Z" }),
          fccNote({ reported_by_user_id: "dj-other", id: 2, track: "A2", note: "old confirmed", status: "confirmed", reported_at: "2026-10-01T09:00:00Z" }),
          fccNote({ reported_by_user_id: "dj-other", id: 3, track: "B1", note: "new reported", reported_by: "DJ Cat", reported_at: "2026-10-02T10:00:00Z" }),
          fccNote({ reported_by_user_id: "dj-other", id: 4, track: "B2", note: "new confirmed", status: "confirmed", reported_at: "2026-10-02T09:00:00Z" }),
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

  describe("controls on a note row", () => {
    const rowButtons = async (note: ReturnType<typeof fccNote>, id: string, authority: Authorization) => {
      mockAuth.id = id;
      mockAuth.authority = authority;
      fakeReviewsEndpoints({ fccNotesForRelease: { [ALBUM_ID]: [note] } });
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);
      const item = await screen.findByRole("listitem");
      return within(item).queryAllByRole("button").map((b) => b.textContent);
    };

    it.each([
      ["a music director on a reported note", "reported", "md-me", Authorization.MD, ["Confirm", "Remove"]],
      ["a music director on a confirmed note", "confirmed", "md-me", Authorization.MD, ["Remove"]],
      ["a music director who reported it", "reported", "dj-me", Authorization.MD, ["Confirm", "Remove"]],
      ["a DJ who did not report it", "reported", "dj-other", Authorization.DJ, []],
      ["the reporter on a reported note", "reported", "dj-me", Authorization.DJ, ["Remove my note"]],
      ["the reporter on a confirmed note", "confirmed", "dj-me", Authorization.DJ, []],
    ] as const)("shows %s: %j", async (_label, status, id, authority, expected) => {
      const note = fccNote({ id: 1, status, reported_by_user_id: "dj-me", album_id: ALBUM_ID, intake_item_id: null });

      expect(await rowButtons(note, id, authority)).toEqual(expected);
    });

    it.each([
      ["a music director on a reported note", "reported", "md-me", Authorization.MD, "Remove", "Remove this note? DJ Me reported it."],
      ["a music director on a confirmed note", "confirmed", "md-me", Authorization.MD, "Remove", "Remove this confirmed note? It will no longer be printed on the slip."],
      ["the reporter", "reported", "dj-me", Authorization.DJ, "Remove my note", "Remove your note?"],
    ] as const)("asks %s the approved question", async (_label, status, id, authority, button, question) => {
      mockAuth.id = id;
      mockAuth.authority = authority;
      fakeReviewsEndpoints({
        fccNotesForRelease: { [ALBUM_ID]: [fccNote({ status, reported_by_user_id: "dj-me", album_id: ALBUM_ID })] },
      });
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);

      await userEvent.setup().click(await screen.findByRole("button", { name: button }));

      expect(await screen.findByRole("alertdialog", { name: question })).toBeInTheDocument();
    });

    it("shows the status line as Confirmed and the reprint line after a confirm", async () => {
      mockAuth.id = "md-me";
      mockAuth.authority = Authorization.MD;
      fakeReviewsEndpoints({ fccNotesForRelease: { [ALBUM_ID]: [fccNote({ album_id: ALBUM_ID })] } });
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);

      await userEvent.setup().click(await screen.findByRole("button", { name: "Confirm" }));

      expect(await screen.findByText(REVIEW_COPY.fccNotes.reprint)).toBeInTheDocument();
      expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    });
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

    it("shows the server's message for a 400 and writes nothing", async () => {
      fakeReviewsEndpoints();
      server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes`, () => HttpResponse.json({ message: "Track is too long." }, { status: 400 })));
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);
      const user = await open();

      await fill(user, "A2", "A word.");
      await user.click(screen.getByRole("button", { name: "Report" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Track is too long.");
      expect(screen.getByText("No FCC notes for this record.")).toBeInTheDocument();
    });

    it.each([
      { label: "no session left", session: null, navigates: true },
      { label: "the session still there", session: { user: { id: "dj-me" } }, navigates: false },
    ])("on a 403 with $label, $navigates ? sends the person to sign-in : shows the generic line, never the server's", async ({ session, navigates }) => {
      vi.mocked(authClient.getSession).mockResolvedValue({ data: session, error: null } as never);
      router.replace.mockClear();
      fakeReviewsEndpoints();
      server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes`, () => HttpResponse.json({ message: "Your account has no name to report under." }, { status: 403 })));
      renderWithProviders(<FccNotesPanel albumId={ALBUM_ID} />);
      const user = await open();

      await fill(user, "A2", "A word.");
      await user.click(screen.getByRole("button", { name: "Report" }));

      if (navigates) await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?bounced=no-session"));
      else expect((await screen.findByRole("alert")).textContent).toBe("Couldn't report the note. Please try again.");
      expect(screen.queryByText("Your account has no name to report under.")).not.toBeInTheDocument();
      expect(router.replace).toHaveBeenCalledTimes(navigates ? 1 : 0);
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
