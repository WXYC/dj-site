import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeCaptureException } from "@/lib/posthog";
import { onRequestError, register } from "@/instrumentation";

vi.mock("@/lib/posthog", () => ({
  safeCaptureException: vi.fn(),
}));

const request = {
  path: "/dashboard/flowsheet",
  method: "GET",
  headers: {},
} as const;

const context = {
  routerKind: "App Router",
  routePath: "/dashboard/flowsheet",
  routeType: "render",
  revalidateReason: undefined,
} as const;

describe("instrumentation.onRequestError", () => {
  beforeEach(() => {
    vi.mocked(safeCaptureException).mockClear();
  });

  it("forwards the error to safeCaptureException tagged with request/router context", () => {
    const err = new Error("server component blew up");
    onRequestError(err, request, context);

    expect(safeCaptureException).toHaveBeenCalledTimes(1);
    expect(safeCaptureException).toHaveBeenCalledWith(err, {
      path: "/dashboard/flowsheet",
      routerKind: "App Router",
      routeType: "render",
      routePath: "/dashboard/flowsheet",
    });
  });

  it("register is a no-op that does not throw", () => {
    expect(() => register()).not.toThrow();
  });
});
