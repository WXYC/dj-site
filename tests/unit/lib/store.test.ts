import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { rtkQueryErrorLogger } from "@/lib/store";
import { toast } from "sonner";

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
