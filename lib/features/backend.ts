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
import { redactEmails } from "../redact";

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

type NonJsonParsingError = FetchBaseQueryError & {
  status: "PARSING_ERROR";
  originalStatus: number;
  data: string;
  error: string;
};

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
): error is NonJsonParsingError =>
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
 * A PARSING_ERROR produced by the client's own cancellation rather than by
 * anything the origin sent. `fetchBaseQuery` passes `api.signal` into the
 * `Request`, so a request superseded mid-body-read has the body torn out from
 * under it: `response.text()` rejects with a DOMException named `AbortError`,
 * which `fetchBaseQuery` stringifies through `String(e)` into this same
 * PARSING_ERROR shape. `status` and `originalStatus` are then identical to a
 * genuinely unparseable body's, so this field is the only discriminator.
 *
 * Named apart from `session-cache.ts`'s own abort predicate, which duck-types
 * the raw DOMException rather than RTK's error envelope.
 */
const isAbortedQueryError = (error: NonJsonParsingError): boolean =>
  error.error.startsWith("AbortError");

/**
 * Re-issue the same request unconditionally (`cache: "reload"` drops the
 * conditional headers), so the origin must answer 200 with a full body.
 */
const withReload = (args: string | FetchArgs): FetchArgs =>
  typeof args === "string"
    ? { url: args, cache: "reload" }
    : { ...args, cache: "reload" };

// Enough of the body to recognize what the origin actually sent (a gateway
// page, a truncated payload) without shipping the whole thing to telemetry.
const BODY_SAMPLE_LENGTH = 200;

const logNonJsonResponse = (
  domain: string,
  args: string | FetchArgs,
  error: NonJsonParsingError
) => {
  const url = typeof args === "string" ? args : args.url;
  const params = typeof args === "string" ? undefined : args.params;
  // RTK's `joinUrls` strips the boundary slashes before joining, so a naive
  // `${domain}/${url}` doubles a slash the request itself never sent.
  const path = `${domain}/${url.replace(/^\//, "")}`;
  const message = `[backendBaseQuery] non-JSON response from ${path} (HTTP ${error.originalStatus}); soft-failing.`;
  const sample = error.data.slice(0, BODY_SAMPLE_LENGTH);
  console.warn(message, { sample, params });
  // Both sinks receive this (see lib/error-reporting.ts). The underlying
  // exception and a body sample are what name the failure — a gateway's HTML
  // and a truncated payload are one status code and two different problems —
  // so without them the event cannot be diagnosed without a live reproduction.
  //
  // They travel nested because `splitContext` indexes every string-valued
  // entry as a Sentry tag, and a parser message carries a byte offset while a
  // sample carries the body: neither is worth a tag value. `extra` is also the
  // one field no adapter scrubs on the way out, hence the redaction here.
  safeCaptureException(new Error(message), {
    domain,
    url,
    params,
    originalStatus: error.originalStatus,
    response: {
      error: redactEmails(error.error),
      sample: redactEmails(sample),
    },
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
 * That opt-out never covers a request the client itself cancelled. A superseded
 * result was always going to be discarded, so surfacing one would put an error
 * in front of a DJ for a request that told us nothing about the backend — on
 * a search screen, potentially on every re-key and every navigation away.
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
 * opt out per-endpoint via `extraOptions: { surfaceNonJsonAsError: true }`.
 */
export const backendBaseQuery = (domain: string): BackendBaseQuery => {
  const inner = innerBaseQuery(domain);

  return async (args, api: BaseQueryApi, extraOptions) => {
    const result = await inner(args, api, extraOptions);
    const isGet = isGetRequest(args);

    // Watermarked routes send two validators (a watermark Last-Modified and
    // Express's per-body weak ETag) and no Cache-Control, so a dual-validator
    // revalidation can surface an unspliced 304 with an empty body. An empty
    // revalidation body must never overwrite populated cache: a GET's 304
    // always came from the transport (browser HTTP cache) — no app code sets
    // conditional validator headers — so retry once unconditionally to get a
    // full 200. If that retry also errors, let it propagate — RTK keeps the
    // last-good data on a rejected refetch — so a 304 can never collapse to
    // the { data: null } soft-fail below.
    if (result.error && isNotModified(result.error) && isGet) {
      return inner(withReload(args), api, extraOptions);
    }

    if (result.error && isNonJsonParsingError(result.error) && isGet) {
      const aborted = isAbortedQueryError(result.error);
      const surfaceAsError =
        (extraOptions as BackendExtraOptions | undefined)?.surfaceNonJsonAsError === true &&
        !aborted;
      if (!surfaceAsError) {
        // An abort is not reported: it says nothing about the backend, and it
        // would file real brokenness inside a benign issue, since every event
        // this function raises shares one message and so one fingerprint.
        if (!aborted) logNonJsonResponse(domain, args, result.error);
        return { data: null, meta: result.meta };
      }
    }

    return result;
  };
};
