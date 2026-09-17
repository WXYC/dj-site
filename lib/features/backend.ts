import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
} from "@reduxjs/toolkit/query";
import { fetchBaseQuery } from "@reduxjs/toolkit/query";
import { getJWTToken } from "./authentication/client";
import { safeCaptureException } from "../error-reporting";

type BackendBaseQuery = BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  Record<string, unknown>,
  FetchBaseQueryMeta
>;

const innerBaseQuery = (domain: string): BackendBaseQuery =>
  fetchBaseQuery({
    baseUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/${domain}`,
    prepareHeaders: async (headers) => {
      headers.set("Content-Type", "application/json");
      headers.set("X-Request-Id", crypto.randomUUID());

      const token = await getJWTToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  });

/**
 * Detect a response body that the JSON `responseHandler` couldn't parse.
 *
 * RTK Query surfaces these as `PARSING_ERROR` from `fetchBaseQuery`. The most
 * common producer is a backend route returning Express's default 404 HTML
 * (`<!DOCTYPE html>…`), which the frontend then tries to `JSON.parse` and the
 * resulting `SyntaxError: Unrecognized token '<'` bubbles up as a useless
 * global toast (see WXYC/dj-site#519).
 *
 * Returning `{ data: null }` here makes the calling query succeed with an
 * empty payload instead of surfacing PARSING_ERROR as a global toast (#519).
 * We use `null` (not `undefined`) so hook consumers can treat a completed
 * soft-fail with nullish checks (`?? []`, `!data`) without conflating it
 * with RTK's in-flight `undefined`. Avoid strict `data === undefined`
 * guards on GET results — they miss soft-failed `null` (#606). Endpoints
 * whose `transformResponse` assumes a parsed body must still guard nullish
 * input. Structured JSON 4xx responses are *not* affected — they still
 * flow through `validateStatus` and surface as normal errors.
 */
const isNonJsonParsingError = (
  error: FetchBaseQueryError
): error is FetchBaseQueryError & {
  status: "PARSING_ERROR";
  originalStatus: number;
  data: string;
  error: string;
} =>
  error.status === "PARSING_ERROR" &&
  (error as { originalStatus?: number }).originalStatus !== 304;

/**
 * A revalidation that reaches `fetchBaseQuery` as a raw 304. Two shapes: an
 * empty body surfaces as a numeric `status: 304`; a body the origin spliced in
 * surfaces as `PARSING_ERROR` carrying `originalStatus: 304`.
 */
const isNotModified = (error: FetchBaseQueryError): boolean =>
  error.status === 304 ||
  (error.status === "PARSING_ERROR" &&
    (error as { originalStatus?: number }).originalStatus === 304);

/**
 * A PARSING_ERROR produced by the client's own cancellation, not by anything
 * the origin sent. `fetchBaseQuery` passes `api.signal` into the `Request`, so
 * an endpoint whose subscriber count drops mid-flight (`keepUnusedDataFor: 0`
 * dropping a superseded page on re-key, or the screen unmounting) has its
 * response body torn out from under it: `response.text()` rejects with a
 * DOMException named `AbortError`, which `fetchBaseQuery` stringifies into
 * `error.error` via `String(e)` before folding it into the same PARSING_ERROR
 * shape a genuinely unparseable body produces. The two are indistinguishable
 * by `status`/`originalStatus` alone — only this field tells them apart.
 *
 * A superseded request's result was always going to be discarded, so it must
 * stay silent even for an endpoint that otherwise wants every non-JSON body to
 * fail loud (`surfaceNonJsonAsError`) — the abort carries no information about
 * the backend at all, and surfacing it would flash an error banner in front of
 * a DJ on every keystroke or navigation away from a search screen.
 */
const isAbortError = (error: { error?: string }): boolean =>
  typeof error.error === "string" && error.error.startsWith("AbortError");

/**
 * Re-issue the same request unconditionally (`cache: "reload"` drops the
 * conditional headers), so the origin must answer 200 with a full body.
 */
const withReload = (args: string | FetchArgs): FetchArgs =>
  typeof args === "string"
    ? { url: args, cache: "reload" }
    : { ...args, cache: "reload" };

/**
 * Joins `domain` and `url` the way the request itself does (RTK's `joinUrls`
 * strips the boundary slashes before joining) rather than naively
 * interpolating `${domain}/${url}`, which doubles the slash whenever `url`
 * already carries its own leading one — as every `FetchArgs.url` here does.
 * Log-string legibility only; the request URL was never affected.
 */
const joinForLog = (domain: string, url: string | undefined): string => {
  if (!url) return domain;
  return `${domain.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
};

const logNonJsonResponse = (
  domain: string,
  args: string | FetchArgs,
  error: FetchBaseQueryError & {
    originalStatus?: number;
    data?: unknown;
    error?: string;
  }
) => {
  const url = typeof args === "string" ? args : args.url;
  const params = typeof args === "string" ? undefined : args.params;
  const message = `[backendBaseQuery] non-JSON response from ${joinForLog(domain, url)} (HTTP ${error.originalStatus ?? "?"}); soft-failing.`;
  const sample = typeof error.data === "string" ? error.data.slice(0, 200) : error.data;
  console.warn(message, { sample, params });
  // PostHog is the project's wired error sink (see lib/store.ts). `error` and
  // `data` are what actually distinguish a benign abort from a genuinely
  // broken body (see `isAbortError`) — without them this event cannot be
  // diagnosed without a live reproduction.
  safeCaptureException(new Error(message), {
    domain,
    url,
    params,
    originalStatus: error.originalStatus,
    error: error.error,
    data: sample,
  });
};

/**
 * RTK Query passes `extraOptions` through from each endpoint definition. We
 * use it as the opt-OUT knob for the non-JSON soft-handle path: a GET endpoint
 * that *requires* loud failure on PARSING_ERROR can set
 * `extraOptions: { surfaceNonJsonAsError: true }` in its `builder.query(...)`
 * definition. Default behavior (soft-handle) is the right policy for the
 * common case — list-shaped queries hitting a not-yet-shipped backend route
 * should fall through to their empty-state branch, not nuke the UI with a
 * toast.
 *
 * The opt-out is never absolute: `isAbortError` overrides it. A superseded
 * request tells you nothing about the backend, so even an endpoint that opted
 * into loud failure must not surface one.
 */
type BackendExtraOptions = {
  surfaceNonJsonAsError?: boolean;
};

/**
 * fetchBaseQuery treats a string `args` as `GET <url>`; an object `args` with
 * no `method` defaults to GET too. Only when `method` is explicitly set to
 * something else is the request a mutation. Lower-casing first defends against
 * an accidental `Method: 'post'` typo.
 */
const isGetRequest = (args: string | FetchArgs): boolean => {
  if (typeof args === "string") return true;
  const method = args.method;
  if (method === undefined) return true;
  return method.toUpperCase() === "GET";
};

/**
 * Backend base query for RTK Query APIs.
 *
 * Wraps `fetchBaseQuery` with two extras:
 * 1. Adds the JWT bearer token and a request id (in `prepareHeaders`).
 * 2. Soft-handles non-JSON responses (most notably Express's HTML 404s)
 *    **for GET requests by default**: the query resolves with
 *    `{ data: null }` (hook `data` may be `null` even when the endpoint
 *    type is `T | undefined`) instead of throwing the cryptic
 *    `Unrecognized token '<'` JSON-parse error up to the global error toast.
 *    See WXYC/dj-site#519 and #606.
 *
 * Mutations (POST/PATCH/DELETE/PUT) **never** get the soft-handle treatment —
 * a silently-"succeeding" `addToFlowsheet` or `addAlbum` is a worse UX than a
 * confusing toast. A GET endpoint that wants the loud behavior anyway can
 * opt out per-endpoint via `extraOptions: { surfaceNonJsonAsError: true }` —
 * except for an aborted request, which stays silent regardless (`isAbortError`).
 */
export const backendBaseQuery = (domain: string): BackendBaseQuery => {
  const inner = innerBaseQuery(domain);

  return async (args, api: BaseQueryApi, extraOptions) => {
    const result = await inner(args, api, extraOptions);

    // Watermarked routes send two validators (a watermark Last-Modified and
    // Express's per-body weak ETag) and no Cache-Control, so a dual-validator
    // revalidation can surface an unspliced 304 with an empty body. An empty
    // revalidation body must never overwrite populated cache: a GET's 304
    // always came from the transport (browser HTTP cache) — no app code sets
    // conditional validator headers — so retry once unconditionally to get a
    // full 200. If that retry also errors, let it propagate — RTK keeps the
    // last-good data on a rejected refetch — so a 304 can never collapse to
    // the { data: null } soft-fail below.
    if (result.error && isNotModified(result.error) && isGetRequest(args)) {
      return inner(withReload(args), api, extraOptions);
    }

    if (result.error && isNonJsonParsingError(result.error) && isGetRequest(args)) {
      const optOut = (extraOptions as BackendExtraOptions | undefined)?.surfaceNonJsonAsError === true;
      if (!optOut || isAbortError(result.error)) {
        logNonJsonResponse(domain, args, result.error);
        return { data: null, meta: result.meta };
      }
    }

    return result;
  };
};
