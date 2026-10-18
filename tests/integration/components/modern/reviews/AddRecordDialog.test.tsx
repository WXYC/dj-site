import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

// The chips write the stage with `history.replaceState`, which the App Router syncs to `useSearchParams`; the spy in `beforeEach` does the same sync, so the tab shows the stage the dialog hands off to.
const url = vi.hoisted(() => ({ search: "", listeners: new Set<() => void>() }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  const subscribe = (listener: () => void) => {
    url.listeners.add(listener);
    return () => url.listeners.delete(listener);
  };
  return createNavigationModuleMock(
    { push: vi.fn(), replace: vi.fn() },
    { pathname: "/dashboard/reviews/music-directors", search: () => useSyncExternalStore(subscribe, () => url.search) },
  );
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { toast } from "sonner";
import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const COPY = REVIEW_COPY.intake;
const ADD = "Add a record";
const SHELF_ROW = intakeItem({ id: 1, artist_name: "Juana Molina", album_title: "DOGA", logged_at: "2026-09-01T12:00:00Z" });
const MOON_PIX = intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", logged_at: "2026-10-17T12:00:00Z" });

type User = ReturnType<typeof renderWithProviders>["user"];

/** The shelf as the server holds it: an add puts Moon Pix on it, and the read that follows answers after `lateMs`. */
function fakeShelf(lateMs = 0) {
  const rows: IntakeItem[] = [SHELF_ROW];
  const posted = vi.fn();
  fakeReviewsEndpoints({ open: () => rows });
  server.use(
    http.get(`${TEST_BACKEND_URL}/intake`, async () => {
      if (posted.mock.calls.length > 0) {
        await delay(lateMs);
      }
      return HttpResponse.json([...rows].sort((a, b) => b.logged_at.localeCompare(a.logged_at)));
    }),
    http.post(`${TEST_BACKEND_URL}/intake`, () => {
      posted();
      rows.push(MOON_PIX);
      return HttpResponse.json(MOON_PIX);
    }),
  );
  return { posted };
}

const openDialog = async (user: User) => {
  await user.click(await screen.findByRole("button", { name: ADD }));
  return screen.findByRole("dialog", { name: ADD });
};

const fillMoonPix = async (user: User, dialog: HTMLElement) => {
  await user.type(within(dialog).getByLabelText(/^Artist/), "Cat Power");
  await user.type(within(dialog).getByLabelText(/^Album/), "Moon Pix");
  await user.click(within(dialog).getByRole("radio", { name: "As files" }));
};

const addMoonPix = async (user: User, dialog: HTMLElement) => {
  await fillMoonPix(user, dialog);
  await user.click(within(dialog).getByRole("button", { name: ADD }));
};

const markedRows = () => [...document.querySelectorAll("[data-added]")];

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  url.search = "";
  vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, target) => {
    url.search = new URL(String(target), "http://localhost").search;
    url.listeners.forEach((listener) => listener());
  });
  mockAuth.authority = Authorization.MD;
  vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
});
afterEach(() => {
  vi.mocked(window.history.replaceState).mockRestore();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Add a record, on the New music tab", () => {
  it("shows a music director the tab's line and an Add a record button above the stage chips", async () => {
    fakeShelf();

    renderWithProviders(<IntakeLanes />);

    const button = await screen.findByRole("button", { name: ADD });
    const line = screen.getByText(COPY.newMusicLine);
    const chips = await screen.findByRole("tablist");
    expect(line.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a DJ neither the line nor the button", async () => {
    mockAuth.authority = Authorization.DJ;
    fakeShelf();

    const { container } = renderWithProviders(<IntakeLanes />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(COPY.newMusicLine)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ADD })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the button while the lists cannot be read", async () => {
    fakeReviewsEndpoints();
    server.use(http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "down" }, { status: 500 })));

    renderWithProviders(<IntakeLanes />);

    expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_COPY.screen.loadFailed);
    expect(screen.getByRole("button", { name: ADD })).toBeInTheDocument();
  });

  it("opens a dialog named Add a record that shows that text once, with the form and its line", async () => {
    fakeShelf();
    const { user } = renderWithProviders(<IntakeLanes />);

    const dialog = await openDialog(user);

    // The title is the dialog's only heading: the form leaves out its own, and the submit button is a button.
    expect(within(dialog).getAllByRole("heading")).toHaveLength(1);
    expect(within(dialog).getByRole("heading", { name: ADD })).toBeInTheDocument();
    expect(within(dialog).getByText(COPY.addRecordLine)).toBeInTheDocument();
    expect(within(dialog).getByRole("form", { name: ADD })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: REVIEW_COPY.screen.cancel })).toBeInTheDocument();
  });

  it("says what was added and offers Add another and Done after a successful add", async () => {
    fakeShelf();
    const { user } = renderWithProviders(<IntakeLanes />);
    const dialog = await openDialog(user);

    await addMoonPix(user, dialog);

    expect(await within(dialog).findByText("Added Moon Pix by Cat Power.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("form")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: COPY.addAnother })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: COPY.addDone })).toBeInTheDocument();
  });

  it("shows an empty form after Add another, and keeps the dialog open", async () => {
    fakeShelf();
    const { user } = renderWithProviders(<IntakeLanes />);
    const dialog = await openDialog(user);
    await addMoonPix(user, dialog);

    await user.click(await within(dialog).findByRole("button", { name: COPY.addAnother }));

    expect(screen.getByRole("dialog", { name: ADD })).toBe(dialog);
    expect(within(dialog).getByLabelText(/^Artist/)).toHaveValue("");
    expect(within(dialog).getByLabelText(/^Album/)).toHaveValue("");
    expect(within(dialog).getByRole("radio", { name: "As files" })).not.toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "A disc or a record" })).not.toBeChecked();
    expect(within(dialog).queryByText("Added Moon Pix by Cat Power.")).not.toBeInTheDocument();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("closes on Done, shows the On the review shelf stage and returns focus to the button", async () => {
    fakeShelf();
    const { user } = renderWithProviders(<IntakeLanes />);
    const opener = await screen.findByRole("button", { name: ADD });
    const dialog = await openDialog(user);
    await addMoonPix(user, dialog);

    await user.click(await within(dialog).findByRole("button", { name: COPY.addDone }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.history.replaceState).toHaveBeenCalledTimes(1);
    expect(url.search).toBe("?stage=review_shelf");
    expect(await screen.findByRole("tabpanel", { name: COPY.onShelf })).toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("closes on Escape after an add exactly as Done does", async () => {
    fakeShelf();
    const { user } = renderWithProviders(<IntakeLanes />);
    const dialog = await openDialog(user);
    await addMoonPix(user, dialog);
    await within(dialog).findByText("Added Moon Pix by Cat Power.");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(url.search).toBe("?stage=review_shelf");
  });

  it("keeps the dialog open and says the add failed when the server refuses it", async () => {
    fakeShelf();
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
    const { user } = renderWithProviders(<IntakeLanes />);
    const dialog = await openDialog(user);

    await addMoonPix(user, dialog);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REVIEW_COPY.screen.writeFailed));
    expect(screen.getByRole("dialog", { name: ADD })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Artist/)).toHaveValue("Cat Power");
    expect(within(dialog).queryByText(/^Added /)).not.toBeInTheDocument();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it.each([
    ["Escape", async (user: User) => user.keyboard("{Escape}")],
    ["Cancel", async (user: User, dialog: HTMLElement) => user.click(within(dialog).getByRole("button", { name: REVIEW_COPY.screen.cancel }))],
  ])("closes on %s with nothing added and leaves the URL alone", async (_how, close) => {
    fakeShelf();
    const { user } = renderWithProviders(<IntakeLanes />);
    const opener = await screen.findByRole("button", { name: ADD });
    const dialog = await openDialog(user);

    await close(user, dialog);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(url.search).toBe("");
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("opens on a fresh form after being closed with typed text", async () => {
    fakeShelf();
    const { user } = renderWithProviders(<IntakeLanes />);
    let dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/^Artist/), "Cat Power");
    await user.click(within(dialog).getByRole("button", { name: REVIEW_COPY.screen.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    dialog = await openDialog(user);

    expect(within(dialog).getByLabelText(/^Artist/)).toHaveValue("");
  });

  it("cannot be dismissed while the add is on the wire", async () => {
    fakeShelf();
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async () => {
        await delay(300);
        return HttpResponse.json(MOON_PIX);
      }),
    );
    const { user } = renderWithProviders(<IntakeLanes />);
    const dialog = await openDialog(user);
    await fillMoonPix(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: ADD }));

    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: ADD })).toBeInTheDocument();
    expect(await within(dialog).findByText("Added Moon Pix by Cat Power.")).toBeInTheDocument();
  });
});

describe("the row Done hands off to", () => {
  const reducedMotion = (reduced: boolean) =>
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: reduced && query === "(prefers-reduced-motion: reduce)", media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList,
    );

  it.each([
    ["scrolls smoothly", false, "smooth"],
    ["jumps when the reader prefers reduced motion", true, "auto"],
  ])("marks the new row, which the read delivers late, and %s to it once", async (_case, reduced, behavior) => {
    fakeShelf(200);
    reducedMotion(reduced);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const { user } = renderWithProviders(<IntakeLanes />);
    const dialog = await openDialog(user);
    await addMoonPix(user, dialog);
    await user.click(await within(dialog).findByRole("button", { name: COPY.addDone }));

    await waitFor(() => expect(markedRows()).toHaveLength(1));

    const [marked] = markedRows();
    expect(marked).toHaveTextContent("Moon Pix");
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(marked);
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ behavior }));
  });

  it("marks no other row", async () => {
    fakeShelf();
    const { user } = renderWithProviders(<IntakeLanes />);
    const dialog = await openDialog(user);
    await addMoonPix(user, dialog);
    await user.click(await within(dialog).findByRole("button", { name: COPY.addDone }));

    await waitFor(() => expect(markedRows()).toHaveLength(1));

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    const unmarked = rows.filter((row) => !row.querySelector("[data-added]"));
    expect(unmarked).toHaveLength(1);
    expect(unmarked[0]).toHaveTextContent("DOGA");
  });

  it("marks no row, and scrolls to none, when no record was added", async () => {
    fakeShelf();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    renderWithProviders(<IntakeLanes />);

    fireEvent.click(await screen.findByRole("tab", { name: /^On the review shelf,/ }));

    await screen.findByRole("tabpanel", { name: COPY.onShelf });
    expect(markedRows()).toHaveLength(0);
    expect(scroll).not.toHaveBeenCalled();
  });
});
