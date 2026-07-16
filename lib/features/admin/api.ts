import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { authClient } from "@/lib/features/authentication/client";
import { resolveOrganizationIdAdmin } from "@/lib/features/authentication/organization-utils";
import { throwIfBetterAuthError } from "@/src/utilities/throwIfBetterAuthError";
import { adminSlice } from "./frontend";
import { BetterAuthUser, convertBetterAuthToAccountResult } from "./conversions-better-auth";
import { Account, ROSTER_PAGE_SIZE } from "./types";

type RosterArgs = { search: string; page: number };
type RosterResult = { accounts: Account[]; total: number };

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fakeBaseQuery<{ message: string }>(),
  tagTypes: ["Roster"],
  endpoints: (builder) => ({
    getRoster: builder.query<RosterResult, RosterArgs>({
      queryFn: async ({ search, page }) => {
        try {
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

          // better-auth's SDK parser (betterJSONParse, strict:false) can return the
          // raw JSON string instead of a parsed object; parse it ourselves as a fallback.
          let responseData: unknown = result.data;
          if (typeof responseData === "string") {
            console.warn("[roster] better-auth returned unparsed JSON string; parsing manually");
            responseData = JSON.parse(responseData);
          }

          const parsed = responseData as { users?: unknown[]; total?: number };
          const users = parsed?.users ?? [];

          const memberRoleMap = new Map<string, string>();
          const organizationId = await resolveOrganizationIdAdmin();
          if (organizationId) {
            const membersResult = await authClient.organization.listMembers({
              query: { organizationId, limit: 1000 },
            });
            if (!membersResult.error && membersResult.data?.members) {
              for (const member of membersResult.data.members) {
                memberRoleMap.set(member.userId, member.role);
              }
            }
          }

          const accounts = users.map((user) => {
            const betterAuthUser = user as BetterAuthUser;
            const memberRole = memberRoleMap.get(betterAuthUser.id);
            if (memberRole) {
              betterAuthUser.role = memberRole as typeof betterAuthUser.role;
            }
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
  }),
});

export const { useGetRosterQuery } = adminApi;
