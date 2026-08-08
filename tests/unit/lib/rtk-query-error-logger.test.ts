import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import {
  isUnmessagedHttpError,
  rtkQueryErrorLogger,
} from "@/lib/rtk-query-error-logger";
import { toast } from "sonner";

const mockToastError = toast.error as ReturnType<typeof vi.fn>;

/** The generic message a caller raises when nothing else names the failure. */
const FALLBACK = "Failed to update album";

const SERVER_MESSAGE = "Artist is not catalogued in the selected genre";

function rejectedAction(payload: unknown, { withValue = true } = {}) {
  return {
    type: "catalogApi/executeMutation/rejected",
    payload: withValue ? payload : undefined,
    error: withValue ? undefined : payload,
    meta: {
      rejectedWithValue: withValue,
      requestId: "test-req",
      requestStatus: "rejected" as const,
      aborted: false,
      condition: false,
      arg: { endpointName: "updateAlbum" },
    },
  };
}

/**
 * Every shape `.unwrap()` can throw. `err` is the value the caller's `catch`
 * receives; `reachesMiddleware` is whether RTK flags the action
 * `rejectedWithValue` (a `SerializedError` — thrown when a `transformResponse`
 * throws or the request aborts — is not flagged, so the middleware never runs
 * for it); `toastCount` is how many messages the middleware raises on its own;
 * `callerSpeaks` is whether a caller gating on `isUnmessagedHttpError` adds
 * one. Exactly one of the two must be non-zero: a shape the middleware can
 * describe must not be talked over, and a shape it cannot must not be silent.
 */
const SHAPES: {
  name: string;
  err: unknown;
  reachesMiddleware: boolean;
  middlewareToasts: string[];
  callerSpeaks: boolean;
}[] = [
  {
    name: "HTTP error carrying the server's own reason",
    err: { status: 400, data: { message: SERVER_MESSAGE } },
    reachesMiddleware: true,
    middlewareToasts: [SERVER_MESSAGE],
    callerSpeaks: false,
  },
  {
    name: "HTTP error with no message in the body",
    err: { status: 500, data: { error: "rejected" } },
    reachesMiddleware: true,
    middlewareToasts: [],
    callerSpeaks: true,
  },
  {
    name: "FETCH_ERROR",
    err: { status: "FETCH_ERROR", error: "TypeError: Failed to fetch" },
    reachesMiddleware: true,
    middlewareToasts: ["Network error — please check your connection."],
    callerSpeaks: false,
  },
  {
    name: "TIMEOUT_ERROR",
    err: { status: "TIMEOUT_ERROR", error: "AbortError: The user aborted a request." },
    reachesMiddleware: true,
    middlewareToasts: ["Request timed out — please try again."],
    callerSpeaks: false,
  },
  {
    name: "SerializedError thrown by a transformResponse",
    err: {
      name: "TypeError",
      message: "Cannot use 'in' operator to search for 'id' in null",
      stack: "TypeError: Cannot use 'in' operator…",
    },
    reachesMiddleware: false,
    middlewareToasts: [],
    callerSpeaks: true,
  },
  {
    // RTK's own documented `rejectWithValue(payload)` shape for a bare
    // string error — no `status` at all, unlike every other shape above.
    // The middleware's `error`-string branch fires on this regardless of
    // `status`, so a predicate that reads "no `status`" as "middleware said
    // nothing" doubles the toast.
    name: "no-status rejectWithValue payload carrying only `error`",
    err: { error: "Oh no!" },
    reachesMiddleware: true,
    middlewareToasts: ["Oh no!"],
    callerSpeaks: false,
  },
];

describe("rejection-shape gate", () => {
  const next = vi.fn((action: unknown) => action);
  const api = { dispatch: vi.fn(), getState: vi.fn() };
  const middleware = rtkQueryErrorLogger(api)(next);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(SHAPES)(
    "$name leaves the user exactly one message",
    ({ err, reachesMiddleware, middlewareToasts, callerSpeaks }) => {
      middleware(rejectedAction(err, { withValue: reachesMiddleware }));
      expect(mockToastError.mock.calls.map(([message]) => message)).toEqual(
        middlewareToasts,
      );

      if (isUnmessagedHttpError(err)) {
        toast.error(FALLBACK);
      }

      expect(mockToastError.mock.calls.map(([message]) => message)).toEqual(
        callerSpeaks ? [...middlewareToasts, FALLBACK] : middlewareToasts,
      );
    },
  );

  it.each(SHAPES)("$name — gate", ({ err, callerSpeaks }) => {
    expect(isUnmessagedHttpError(err)).toBe(callerSpeaks);
  });

  // A `PARSING_ERROR` is a mutation answered with a body that isn't JSON — a
  // gateway's HTML error page, or a route that isn't there. The middleware
  // owns a plain-language line for it, so the caller keeps out of it.
  it("leaves a PARSING_ERROR to the middleware", () => {
    expect(
      isUnmessagedHttpError({
        status: "PARSING_ERROR",
        originalStatus: 404,
        data: "<!DOCTYPE html><html><body>Cannot PATCH /library/4242</body></html>",
        error: "SyntaxError: Unexpected token '<'",
      }),
    ).toBe(false);
  });

  it.each([
    ["a whitespace-only server message", { status: 409, data: { message: "   " } }],
    ["a non-string server message", { status: 409, data: { message: 42 } }],
    ["a string body", { status: 502, data: "Bad Gateway" }],
    ["no body at all", { status: 503 }],
    ["a thrown string", "boom"],
    ["undefined", undefined],
  ])("makes the caller speak for %s", (_case, err) => {
    expect(isUnmessagedHttpError(err)).toBe(true);
  });
});
