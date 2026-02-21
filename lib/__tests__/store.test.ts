import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRejectedWithValue } from "@reduxjs/toolkit";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { rtkQueryErrorLogger } from "@/lib/store";
import { toast } from "sonner";

describe("rtkQueryErrorLogger (Bug 29)", () => {
  const next = vi.fn((action: unknown) => action);
  const api = { dispatch: vi.fn(), getState: vi.fn() };
  const middleware = rtkQueryErrorLogger(api)(next);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show toast for server errors with data.message", () => {
    const action = {
      type: "api/executeMutation/rejected",
      meta: { rejectedWithValue: true },
      payload: { data: { message: "Session expired" } },
    };
    Object.defineProperty(action, "type", { value: action.type });
    (isRejectedWithValue as any)(action);

    middleware(action);

    if ((action as any).meta?.rejectedWithValue) {
      const message = (action as any).payload?.data?.message;
      if (message) {
        expect(toast.error).toHaveBeenCalledWith("Session expired");
        return;
      }
    }
  });

  it("should show toast for network errors (FETCH_ERROR)", () => {
    const action = {
      type: "api/executeMutation/rejected",
      meta: { rejectedWithValue: true },
      payload: {
        status: "FETCH_ERROR",
        error: "TypeError: Failed to fetch",
      },
    };

    middleware(action);

    expect(toast.error).toHaveBeenCalled();
  });

  it("should show toast for timeout errors", () => {
    const action = {
      type: "api/executeQuery/rejected",
      meta: { rejectedWithValue: true },
      payload: {
        status: "TIMEOUT_ERROR",
        error: "Request timed out",
      },
    };

    middleware(action);

    expect(toast.error).toHaveBeenCalled();
  });

  it("should pass actions through to next middleware", () => {
    const action = { type: "some/action" };
    middleware(action);
    expect(next).toHaveBeenCalledWith(action);
  });
});
