import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { authFetch } from "@/lib/features/authentication/client";
import { authErrorMessage } from "@/lib/features/authentication/auth-fetch";
import {
  ClearStationSignupCooldownResult,
  RevealStationPasscodesResult,
  RevokeStationPasscodeResult,
  RotatedStationPasscode,
  StationSignupApiError,
  StationSignupErrorCode,
  StationSignupStatus,
} from "./types";

const STATION_SIGNUP_ADMIN_PREFIX = "/admin/station-signup";

type StationSignupErrorBody = { error?: string; code?: string };

/**
 * Every one of the five operations shares one gate and one error shape
 * (`{ error, code? }`) -- `code` is present only for the two typed 503s
 * (`passcode_key_unset`, `passcode_undecryptable`) and the 409
 * (`passcode_cap_exceeded`); every other failure carries none. `status` is
 * threaded through so the panel can tell 401 (no session) from 403 (signed
 * in, not a manager) apart, which the message text alone does not guarantee.
 */
async function stationSignupAdminRequest<T>(
  path: string,
  init?: { method: "POST"; json?: unknown }
): Promise<{ data: T } | { error: StationSignupApiError }> {
  const { ok, status, data } = await authFetch<T & StationSignupErrorBody>(
    `${STATION_SIGNUP_ADMIN_PREFIX}${path}`,
    init
  );

  if (!ok) {
    return {
      error: {
        message: authErrorMessage(data, `Station signup admin request failed (${status})`),
        status,
        code: (data && typeof data === "object" ? (data as StationSignupErrorBody).code : undefined) as
          | StationSignupErrorCode
          | undefined,
      },
    };
  }

  return { data: data as T };
}

export const stationSignupApi = createApi({
  reducerPath: "stationSignupApi",
  baseQuery: fakeBaseQuery<StationSignupApiError>(),
  tagTypes: ["StationSignupStatus"],
  endpoints: (builder) => ({
    // Writes nothing at all -- safe to poll. Reveal is a separate mutation
    // precisely so this one never has to.
    getStationSignupStatus: builder.query<StationSignupStatus, void>({
      queryFn: async () => stationSignupAdminRequest<StationSignupStatus>("/status"),
      providesTags: ["StationSignupStatus"],
    }),
    // Every reveal WRITES a `passcode_revealed` audit row server-side, so this
    // stays a distinct, explicit mutation rather than folded into the status
    // poll -- see the module comment on `getStationSignupStatus`.
    revealStationPasscodes: builder.mutation<RevealStationPasscodesResult, void>({
      queryFn: async () =>
        stationSignupAdminRequest<RevealStationPasscodesResult>("/reveal", { method: "POST" }),
    }),
    rotateStationPasscode: builder.mutation<RotatedStationPasscode, void>({
      queryFn: async () =>
        stationSignupAdminRequest<RotatedStationPasscode>("/rotate", { method: "POST" }),
      invalidatesTags: ["StationSignupStatus"],
    }),
    revokeStationPasscode: builder.mutation<RevokeStationPasscodeResult, { passcodeId: string }>({
      queryFn: async (args) =>
        stationSignupAdminRequest<RevokeStationPasscodeResult>("/revoke", { method: "POST", json: args }),
      invalidatesTags: ["StationSignupStatus"],
    }),
    // The anti-lockout escape hatch. Never deletes the attempt log it clears
    // against -- see the backend's own comment on `clearSignupCooldown`.
    clearStationSignupCooldown: builder.mutation<ClearStationSignupCooldownResult, void>({
      queryFn: async () =>
        stationSignupAdminRequest<ClearStationSignupCooldownResult>("/clear-cooldown", { method: "POST" }),
      invalidatesTags: ["StationSignupStatus"],
    }),
  }),
});

export const {
  useGetStationSignupStatusQuery,
  useRevealStationPasscodesMutation,
  useRotateStationPasscodeMutation,
  useRevokeStationPasscodeMutation,
  useClearStationSignupCooldownMutation,
} = stationSignupApi;
