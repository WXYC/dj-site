import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { createTestRotationListRow, fakeRotationAdminEndpoints, setFieldValue } from "@/tests/helpers";

vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { renderWithModernTheme as renderWithProviders } from "@/tests/helpers/renderModern";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import RotationThresholdsForm from "@/src/components/experiences/modern/admin/rotation/RotationThresholdsForm";

const heavy = () => screen.getByLabelText("Heavy");
const medium = () => screen.getByLabelText("Medium");
const saveButton = () => screen.getByRole("button", { name: "Save windows" });

async function renderForm(options?: Parameters<typeof fakeRotationAdminEndpoints>[2]) {
  const fake = fakeRotationAdminEndpoints([], [], options);
  const rendered = renderWithProviders(<RotationThresholdsForm />);
  await screen.findByLabelText("Heavy");
  return { fake, ...rendered };
}

describe("RotationThresholdsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows beside each window how many active records it would mark past, and follows the draft", async () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const rows = [
      createTestRotationListRow({ rotation_id: 1, rotation_bin: "H", rotation_add_date: "2026-08-01" }),
      createTestRotationListRow({ rotation_id: 2, rotation_bin: "H", rotation_add_date: "2026-10-10" }),
      createTestRotationListRow({
        rotation_id: 3,
        rotation_bin: "H",
        rotation_add_date: "2026-06-01",
        rotation_kill_date: "2026-07-01",
      }),
    ];
    fakeRotationAdminEndpoints([], [], { windowDays: { H: 30, M: 45, L: 90, S: 120 } });
    renderWithProviders(<RotationThresholdsForm rows={rows} now={now} />);
    await screen.findByLabelText("Heavy");

    // One active Heavy record is past 30 days; the retired one never counts.
    expect(screen.getAllByText("1 past")).toHaveLength(1);
    setFieldValue(heavy(), "5");
    expect(await screen.findByText("2 past")).toBeInTheDocument();
  });

  it("seeds each bin's window from the read and offers no card-staleness field", async () => {
    await renderForm({ windowDays: { H: 30, M: 45, L: 90, S: 120 } });

    expect(heavy()).toHaveValue(30);
    expect(medium()).toHaveValue(45);
    expect(screen.getByLabelText("Light")).toHaveValue(90);
    expect(screen.getByLabelText("Singles")).toHaveValue(120);
    expect(screen.queryByLabelText(/stale|staleness/i)).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("shows only loading placeholders while the read is pending", async () => {
    const fake = fakeRotationAdminEndpoints([], []);
    fake.holdThresholdsReads();
    renderWithProviders(<RotationThresholdsForm />);

    expect(await screen.findByLabelText("Loading replacement windows")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save windows" })).not.toBeInTheDocument();

    await act(async () => {
      await fake.releaseThresholdsReads();
    });
    expect(await screen.findByLabelText("Heavy")).toBeInTheDocument();
  });

  it("replaces the form with a retryable failure, and seeds from the read once Retry succeeds", async () => {
    const fake = fakeRotationAdminEndpoints([], [], { windowDays: { H: 21 } });
    fake.failThresholdsReads();
    const { user } = renderWithProviders(<RotationThresholdsForm />);

    expect(await screen.findByText("Could not load the replacement windows.")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save windows" })).not.toBeInTheDocument();

    fake.recoverThresholdsReads();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText("Heavy")).toHaveValue(21);
  });

  it.each([
    ["blank", ""],
    ["a non-integer", "1.5"],
    ["below 1", "0"],
    ["above 365", "366"],
  ])("rejects %s client-side and never sends it", async (_name, value) => {
    const { fake } = await renderForm();

    setFieldValue(heavy(), value);

    expect(
      await screen.findByText("Heavy must be a whole number of days from 1 to 365."),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    // A disabled button takes no pointer events through user-event; the raw
    // click proves the handler is not reachable either.
    fireEvent.click(saveButton());
    expect(fake.thresholdsPatchBodies()).toEqual([]);
  });

  it("sends only the bins this draft changed, re-seeds from the saved record, and reports it", async () => {
    const { fake, user } = await renderForm();

    setFieldValue(heavy(), "45");
    await user.click(saveButton());

    await waitFor(() => expect(fake.thresholdsPatchBodies()).toEqual([{ window_days: { H: 45 } }]));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Saved the replacement windows."));
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(heavy()).toHaveValue(45);
    expect(medium()).toHaveValue(60);
  });

  it("holds only a value this draft changed to the 1..365 rule, so an untouched stored window never blocks a save", async () => {
    const { fake, user } = await renderForm({ windowDays: { S: 400 } });

    expect(screen.getByLabelText("Singles")).toHaveValue(400);
    setFieldValue(medium(), "50");
    await user.click(saveButton());

    await waitFor(() => expect(fake.thresholdsPatchBodies()).toEqual([{ window_days: { M: 50 } }]));
  });

  it("keeps Save and the inputs disabled while the read refetches after a save", async () => {
    const { fake, user } = await renderForm();
    fake.holdThresholdsReads();

    setFieldValue(heavy(), "45");
    await user.click(saveButton());
    await waitFor(() => expect(fake.thresholdsPatchBodies()).toHaveLength(1));
    // The refetch is held, so the old record is still what is on screen, and
    // anything typed now would be dropped when the record re-seeds the form.
    await waitFor(() => expect(medium()).toBeDisabled());
    expect(heavy()).toBeDisabled();
    expect(saveButton()).toBeDisabled();

    await act(async () => {
      await fake.releaseThresholdsReads();
    });
    await waitFor(() => expect(heavy()).toHaveValue(45));
    await waitFor(() => expect(medium()).toBeEnabled());
  });

  it("fails closed when a refetch fails after a save: Save disabled and a Retry shown over the stale record", async () => {
    const { fake, user } = await renderForm();
    fake.failThresholdsReads();

    setFieldValue(heavy(), "45");
    await user.click(saveButton());
    await waitFor(() => expect(fake.thresholdsPatchBodies()).toHaveLength(1));

    expect(await screen.findByText("Could not load the replacement windows.")).toBeInTheDocument();
    expect(medium()).toBeDisabled();
    expect(heavy()).toBeDisabled();
    expect(saveButton()).toBeDisabled();

    fake.recoverThresholdsReads();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByText("Could not load the replacement windows.")).not.toBeInTheDocument());
    await waitFor(() => expect(heavy()).toHaveValue(45));
  });
});
