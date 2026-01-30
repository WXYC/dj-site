import { authClient } from "@/lib/features/authentication/client";
import { adminSlice } from "@/lib/features/admin/frontend";
import { useAppSelector } from "@/lib/hooks";
import { convertBetterAuthToAccountResult, BetterAuthUser } from "@/lib/features/admin/conversions-better-auth";
import { Account } from "@/lib/features/admin/types";
import { useMemo, useEffect, useState, useCallback } from "react";

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

  const searchString = useAppSelector(adminSlice.selectors.getSearchString);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      // Fetch all users
      const result = await authClient.admin.listUsers({
        query: {
          limit: 1000,
          offset: 0,
        },
      });

      if (result.error) {
        throw new Error(result.error.message || "Failed to fetch users");
      }

      const users = result.data?.users || [];

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
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const filteredData = useMemo(() => {
    if (searchString.length > 0) {
      return (
        accounts.filter(
          (account) =>
            account.userName
              .toLowerCase()
              .includes(searchString.toLowerCase()) ||
            account.realName
              .toLowerCase()
              .includes(searchString.toLowerCase()) ||
            account.djName.toLowerCase().includes(searchString.toLowerCase())
        ) ?? []
      );
    }
    return accounts ?? [];
  }, [accounts, searchString]);

  return {
    data: filteredData,
    isLoading,
    isError,
    error,
    refetch: fetchAccounts,
  };
};
