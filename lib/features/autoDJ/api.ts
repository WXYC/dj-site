/**
 * Auto-DJ status API slice.
 *
 * The orchestrator is a separate service from Backend-Service, so this slice has
 * its own base query pointed at NEXT_PUBLIC_ORCHESTRATOR_URL, reusing the same
 * better-auth JWT (valid across services that share the JWKS endpoint).
 */
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getJWTToken } from "../authentication/client";
import { getOrchestratorUrl } from "./flags";
import type { AutoDJDeactivateResponse, AutoDJStatus } from "./types";

const orchestratorBaseQuery = fetchBaseQuery({
  baseUrl: `${getOrchestratorUrl() ?? ""}/api/auto-dj`,
  prepareHeaders: async (headers) => {
    const token = await getJWTToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

export const autoDJApi = createApi({
  reducerPath: "autoDJApi",
  baseQuery: orchestratorBaseQuery,
  tagTypes: ["AutoDJStatus"],
  endpoints: (builder) => ({
    getAutoDJStatus: builder.query<AutoDJStatus, void>({
      query: () => "/status",
      providesTags: ["AutoDJStatus"],
    }),
    activateAutoDJ: builder.mutation<AutoDJStatus, void>({
      query: () => ({ url: "/activate", method: "POST" }),
      invalidatesTags: ["AutoDJStatus"],
    }),
    deactivateAutoDJ: builder.mutation<AutoDJDeactivateResponse, void>({
      query: () => ({ url: "/deactivate", method: "POST" }),
      invalidatesTags: ["AutoDJStatus"],
    }),
  }),
});

export const {
  useGetAutoDJStatusQuery,
  useActivateAutoDJMutation,
  useDeactivateAutoDJMutation,
} = autoDJApi;
