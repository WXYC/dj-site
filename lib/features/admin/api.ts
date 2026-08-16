import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { authClient, authFetch } from "@/lib/features/authentication/client";
import { authErrorMessage } from "@/lib/features/authentication/auth-fetch";
import { resolveOrganizationIdAdmin } from "@/lib/features/authentication/organization-utils";
import { throwIfBetterAuthError } from "@/src/utilities/throwIfBetterAuthError";
import { adminSlice } from "./frontend";
import { BetterAuthUser, convertBetterAuthToAccountResult } from "./conversions-better-auth";
import { Account, MEMBER_PAGE_SIZE, ROSTER_PAGE_SIZE } from "./types";

/**
 * `organizationSlug` must be threaded down from the roster page's server-side
 * read of NEXT_PUBLIC_APP_ORGANIZATION. That variable is not inlined into
 * client bundles, so this queryFn — which runs in the browser — cannot read it
 * from the environment itself.
 */
type RosterArgs = { search: string; page: number; organizationSlug: string };
type RosterResult = { accounts: Account[]; total: number };

type ProvisionUserArgs = {
  email: string;
  username: string;
  name: string;
  organizationSlug: string;
  role: string;
  realName?: string;
  djName?: string;
};

type ProvisionUserResult = {
  emailSent?: boolean;
  emailError?: string;
};

/**
 * better-auth's SDK parser (betterJSONParse, strict:false) can hand back the
 * raw JSON string instead of a parsed object.
 */
function parseSdkPayload<T>(data: unknown, label: string): T | undefined {
  if (typeof data === "string") {
    console.warn(`[roster] better-auth returned unparsed JSON for ${label}; parsing manually`);
    return JSON.parse(data) as T;
  }
  return (data ?? undefined) as T | undefined;
}

/** Normalize a rejected provisionUser mutation into a user-facing message. */
export function provisionErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Failed to create account";
}

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fakeBaseQuery<{ message: string }>(),
  tagTypes: ["Roster"],
  endpoints: (builder) => ({
    getRoster: builder.query<RosterResult, RosterArgs>({
      queryFn: async ({ search, page, organizationSlug }) => {
        try {
          // A DJ's or music director's role lives only on their organization
          // membership: provisioning mirrors nothing but stationManager into
          // the better-auth user row, so user.role reads as "user" for them.
          // Resolve the membership before listing anyone — rendering the roster
          // without it would silently label every DJ a Member.
          const organizationId = await resolveOrganizationIdAdmin(organizationSlug);
          if (!organizationId) {
            throw new Error(
              "Could not resolve the station organization, so account roles are unavailable."
            );
          }

          const query: Record<string, unknown> = {
            limit: ROSTER_PAGE_SIZE,
            offset: page * ROSTER_PAGE_SIZE,
            filterField: "isAnonymous",
            filterValue: "false",
            filterOperator: "eq",
          };
          if (search.length > 0) {
            query.searchValue = search;
            query.searchField = "name";
            query.searchOperator = "contains";
          }

          const result = await authClient.admin.listUsers({ query });
          throwIfBetterAuthError(result, "Failed to fetch users");

          const parsed = parseSdkPayload<{ users?: unknown[]; total?: number }>(
            result.data,
            "list-users"
          );
          const users = parsed?.users ?? [];

          const membersResult = await authClient.organization.listMembers({
            query: { organizationId, limit: MEMBER_PAGE_SIZE },
          });
          throwIfBetterAuthError(membersResult, "Failed to fetch organization roles");

          const members = parseSdkPayload<{
            members?: { userId: string; role: string }[];
            total?: number;
          }>(membersResult.data, "list-members");

          // list-members applies no ORDER BY, so a truncated page is an
          // arbitrary subset — the missing members would read as Members.
          if ((members?.total ?? 0) > MEMBER_PAGE_SIZE) {
            throw new Error(
              `The station has more than ${MEMBER_PAGE_SIZE} accounts, so roles could not be resolved.`
            );
          }

          const memberRoleMap = new Map(
            (members?.members ?? []).map((member) => [member.userId, member.role])
          );

          const accounts = users.map((user) => {
            const betterAuthUser = user as BetterAuthUser;
            // No membership means no station role, which is what "member"
            // encodes. Every non-anonymous user gets one on creation, so this
            // only covers rows that predate that guarantee.
            betterAuthUser.role = (memberRoleMap.get(betterAuthUser.id) ??
              "member") as typeof betterAuthUser.role;
            return convertBetterAuthToAccountResult(betterAuthUser);
          });

          return { data: { accounts, total: parsed?.total ?? 0 } };
        } catch (err) {
          return { error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(adminSlice.actions.setTotalAccounts(data.total));
        } catch {
          // Errors surface through the query's own error state.
        }
      },
      providesTags: ["Roster"],
    }),
    provisionUser: builder.mutation<ProvisionUserResult, ProvisionUserArgs>({
      queryFn: async (args) => {
        try {
          const { ok, status, data } = await authFetch<
            ProvisionUserResult & { message?: string; error?: string }
          >("/admin/provision-user", { method: "POST", json: args });

          if (!ok) {
            return {
              error: { message: authErrorMessage(data, `Failed to create user (${status})`) },
            };
          }

          return { data: { emailSent: data?.emailSent, emailError: data?.emailError } };
        } catch (err) {
          return {
            error: {
              message: err instanceof Error ? err.message : "Failed to create user",
            },
          };
        }
      },
    }),
  }),
});

export const { useGetRosterQuery, useProvisionUserMutation } = adminApi;
