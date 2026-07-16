import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
} from "@reduxjs/toolkit/query";

type ProxyBaseQuery = BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  Record<string, unknown>,
  FetchBaseQueryMeta
>;

type Validators = {
  etag?: string;
  lastModified?: string;
  // The prior response body, kept beside its validators so a 304 can restore
  // the cache entry without a re-decode, and so both evict together — sending
  // If-None-Match while lacking a body to return on 304 would strand the entry.
  body: unknown;
};

const isEmpty = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim().length === 0;

/**
 * Wrap a `fetchBaseQuery`-derived base query with HTTP conditional-GET
 * revalidation. On a repeat fetch of the same RTK Query cache key it forwards
 * the prior response's `ETag` / `Last-Modified` as `If-None-Match` /
 * `If-Modified-Since`; a `304 Not Modified` then restores the cached body
 * without re-parsing.
 *
 * The validator store is a plain module-level map keyed by `queryCacheKey`, not
 * part of the Redux cache entry — no `redux-persist` or entry-shape coupling.
 * It never gates cache validity: absent headers degrade to an ordinary fetch,
 * so endpoints outside the Backend conditional-GET contract are unaffected.
 */
export const withConditionalGet = (baseQuery: ProxyBaseQuery): ProxyBaseQuery => {
  const store = new Map<string, Validators>();

  return async (args, api: BaseQueryApi, extraOptions) => {
    const cacheKey = api.queryCacheKey;
    const cached = cacheKey !== undefined ? store.get(cacheKey) : undefined;

    const requestArgs =
      cached === undefined ? args : withConditionalHeaders(args, cached);

    const result = await baseQuery(requestArgs, api, extraOptions);

    const status = result.meta?.response?.status;

    if (status === 304 && cached !== undefined) {
      return { data: cached.body, meta: result.meta };
    }

    if (cacheKey !== undefined && result.data !== undefined && status === 200) {
      const headers = result.meta?.response?.headers;
      const etag = headers?.get("etag") ?? undefined;
      const lastModified = headers?.get("last-modified") ?? undefined;
      if (!isEmpty(etag) || !isEmpty(lastModified)) {
        store.set(cacheKey, { etag, lastModified, body: result.data });
      } else {
        // Resource stopped advertising validators — drop any stale entry so a
        // later fetch doesn't send a conditional header the server won't honor.
        store.delete(cacheKey);
      }
    }

    return result;
  };
};

/**
 * `If-None-Match` takes precedence over `If-Modified-Since` when both are
 * available (RFC 9111 §4.3.2), so only one is sent.
 */
const withConditionalHeaders = (
  args: string | FetchArgs,
  validators: Validators
): FetchArgs => {
  const base: FetchArgs = typeof args === "string" ? { url: args } : { ...args };
  const headers = new Headers(base.headers as HeadersInit | undefined);

  if (!isEmpty(validators.etag)) {
    headers.set("If-None-Match", validators.etag as string);
  } else if (!isEmpty(validators.lastModified)) {
    headers.set("If-Modified-Since", validators.lastModified as string);
  }

  base.headers = headers;
  return base;
};
