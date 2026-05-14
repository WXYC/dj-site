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
 * Returning `{ data: undefined }` here makes the calling query succeed with no
 * data. List-shaped queries (e.g. `getRotationTracks`) can fall through their
 * existing empty-state branch; object-shaped queries see `undefined` and can
 * gate UI off `data`. Structured JSON 4xx responses are *not* affected — they
 * still flow through `validateStatus` and surface as normal errors.
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
  const message = `[backendBaseQuery] non-JSON response from ${domain}/${url} (HTTP ${error.originalStatus ?? "?"}); soft-failing.`;
  // eslint-disable-next-line no-console
  console.warn(message, { sample: typeof error.data === "string" ? error.data.slice(0, 200) : error.data });
  // PostHog is the project's wired error sink (see lib/store.ts).
  try {
    posthog.captureException(new Error(message), {
      domain,
      url,
      originalStatus: error.originalStatus,
    });
  } catch {
    // posthog may not be initialized (tests, SSR) — never let logging crash a query.
  }
};

/**
 * Backend base query for RTK Query APIs.
 *
 * Wraps `fetchBaseQuery` with two extras:
 * 1. Adds the JWT bearer token and a request id (in `prepareHeaders`).
 * 2. Soft-handles non-JSON responses (most notably Express's HTML 404s):
 *    the query resolves with `{ data: undefined }` instead of throwing the
 *    cryptic `Unrecognized token '<'` JSON-parse error up to the global
 *    error toast. See WXYC/dj-site#519.
 */
export const backendBaseQuery = (domain: string): BackendBaseQuery => {
  const inner = innerBaseQuery(domain);

  return async (args, api: BaseQueryApi, extraOptions) => {
    const result = await inner(args, api, extraOptions);

    if (result.error && isNonJsonParsingError(result.error)) {
      logNonJsonResponse(domain, args, result.error);
      return { data: undefined, meta: result.meta };
    }

    return result;
  };
};
