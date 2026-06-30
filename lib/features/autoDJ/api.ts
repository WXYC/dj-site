/**
 * Auto-DJ status API slice.
 *
 * The orchestrator is a separate service from Backend-Service, so this slice has
 * its own base query pointed at NEXT_PUBLIC_ORCHESTRATOR_URL, reusing the same
 * better-auth JWT (valid across services that share the JWKS endpoint).
 *
 * Read-only: the status drives a cosmetic greyscale + banner. Activation is done
 * elsewhere (the physical button / a future admin UI), not from this slice.
 */
import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { getJWTToken } from "../authentication/client";
import { getOrchestratorUrl } from "./flags";
import type { AutoDJStatus } from "./types";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${getOrchestratorUrl() ?? ""}/api/auto-dj`,
  prepareHeaders: async (headers) => {
    const token = await getJWTToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

/**
 * The status indicator is purely cosmetic and polled every 10s, so an
 * orchestrator outage / CORS / 401 / timeout must NOT surface as a user-facing
 * toast or PostHog exception (the global `rtkQueryErrorLogger` fires on every
 * rejected query). Swallow errors to `{ data: undefined }` — the UI simply shows
 * no auto-DJ state, exactly like when the feature is disabled.
 */
const orchestratorBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, store, extraOptions) => {
  try {
    const result = await rawBaseQuery(args, store, extraOptions);
    if (result.error) return { data: undefined };
    return result;
  } catch {
    // A thrown error (e.g. a bad/relative base URL when the feature is unset)
    // must also fail silent, not reject.
    return { data: undefined };
  }
};

export const autoDJApi = createApi({
  reducerPath: "autoDJApi",
  baseQuery: orchestratorBaseQuery,
  tagTypes: ["AutoDJStatus"],
  endpoints: (builder) => ({
    getAutoDJStatus: builder.query<AutoDJStatus, void>({
      query: () => "/status",
      providesTags: ["AutoDJStatus"],
    }),
  }),
});

export const { useGetAutoDJStatusQuery } = autoDJApi;
