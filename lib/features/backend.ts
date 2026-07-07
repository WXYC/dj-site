import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
} from "@reduxjs/toolkit/query";
import { fetchBaseQuery } from "@reduxjs/toolkit/query";
import { getJWTToken } from "./authentication/client";
import { posthog } from "../posthog";

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

      // Get JWT token from better-auth /token endpoint
      const token = await getJWTToken();

      if (token) {
        // Use Bearer format for better-auth JWT tokens
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
} => error.status === "PARSING_ERROR";

const logNonJsonResponse = (
  domain: string,
  args: string | FetchArgs,
  error: FetchBaseQueryError & { originalStatus?: number; data?: unknown }
) => {
  const url = typeof args === "string" ? args : args.url;
  const params = typeof args === "string" ? undefined : args.params;
  const message = `[backendBaseQuery] non-JSON response from ${domain}/${url} (HTTP ${error.originalStatus ?? "?"}); soft-failing.`;
  console.warn(message, {
    sample: typeof error.data === "string" ? error.data.slice(0, 200) : error.data,
    params,
  });
  // PostHog is the project's wired error sink (see lib/store.ts).
  try {
    posthog.captureException(new Error(message), {
      domain,
      url,
      params,
      originalStatus: error.originalStatus,
    });
  } catch {
    // posthog may not be initialized (tests, SSR) — never let logging crash a query.
  }
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

    if (result.error && isNonJsonParsingError(result.error)) {
      const optOut = (extraOptions as BackendExtraOptions | undefined)?.surfaceNonJsonAsError === true;
      if (isGetRequest(args) && !optOut) {
        logNonJsonResponse(domain, args, result.error);
        return { data: null, meta: result.meta };
      }
    }

    return result;
  };
};
