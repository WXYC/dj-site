import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { useAppSelector } from "@/lib/hooks";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { rtkQueryErrorLogger } from "@/lib/rtk-query-error-logger";
import { toast } from "sonner";
import { makeStore } from "@/lib/store";
import { applicationSlice } from "@/lib/features/application/frontend";
import { renderWithProviders } from "@/tests/helpers/render";

function createRejectedAction(payload: unknown) {
  return {
    type: "api/executeQuery/rejected",
    payload,
    meta: {
      rejectedWithValue: true,
      requestId: "test-req",
      requestStatus: "rejected" as const,
      aborted: false,
      condition: false,
    },
  };
}

describe("rtkQueryErrorLogger (Bug 29)", () => {
  const next = vi.fn((action: unknown) => action);
  const api = { dispatch: vi.fn(), getState: vi.fn() };
  const middleware = rtkQueryErrorLogger(api)(next);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show toast for server errors with data.message", () => {
    const action = createRejectedAction({ data: { message: "Session expired" } });
    middleware(action);
    expect(toast.error).toHaveBeenCalledWith("Session expired");
  });

  it("should show toast for network errors (FETCH_ERROR)", () => {
    const action = createRejectedAction({
      status: "FETCH_ERROR",
      error: "TypeError: Failed to fetch",
    });
    middleware(action);
    expect(toast.error).toHaveBeenCalled();
  });

  it("should show toast for timeout errors", () => {
    const action = createRejectedAction({
      status: "TIMEOUT_ERROR",
      error: "Request timed out",
    });
    middleware(action);
    expect(toast.error).toHaveBeenCalled();
  });

  // An endpoint that opts out of the base query's non-JSON soft-fail sends the
  // parser's own complaint down this path. It names the character it choked on,
  // not the outage that produced it, so the toast must not repeat it verbatim.
  it("reports an unparseable body without quoting the JSON parser", () => {
    const action = createRejectedAction({
      status: "PARSING_ERROR",
      originalStatus: 502,
      data: "<!DOCTYPE html><html><body>Bad Gateway</body></html>",
      error: "SyntaxError: Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
    });
    middleware(action);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("SyntaxError"),
    );
  });

  it("should not show toast for non-rejected actions", () => {
    const action = { type: "some/action" };
    middleware(action);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("should pass all actions through to next middleware", () => {
    const action = { type: "some/action" };
    middleware(action);
    expect(next).toHaveBeenCalledWith(action);
  });
});

describe("makeStore", () => {
  it("forwards preloadedState to configureStore", () => {
    const store = makeStore({
      application: {
        ...applicationSlice.getInitialState(),
        rightbar: {
          ...applicationSlice.getInitialState().rightbar,
          sidebarOpen: true,
        },
      },
    });

    expect(store.getState().application.rightbar.sidebarOpen).toBe(true);
  });
});

describe("renderWithProviders preloadedState", () => {
  function SidebarOpenProbe() {
    const sidebarOpen = useAppSelector((s) => s.application.rightbar.sidebarOpen);
    return <div data-testid="sidebar-open">{String(sidebarOpen)}</div>;
  }

  it("seeds the store rendered by renderWithProviders", () => {
    renderWithProviders(<SidebarOpenProbe />, {
      preloadedState: {
        application: {
          ...applicationSlice.getInitialState(),
          rightbar: {
            ...applicationSlice.getInitialState().rightbar,
            sidebarOpen: true,
          },
        },
      },
    });

    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("true");
  });
});
