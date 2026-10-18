import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

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

const probably = vi.hoisted(() => ({ result: { library: undefined, formCount: 0 } as { library: { id: number } | undefined; formCount: number } }));
vi.mock("@/src/hooks/useReviewProbablyExists", () => ({
  useReviewProbablyExists: () => probably.result,
}));

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
    probably.result = { library: undefined, formCount: 0 };
    fakeReviewsEndpoints({ open: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["a library match", { library: { id: 42 }, formCount: 0 }, "The library already has Cat Power, Moon Pix, with a review.", "library:42"],
    ["a library match and form reviews", { library: { id: 42 }, formCount: 2 }, "2 form reviews of Cat Power.", "library:42"],
    ["form reviews only", { library: undefined, formCount: 3 }, "3 form reviews of Cat Power.", "form"],
  ])("with %s, shows the hint and the one-step button, which adds once and goes to the record's page", async (_name, result, line, cite) => {
    probably.result = result;
    const post = vi.fn();
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => { post(); return HttpResponse.json(MOON_PIX); }));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);

    expect(await within(dialog).findByText(line)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: ONE_STEP }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dashboard/admin/intake/11?get=cite&cite=${cite}`));
    expect(post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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
    probably.result = { library: { id: 42 }, formCount: 0 };
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(MOON_PIX)));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);
    await screen.findByRole("button", { name: ONE_STEP });
    await user.click(within(dialog).getByRole("button", { name: "Add a record" }));

    expect(await within(dialog).findByText("Added Moon Pix by Cat Power.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("makes no lookup and shows nothing while the album is empty", async () => {
    probably.result = { library: { id: 42 }, formCount: 1 };

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user, { artist: "Cat Power" });

    expect(within(dialog).queryByRole("button", { name: ONE_STEP })).not.toBeInTheDocument();
  });

  it("shows nothing while the typed text is ahead of the debounce", async () => {
    probably.result = { library: { id: 42 }, formCount: 0 };

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Add a record" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a record" });
    await user.type(within(dialog).getByLabelText(/^Artist/), "Cat Power");
    await user.type(within(dialog).getByLabelText(/^Album/), "Moon Pix");
    await user.click(within(dialog).getByRole("radio", { name: "As files" }));
    await screen.findByRole("button", { name: ONE_STEP });

    await user.type(within(dialog).getByLabelText(/^Album/), "s");
    expect(within(dialog).queryByRole("button", { name: ONE_STEP })).not.toBeInTheDocument();
    expect(await within(dialog).findByRole("button", { name: ONE_STEP })).toBeInTheDocument();
  });

  it("keeps the dialog open, shows the error and navigates nowhere when the one-step add is rejected", async () => {
    probably.result = { library: { id: 42 }, formCount: 0 };
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));

    const { user } = renderWithProviders(<AddRecordDialog onDone={vi.fn()} />);
    const dialog = await openAndFill(user);
    await user.click(await within(dialog).findByRole("button", { name: ONE_STEP }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
