import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import ForceEndDialog from "@/src/components/experiences/modern/admin/shows/ForceEndDialog";
import type { OpenShow } from "@/lib/features/flowsheet/types";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

const show = (overrides: Partial<OpenShow> = {}): OpenShow => ({
  id: 1951200,
  primary_dj_id: null,
  dj_name: "dj sue",
  show_name: null,
  start_time: "2026-09-01T23:00:00.000Z",
  legacy_show_id: null,
  entry_count: 12,
  is_current: false,
  likely_abandoned: true,
  ...overrides,
});

/** Captures each force-end request's query string; answers as told. */
function installForceEnd(
  respond: () => Response
): { forced: (boolean | undefined)[] } {
  const seen: { forced: (boolean | undefined)[] } = { forced: [] };
  server.use(
    http.post(
      `${TEST_BACKEND_URL}/flowsheet/shows/:id/force-end`,
      ({ request }) => {
        const url = new URL(request.url);
        seen.forced.push(
          url.searchParams.has("force")
            ? url.searchParams.get("force") === "true"
            : undefined
        );
        return respond();
      }
    )
  );
  return seen;
}

describe("ForceEndDialog", () => {
  beforeEach(() => {
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("asks plainly for an abandoned show and sends no force", async () => {
    const seen = installForceEnd(() =>
      HttpResponse.json({ id: 1951200, end_time: "2026-09-01T23:59:00Z" })
    );
    const onClose = vi.fn();

    renderWithProviders(<ForceEndDialog show={show()} onClose={onClose} />);

    expect(
      screen.queryByText(/signs the current DJ off/i)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("force-end-confirm"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(seen.forced).toEqual([undefined]);
    expect(toastSuccess).toHaveBeenCalledWith("Show ended.");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("leads with the danger warning and sends force for the on-air show", async () => {
    const seen = installForceEnd(() =>
      HttpResponse.json({ id: 1951317, end_time: "2026-09-08T19:15:20Z" })
    );
    const onClose = vi.fn();

    renderWithProviders(
      <ForceEndDialog
        show={show({ id: 1951317, is_current: true })}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/signs the current DJ off/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("force-end-confirm"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(seen.forced).toEqual([true]);
  });

  // The 409 means the target became the on-air show after the row rendered.
  // The dialog must re-ask with the danger copy rather than auto-retrying:
  // escalating force without a human's second confirmation would waive the
  // exact consent gate the server held.
  it("re-asks in the danger variant on a 409, and only then sends force", async () => {
    let calls = 0;
    const seen = installForceEnd(() => {
      calls += 1;
      if (calls === 1) {
        return HttpResponse.json(
          {
            message:
              "Conflict: this is the current on-air show. Re-send with ?force=true to end it anyway.",
          },
          { status: 409 }
        );
      }
      return HttpResponse.json({ id: 1951200, end_time: "2026-09-01T23:59:00Z" });
    });
    const onClose = vi.fn();

    renderWithProviders(<ForceEndDialog show={show()} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("force-end-confirm"));

    // Still open, now carrying the client-owned warning — and no toast of the
    // server's curl instruction.
    expect(
      await screen.findByText(/signs the current DJ off/i)
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(seen.forced).toEqual([undefined]);

    fireEvent.click(screen.getByTestId("force-end-confirm"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(seen.forced).toEqual([undefined, true]);
  });

  // Proves the transformErrorResponse wrap end to end: the dialog's own
  // success-toned sentence lands and nothing red does — the shared error
  // middleware has no data.message to toast once the payload is wrapped.
  it("treats the already-ended 400 as the goal state, with no red toast", async () => {
    installForceEnd(() =>
      HttpResponse.json(
        { message: "Bad Request: show is already ended" },
        { status: 400 }
      )
    );
    const onClose = vi.fn();

    renderWithProviders(<ForceEndDialog show={show()} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("force-end-confirm"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith("That show was already closed.");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("reports a plain refusal in the dialog's own words", async () => {
    installForceEnd(() =>
      HttpResponse.json({ message: "Forbidden" }, { status: 403 })
    );
    const onClose = vi.fn();

    renderWithProviders(<ForceEndDialog show={show()} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("force-end-confirm"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "The server declined to end this show."
    );
    // Never the server's own sentence.
    expect(toastError).not.toHaveBeenCalledWith("Forbidden");
  });

  it("cancels without sending anything", async () => {
    const seen = installForceEnd(() =>
      HttpResponse.json({ id: 1951200, end_time: null })
    );
    const onClose = vi.fn();

    renderWithProviders(<ForceEndDialog show={show()} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("force-end-cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(seen.forced).toEqual([]);
  });
});
