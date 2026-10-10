import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, fccNote, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { authClient } from "@/lib/features/authentication/client";
import FccNotesPanel from "@/src/components/experiences/modern/reviews/FccNotesPanel";
import FccNotesToConfirm from "@/src/components/experiences/modern/reviews/FccNotesToConfirm";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const copy = REVIEW_COPY.fccNotes;
const SIGN_IN = "/login?bounced=no-session";

const waitingNote = (overrides = {}) =>
  fccNote({
    id: 1,
    album_id: null,
    intake_item_id: 3,
    artist_name: "Juana Molina",
    album_title: "DOGA",
    track: "A2",
    note: "A swear word.",
    reported_by: "Pat",
    reported_by_user_id: "dj-pat",
    reported_at: "2026-10-02T16:00:00Z",
    ...overrides,
  });

const sessionStill = () =>
  vi.mocked(authClient.getSession).mockResolvedValue({ data: { user: { id: "md-me" } }, error: null } as never);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  mockAuth.id = "md-me";
  mockAuth.authority = Authorization.MD;
  router.replace.mockClear();
  vi.mocked(authClient.getSession).mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("approved copy", () => {
  it.each([
    ["confirm", copy.confirm, "Confirm"],
    ["remove", copy.remove, "Remove"],
    ["removeQuestion", copy.removeQuestion("Pat"), "Remove this note? Pat reported it."],
    ["removeConfirmedQuestion", copy.removeConfirmedQuestion, "Remove this confirmed note? It will no longer be printed on the slip."],
    ["reprint", copy.reprint, "Confirmed notes are printed on the slip. If this record's slip is already on the cover, print the slip again to replace it."],
    ["removeMine", copy.removeMine, "Remove my note"],
    ["removeMineQuestion", copy.removeMineQuestion, "Remove your note?"],
    ["confirmedByMd", copy.confirmedByMd, "A music director has confirmed this note, so only they can remove it."],
    ["toConfirmTitle", copy.toConfirmTitle(2), "FCC notes to confirm (2)"],
    ["toConfirmRecord", copy.toConfirmRecord("Juana Molina", "DOGA"), "Juana Molina — DOGA"],
    ["toConfirmNote", copy.toConfirmNote("A2", "A swear word."), "A2: A swear word."],
    ["toConfirmReportedOn", copy.toConfirmReportedOn("Pat", "Friday, October 2, 2026"), "Reported by Pat on Friday, October 2, 2026"],
    ["toConfirmSpokenConfirm", copy.toConfirmSpokenConfirm("Juana Molina", "DOGA", "A2"), "Confirm the note on Juana Molina — DOGA, A2"],
    ["toConfirmSpokenRemove", copy.toConfirmSpokenRemove("Juana Molina", "DOGA", "A2"), "Remove the note on Juana Molina — DOGA, A2"],
    ["toConfirmLoadFailed", copy.toConfirmLoadFailed, "Couldn't load the FCC notes to confirm. Please try again."],
    ["couldNotConfirm", copy.couldNotConfirm, "Couldn't confirm the note. Please try again."],
    ["couldNotRemove", copy.couldNotRemove, "Couldn't remove the note. Please try again."],
  ])("words %s exactly as the station approved it", (_key, actual, approved) => {
    expect(actual).toBe(approved);
  });
});

describe("FccNotesToConfirm", () => {
  it("lists each waiting note oldest first with its record, track, note, reporter and long date", async () => {
    fakeReviewsEndpoints({
      fccNotesToConfirm: [
        waitingNote({ id: 2, track: "B1", note: "Newer.", reported_at: "2026-10-05T16:00:00Z" }),
        waitingNote({ id: 1 }),
      ],
    });
    renderWithProviders(<FccNotesToConfirm />);

    expect(await screen.findByRole("region", { name: "FCC notes to confirm (2)" })).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((li) => li.textContent)).toEqual([
      "Juana Molina — DOGAA2: A swear word.Reported by Pat on Friday, October 2, 2026ConfirmRemove",
      "Juana Molina — DOGAB1: Newer.Reported by Pat on Monday, October 5, 2026ConfirmRemove",
    ]);
  });

  it.each([
    ["a logged record", { album_id: null, intake_item_id: 3 }, "/dashboard/admin/intake/3"],
    ["a filed release", { album_id: 9, intake_item_id: null }, "/dashboard/album/9"],
    ["both ids", { album_id: 9, intake_item_id: 3 }, "/dashboard/album/9"],
  ])("links a note on %s to its record", async (_label, ids, href) => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote(ids)] });
    renderWithProviders(<FccNotesToConfirm />);

    expect(await screen.findByRole("link", { name: "Juana Molina — DOGA" })).toHaveAttribute("href", href);
  });

  it("gives Confirm and Remove the spoken names that say which note", async () => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
    renderWithProviders(<FccNotesToConfirm />);

    expect(await screen.findByRole("button", { name: "Confirm the note on Juana Molina — DOGA, A2" })).toHaveTextContent("Confirm");
    expect(screen.getByRole("button", { name: "Remove the note on Juana Molina — DOGA, A2" })).toHaveTextContent("Remove");
  });

  it("is absent when nothing waits", async () => {
    fakeReviewsEndpoints();
    const { container } = renderWithProviders(<FccNotesToConfirm />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own failure line when the read fails", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/fcc-notes`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
    renderWithProviders(<FccNotesToConfirm />);

    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't load the FCC notes to confirm. Please try again.");
  });

  it.each([
    { label: "the flag is off", flag: "", authority: Authorization.MD },
    { label: "a DJ is under staff", flag: "staff", authority: Authorization.DJ },
  ])("asks the server for nothing when $label", async ({ flag, authority }) => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", flag);
    mockAuth.authority = authority;
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
    const { container } = renderWithProviders(<FccNotesToConfirm />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("takes a confirmed note off the list and shows the reprint line once", async () => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote({ id: 1 }), waitingNote({ id: 2, track: "B1" })] });
    renderWithProviders(<FccNotesToConfirm />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Confirm the note on .*A2$/ }));

    expect(await screen.findByRole("region", { name: "FCC notes to confirm (1)" })).toBeInTheDocument();
    expect(screen.getAllByText(copy.reprint)).toHaveLength(1);
  });

  it("keeps the reprint line after the last waiting note is confirmed", async () => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
    renderWithProviders(<FccNotesToConfirm />);

    await userEvent.setup().click(await screen.findByRole("button", { name: /^Confirm the note/ }));

    expect(await screen.findByText(copy.reprint)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: copy.reprint })).toBeInTheDocument();
  });

  it("asks who reported it before a remove, and a Cancel sends nothing", async () => {
    const deletes: string[] = [];
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
    const log = ({ request }: { request: Request }) => {
      if (request.method === "DELETE") deletes.push(new URL(request.url).pathname);
    };
    server.events.on("request:start", log);
    renderWithProviders(<FccNotesToConfirm />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Remove the note/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Remove this note? Pat reported it." });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(deletes).toEqual([]);

    await user.click(screen.getByRole("button", { name: /^Remove the note/ }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(deletes).toEqual(["/fcc-notes/1"]));
    await waitFor(() => expect(screen.queryByRole("listitem")).not.toBeInTheDocument());
    server.events.removeListener("request:start", log);
  });

  it("shows no message when the note was already removed (404)", async () => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote(), waitingNote({ id: 2 })] });
    server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes/1/confirm`, () => HttpResponse.json({ message: "x" }, { status: 404 })));
    renderWithProviders(<FccNotesToConfirm />);

    await userEvent.setup().click((await screen.findAllByRole("button", { name: /^Confirm the note/ }))[0]);

    await waitFor(() => expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(copy.reprint)).not.toBeInTheDocument();
  });

  it("shows no message when a Remove finds the note already gone (404)", async () => {
    let answered = false;
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
    server.use(
      http.delete(`${TEST_BACKEND_URL}/fcc-notes/1`, () => {
        answered = true;
        return HttpResponse.json({ message: "x" }, { status: 404 });
      }),
    );
    renderWithProviders(<FccNotesToConfirm />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Remove the note/ }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(answered).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the station's failure line for a confirm that fails", async () => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
    server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes/1/confirm`, () => HttpResponse.json({ message: "Internal" }, { status: 500 })));
    renderWithProviders(<FccNotesToConfirm />);

    await userEvent.setup().click(await screen.findByRole("button", { name: /^Confirm the note/ }));

    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't confirm the note. Please try again.");
  });
});

describe("a 403 on a write", () => {
  const NO_NAME = "Your account has no name to confirm under.";
  const DELETE_REFUSED = "You may not delete this FCC note";

  it.each([
    { label: "a music director's Confirm, no session left", reporter: false, session: "gone", expectNav: true, line: null },
    { label: "a music director's Confirm, session still there", reporter: false, session: "there", expectNav: false, line: copy.couldNotConfirm },
    { label: "the reporter's Remove, a music director having confirmed the note", reporter: true, session: "unread", expectNav: false, line: copy.confirmedByMd },
  ])("on $label", async ({ reporter, session, expectNav, line }) => {
    if (session === "there") sessionStill();
    const user = userEvent.setup();
    if (reporter) {
      vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
      mockAuth.id = "dj-pat";
      mockAuth.authority = Authorization.DJ;
      fakeReviewsEndpoints({ fccNotesForItem: { "3": [waitingNote()] } });
      // The race: the confirm lands first, so the Remove is refused and every re-read answers the note as confirmed.
      server.use(
        http.delete(`${TEST_BACKEND_URL}/fcc-notes/1`, async () => {
          await fetch(`${TEST_BACKEND_URL}/fcc-notes/1/confirm`, { method: "POST" });
          return HttpResponse.json({ message: DELETE_REFUSED }, { status: 403 });
        }),
      );
      renderWithProviders(<FccNotesPanel intakeItemId={3} />);
      await user.click(await screen.findByRole("button", { name: "Remove my note" }));
      await user.click(within(await screen.findByRole("alertdialog", { name: "Remove your note?" })).getByRole("button", { name: "Remove" }));
      // The refetch has settled once the panel shows the note as confirmed; the line must outlive it.
      await screen.findByText(copy.confirmed);
    } else {
      fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
      server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes/1/confirm`, () => HttpResponse.json({ message: NO_NAME }, { status: 403 })));
      renderWithProviders(<FccNotesToConfirm />);
      await user.click(await screen.findByRole("button", { name: /^Confirm the note/ }));
    }

    if (expectNav) await waitFor(() => expect(router.replace).toHaveBeenCalledWith(SIGN_IN));
    else await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(line));
    if (reporter) expect(vi.mocked(authClient.getSession)).not.toHaveBeenCalled();
    else expect(vi.mocked(authClient.getSession)).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    expect(screen.queryByText(NO_NAME)).not.toBeInTheDocument();
    expect(screen.queryByText(DELETE_REFUSED)).not.toBeInTheDocument();
    if (reporter) expect(screen.getByText(copy.confirmedByMd)).toBeInTheDocument();
    else expect(screen.queryByText(copy.confirmedByMd)).not.toBeInTheDocument();
    if (!expectNav) expect(router.replace).not.toHaveBeenCalled();
  });

  it("on a music director's Confirm when the session read answers no user, sends them to sign-in", async () => {
    vi.mocked(authClient.getSession).mockImplementationOnce((() => Promise.resolve({ data: { user: null }, error: null })) as never);
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
    server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes/1/confirm`, () => HttpResponse.json({ message: NO_NAME }, { status: 403 })));
    renderWithProviders(<FccNotesToConfirm />);

    await userEvent.setup().click(await screen.findByRole("button", { name: /^Confirm the note/ }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(SIGN_IN));
  });

  describe("when the session read never settles", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("gives up at exactly 2000 ms and leaves the music director on the page with the generic line", async () => {
      let readAt = 0;
      vi.mocked(authClient.getSession).mockImplementationOnce((() => {
        // The timeout is armed in the same tick as the read, so this is the moment its 2000 ms start from.
        readAt = Date.now();
        return new Promise(() => {});
      }) as never);
      fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
      server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes/1/confirm`, () => HttpResponse.json({ message: NO_NAME }, { status: 403 })));
      renderWithProviders(<FccNotesToConfirm />);

      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(await screen.findByRole("button", { name: /^Confirm the note/ }));
      await waitFor(() => expect(readAt).toBeGreaterThan(0));

      // One millisecond short of the timeout the read is still pending: no line, no redirect.
      await act(() => vi.advanceTimersByTimeAsync(readAt + 1999 - Date.now()));
      expect(Date.now() - readAt).toBe(1999);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(router.replace).not.toHaveBeenCalled();

      // At 2000 ms the read gives up as unread: the generic line shows and nobody is sent to sign-in.
      await act(() => vi.advanceTimersByTimeAsync(readAt + 2000 - Date.now()));
      expect(Date.now() - readAt).toBe(2000);
      expect(screen.getByRole("alert").textContent).toBe(copy.couldNotConfirm);
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  it("tells a music director whose Remove is refused the generic line, never the reporter's", async () => {
    fakeReviewsEndpoints({ fccNotesToConfirm: [waitingNote()] });
    server.use(http.delete(`${TEST_BACKEND_URL}/fcc-notes/1`, () => HttpResponse.json({ message: DELETE_REFUSED }, { status: 403 })));
    renderWithProviders(<FccNotesToConfirm />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Remove the note/ }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(copy.couldNotRemove));
    expect(screen.queryByText(copy.confirmedByMd)).not.toBeInTheDocument();
  });

  it("drops a generic failure line once a music director confirms the note and the controls end", async () => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    mockAuth.id = "dj-pat";
    mockAuth.authority = Authorization.DJ;
    fakeReviewsEndpoints({ fccNotesForItem: { "3": [waitingNote()] } });
    server.use(
      http.delete(`${TEST_BACKEND_URL}/fcc-notes/1`, async () => {
        await fetch(`${TEST_BACKEND_URL}/fcc-notes/1/confirm`, { method: "POST" });
        return HttpResponse.json({ message: "Internal" }, { status: 500 });
      }),
    );
    renderWithProviders(<FccNotesPanel intakeItemId={3} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Remove my note" }));
    await user.click(within(await screen.findByRole("alertdialog", { name: "Remove your note?" })).getByRole("button", { name: "Remove" }));

    await screen.findByText(copy.confirmed);
    expect(screen.queryByRole("button", { name: "Remove my note" })).not.toBeInTheDocument();
    expect(screen.queryByText(copy.couldNotRemove)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("one write, every list that shows the note", () => {
  it.each([
    ["confirm", /^Confirm the note/, null],
    ["delete", /^Remove the note/, "Remove"],
  ])("a %s re-reads the album's panel, the logged record's panel and the waiting list", async (_name, button, dialogButton) => {
    const note = waitingNote({ album_id: 9, intake_item_id: 3 });
    fakeReviewsEndpoints({
      fccNotesForRelease: { "9": [note] },
      fccNotesForItem: { "3": [note] },
      fccNotesToConfirm: [note],
    });
    const reads: string[] = [];
    const log = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/fcc-notes") reads.push(url.search);
    };
    server.events.on("request:start", log);
    try {
      renderWithProviders(
        <>
          <FccNotesPanel albumId={9} />
          <FccNotesPanel intakeItemId={3} />
          <FccNotesToConfirm />
        </>,
      );
      const user = userEvent.setup();
      const act = await screen.findByRole("button", { name: button });
      await waitFor(() => expect(reads).toHaveLength(3));
      reads.length = 0;

      await user.click(act);
      if (dialogButton) await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: dialogButton }));

      await waitFor(() => expect([...reads].sort()).toEqual(["?album_id=9", "?intake_item_id=3", "?status=reported"]));
    } finally {
      server.events.removeListener("request:start", log);
    }
  });
});
