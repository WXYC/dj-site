import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import {
  isUnmessagedHttpError,
  isUnmessagedRejection,
  rtkQueryErrorLogger,
} from "@/lib/rtk-query-error-logger";
import { toast } from "sonner";

const mockToastError = toast.error as ReturnType<typeof vi.fn>;

/** The generic message a caller raises when nothing else names the failure. */
const FALLBACK = "Failed to update album";

const SERVER_MESSAGE = "Artist is not catalogued in the selected genre";
const PARSE_FAILURE =
  "SyntaxError: Unexpected token '<', \"<html><bod\"... is not valid JSON";

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
 * Every shape `.unwrap()` can throw, and what a user is shown for it. `err` is
 * the value the caller's `catch` receives; `reachesMiddleware` is whether RTK
 * flags the action `rejectedWithValue` (a `SerializedError` — thrown when a
 * `transformResponse` throws or the request aborts — is not flagged, so the
 * middleware never runs for it); `toasts` is every message raised for a caller
 * that gates its fallback on `isUnmessagedRejection`, in order.
 */
const SHAPES: {
  name: string;
  err: unknown;
  reachesMiddleware: boolean;
  toasts: string[];
  unmessagedRejection: boolean;
  unmessagedHttpError: boolean;
}[] = [
  {
    name: "HTTP error carrying the server's own reason",
    err: { status: 400, data: { message: SERVER_MESSAGE } },
    reachesMiddleware: true,
    // The caller stays quiet: a generic second toast would bury the reason.
    toasts: [SERVER_MESSAGE],
    unmessagedRejection: false,
    unmessagedHttpError: false,
  },
  {
    name: "HTTP error with no message in the body",
    err: { status: 500, data: { error: "rejected" } },
    reachesMiddleware: true,
    toasts: [FALLBACK],
    unmessagedRejection: true,
    unmessagedHttpError: true,
  },
  {
    name: "PARSING_ERROR from an HTML body",
    err: {
      status: "PARSING_ERROR",
      originalStatus: 404,
      data: "<!DOCTYPE html><html><body>Cannot PATCH /library/4242</body></html>",
      error: PARSE_FAILURE,
    },
    reachesMiddleware: true,
    // The middleware's own toast is the raw parse failure, which names neither
    // the operation nor anything the user can act on.
    toasts: [PARSE_FAILURE, FALLBACK],
    unmessagedRejection: true,
    unmessagedHttpError: false,
  },
  {
    name: "FETCH_ERROR",
    err: { status: "FETCH_ERROR", error: "TypeError: Failed to fetch" },
    reachesMiddleware: true,
    toasts: ["Network error — please check your connection.", FALLBACK],
    unmessagedRejection: true,
    unmessagedHttpError: false,
  },
  {
    name: "TIMEOUT_ERROR",
    err: { status: "TIMEOUT_ERROR", error: "AbortError: The user aborted a request." },
    reachesMiddleware: true,
    toasts: ["Request timed out — please try again.", FALLBACK],
    unmessagedRejection: true,
    unmessagedHttpError: false,
  },
  {
    name: "SerializedError thrown by a transformResponse",
    err: {
      name: "TypeError",
      message: "Cannot use 'in' operator to search for 'id' in null",
      stack: "TypeError: Cannot use 'in' operator…",
    },
    reachesMiddleware: false,
    toasts: [FALLBACK],
    unmessagedRejection: true,
    unmessagedHttpError: false,
  },
];

describe("rejection-shape gates", () => {
  const next = vi.fn((action: unknown) => action);
  const api = { dispatch: vi.fn(), getState: vi.fn() };
  const middleware = rtkQueryErrorLogger(api)(next);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A control whose fallback is the only message naming what failed must end up
  // with at least one plain-language toast in every shape, and must never add a
  // vaguer one on top of a reason the server supplied.
  it.each(SHAPES)("$name", ({ err, reachesMiddleware, toasts }) => {
    middleware(rejectedAction(err, { withValue: reachesMiddleware }));
    if (isUnmessagedRejection(err)) {
      toast.error(FALLBACK);
    }

    expect(mockToastError.mock.calls.map(([message]) => message)).toEqual(toasts);
  });

  it.each(SHAPES)("$name — isUnmessagedRejection", ({ err, unmessagedRejection }) => {
    expect(isUnmessagedRejection(err)).toBe(unmessagedRejection);
  });

  // The narrow gate answers only "HTTP error with no body message", so it is
  // false for every transport-level and non-HTTP rejection. A caller gating a
  // sole fallback on it goes silent exactly where the middleware's own toast is
  // unusable or absent.
  it.each(SHAPES)("$name — isUnmessagedHttpError", ({ err, unmessagedHttpError }) => {
    expect(isUnmessagedHttpError(err)).toBe(unmessagedHttpError);
  });

  it.each([
    ["a whitespace-only server message", { status: 409, data: { message: "   " } }],
    ["a non-string server message", { status: 409, data: { message: 42 } }],
    ["a string body", { status: 502, data: "Bad Gateway" }],
    ["no body at all", { status: 503 }],
  ])("treats %s as unmessaged", (_case, err) => {
    expect(isUnmessagedRejection(err)).toBe(true);
    expect(isUnmessagedHttpError(err)).toBe(true);
  });

  it.each([
    ["a thrown string", "boom"],
    ["undefined", undefined],
  ])("treats %s as unmessaged but not as an HTTP error", (_case, err) => {
    expect(isUnmessagedRejection(err)).toBe(true);
    expect(isUnmessagedHttpError(err)).toBe(false);
  });
});
