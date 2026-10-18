import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { act } from "react";
import { fakeReviewsEndpoints, holdResponse, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/src/components/shared/Authorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  RequireMD: ({ children }: { children: React.ReactNode }) => children,
}));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router);
});

type Probably = { library: { id: number } | undefined; formCount: number; settled: boolean };
const probably = vi.hoisted(() => ({
  result: { library: undefined, formCount: 0, settled: true } as Probably,
  /** The arguments of every call, to see what the form asked for. */
  calls: [] as unknown[][],
  listeners: new Set<() => void>(),
}));
vi.mock("@/src/hooks/useReviewProbablyExists", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useReviewProbablyExists: (...args: unknown[]) => {
      probably.calls.push(args);
      return useSyncExternalStore(
        (listener) => {
          probably.listeners.add(listener);
          return () => probably.listeners.delete(listener);
        },
        () => probably.result,
      );
    },
  };
});

/** Changes what the hook answers while the dialog is open, as a read that lands later does. */
const answerNow = (result: Probably) => {
  act(() => {
    probably.result = result;
    probably.listeners.forEach((listener) => listener());
  });
};

import { toast } from "sonner";
import AddRecordDialog from "@/src/components/experiences/modern/reviews/AddRecordDialog";

const ONE_STEP = "Add and choose its review…";
const MOON_PIX = intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix" });

const openAndFill = async (user: ReturnType<typeof renderWithProviders>["user"], fields: { artist?: string; album?: string } = { artist: "Cat Power", album: "Moon Pix" }) => {
  await user.click(await screen.findByRole("button", { name: "Add a record" }));
  const dialog = await screen.findByRole("dialog", { name: "Add a record" });
  if (fields.artist) {
    await user.type(within(dialog).getByLabelText(/^Artist/), fields.artist);
  }
  if (fields.album) {
    await user.type(within(dialog).getByLabelText(/^Album/), fields.album);
  }
  await user.click(within(dialog).getByRole("radio", { name: "As files" }));
  return dialog;
};

describe("Add a record: a review probably exists", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
    router.push.mockReset();
    probably.result = { library: undefined, formCount: 0, settled: true };
    probably.calls = [];
    fakeReviewsEndpoints({ open: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  const LIBRARY_LINE = "The library already has Cat Power, Moon Pix, with a review.";
  it.each([
    ["a library match", { library: { id: 42 }, formCount: 0 }, [LIBRARY_LINE], "library:42"],
    ["a library match and form reviews", { library: { id: 42 }, formCount: 2 }, [LIBRARY_LINE, "2 form reviews of Cat Power."], "library:42"],
    ["form reviews only", { library: undefined, formCount: 3 }, ["3 form reviews of Cat Power."], "form"],
  ])("with %s, shows the hint and the one-step button, which adds once and goes to the record's page", async (_name, result, lines, cite) => {
    probably.result = { ...result, settled: true };
    const post = vi.fn();
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => { post(); return HttpResponse.json(MOON_PIX); }));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);

    // One polite, atomic status line, so a screen reader reads the hint's lines together.
    const status = await within(dialog).findByRole("status");
    expect(status).toHaveAttribute("aria-atomic", "true");
    await waitFor(() => expect(within(status).getAllByText(/./).map((line) => line.textContent)).toEqual(lines));
    expect(probably.calls.at(-1)).toEqual(["Cat Power", "Moon Pix", true]);
    await user.click(within(dialog).getByRole("button", { name: ONE_STEP }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dashboard/admin/intake/11?get=cite&cite=${cite}`));
    expect(post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("offers the one-step button only once both reads have answered, so it never cites the forms while the catalog read is still to come", async () => {
    probably.result = { library: undefined, formCount: 2, settled: false };
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(MOON_PIX)));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);

    // The form archive has answered; the catalog has not. Wait until the form has asked about the settled text.
    await waitFor(() => expect(probably.calls.at(-1)).toEqual(["Cat Power", "Moon Pix", true]));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(within(dialog).queryByRole("button", { name: ONE_STEP })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("2 form reviews of Cat Power.")).not.toBeInTheDocument();

    answerNow({ library: { id: 42 }, formCount: 2, settled: true });
    await user.click(await within(dialog).findByRole("button", { name: ONE_STEP }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/admin/intake/11?get=cite&cite=library:42"));
  });

  it("disables both add buttons while an add is in flight, so a second click or Enter adds nothing more", async () => {
    probably.result = { library: { id: 42 }, formCount: 0, settled: true };
    const add = holdResponse("post", `${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(MOON_PIX));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);
    await user.click(await within(dialog).findByRole("button", { name: ONE_STEP }));
    await waitFor(() => expect(add.calls.count).toBe(1));

    const buttons = [within(dialog).getByRole("button", { name: /^Add a record/ }), within(dialog).getByRole("button", { name: /^Add and choose/ })];
    buttons.forEach((button) => expect(button).toBeDisabled());
    // A busy button is also out of the pointer's reach, so click it the way a stray event would.
    buttons.forEach((button) => fireEvent.click(button));
    await user.click(within(dialog).getByLabelText(/^Album/));
    await user.keyboard("{Enter}");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(add.calls.count).toBe(1);

    add.release();
    await add.answered;
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(add.calls.count).toBe(1);
  });

  it("shows neither hint nor one-step button when nothing is found, and plain Add a record leaves the dialog on what was added", async () => {
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(MOON_PIX)));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);

    expect(within(dialog).queryByRole("button", { name: ONE_STEP })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add a record" }));
    expect(await within(dialog).findByText("Added Moon Pix by Cat Power.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("plain Add a record with a hint showing does not navigate", async () => {
    probably.result = { library: { id: 42 }, formCount: 0, settled: true };
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(MOON_PIX)));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);
    await screen.findByRole("button", { name: ONE_STEP });
    await user.click(within(dialog).getByRole("button", { name: "Add a record" }));

    expect(await within(dialog).findByText("Added Moon Pix by Cat Power.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("turns the lookup off and shows nothing while the album is empty", async () => {
    probably.result = { library: { id: 42 }, formCount: 1, settled: true };

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user, { artist: "Cat Power" });

    expect(within(dialog).queryByRole("button", { name: ONE_STEP })).not.toBeInTheDocument();
    // The lookup stays switched off for every render, not only the last.
    expect(probably.calls.length).toBeGreaterThan(0);
    expect(probably.calls.map(([, , enabled]) => enabled)).not.toContain(true);
  });

  it("shows nothing while the typed text is ahead of the debounce", async () => {
    probably.result = { library: { id: 42 }, formCount: 0, settled: true };

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Add a record" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a record" });
    await user.type(within(dialog).getByLabelText(/^Artist/), "Cat Power");
    await user.type(within(dialog).getByLabelText(/^Album/), "Moon Pix");
    await user.click(within(dialog).getByRole("radio", { name: "As files" }));
    await screen.findByRole("button", { name: ONE_STEP });

    await user.type(within(dialog).getByLabelText(/^Album/), "s");
    expect(within(dialog).queryByRole("button", { name: ONE_STEP })).not.toBeInTheDocument();
    expect(probably.calls.at(-1)).toEqual(["Cat Power", "Moon Pix", false]);
    expect(await within(dialog).findByRole("button", { name: ONE_STEP })).toBeInTheDocument();
    expect(probably.calls.at(-1)).toEqual(["Cat Power", "Moon Pixs", true]);
  });

  it("keeps the dialog open, shows the error and navigates nowhere when the one-step add is rejected", async () => {
    probably.result = { library: { id: 42 }, formCount: 0, settled: true };
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);
    await user.click(await within(dialog).findByRole("button", { name: ONE_STEP }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
