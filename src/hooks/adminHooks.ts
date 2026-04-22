import { authClient } from "@/lib/features/authentication/client";
import { adminSlice } from "@/lib/features/admin/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { convertBetterAuthToAccountResult, BetterAuthUser } from "@/lib/features/admin/conversions-better-auth";
import { Account, ROSTER_PAGE_SIZE } from "@/lib/features/admin/types";
import { useEffect, useState, useCallback } from "react";
import { throwIfBetterAuthError } from "@/src/utilities/throwIfBetterAuthError";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

/**
 * Get the organization ID from environment variable
 */
async function getOrganizationId(): Promise<string | null> {
  const orgSlugOrId = process.env.NEXT_PUBLIC_APP_ORGANIZATION;
  if (!orgSlugOrId) {
    return null;
  }

  const orgResult = await authClient.organization.getFullOrganization({
    query: {
      organizationSlug: orgSlugOrId,
    },
  });

  if (orgResult.data?.id) {
    return orgResult.data.id;
  }

  return orgSlugOrId;
}

export const useAccountListResults = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const dispatch = useAppDispatch();
  const searchString = useAppSelector(adminSlice.selectors.getSearchString);
  const page = useAppSelector(adminSlice.selectors.getPage);
  const debouncedSearch = useDebouncedValue(searchString, 300);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      // Build server-side query with filtering and pagination
      const query: Record<string, unknown> = {
        limit: ROSTER_PAGE_SIZE,
        offset: page * ROSTER_PAGE_SIZE,
        filterField: "isAnonymous",
        filterValue: "false",
        filterOperator: "eq",
      };

      if (debouncedSearch.length > 0) {
        query.searchValue = debouncedSearch;
        query.searchField = "name";
        query.searchOperator = "contains";
      }

      const result = await authClient.admin.listUsers({ query });

      throwIfBetterAuthError(result, "Failed to fetch users");

      // The better-auth SDK's JSON parser (betterJSONParse with strict: false) can silently
      // return the raw JSON string instead of a parsed object when JSON.parse fails internally.
      // Handle this by parsing the string ourselves as a fallback.
      let responseData: unknown = result.data;
      if (typeof responseData === "string") {
        console.warn("[roster] better-auth SDK returned unparsed JSON string (%d chars), parsing manually", (responseData as string).length);
        try {
          JSON.parse(responseData as string, (_k, v) => v);
          console.warn("[roster] JSON.parse with trivial reviver succeeded — better-auth secureReviver is the cause");
        } catch (e) {
          console.warn("[roster] JSON itself is invalid (%d chars): %s", (responseData as string).length, (e as Error).message);
          console.warn("[roster] head:", (responseData as string).substring(0, 200));
          console.warn("[roster] tail:", (responseData as string).substring((responseData as string).length - 200));
        }
        responseData = JSON.parse(responseData as string);
      }

      const parsed = responseData as { users?: unknown[]; total?: number };
      const users = parsed?.users || [];

      // Fetch organization members to get accurate roles
      let memberRoleMap = new Map<string, string>();
      const organizationId = await getOrganizationId();

      if (organizationId) {
        const membersResult = await authClient.organization.listMembers({
          query: {
            organizationId,
            limit: 1000,
          },
        });

        if (!membersResult.error && membersResult.data?.members) {
          for (const member of membersResult.data.members) {
            memberRoleMap.set(member.userId, member.role);
          }
        }
      }

      // Convert users and merge with member roles
      const convertedAccounts = users.map((user) => {
        const betterAuthUser = user as BetterAuthUser;
        // Use organization member role if available, otherwise fall back to user role
        const memberRole = memberRoleMap.get(betterAuthUser.id);
        if (memberRole) {
          betterAuthUser.role = memberRole as typeof betterAuthUser.role;
        }
        return convertBetterAuthToAccountResult(betterAuthUser);
      });
      setAccounts(convertedAccounts);
      dispatch(adminSlice.actions.setTotalAccounts(parsed?.total ?? 0));
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, page, dispatch]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    data: accounts,
    isLoading,
    isError,
    error,
    refetch: fetchAccounts,
  };
};
