import { authClient } from "@/lib/features/authentication/client";
import { adminSlice } from "@/lib/features/admin/frontend";
import { useAppSelector } from "@/lib/hooks";
import { convertBetterAuthToAccountResult, BetterAuthUser } from "@/lib/features/admin/conversions-better-auth";
import { Account } from "@/lib/features/admin/types";
import { useMemo, useEffect, useState, useCallback } from "react";

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
      const convertedAccounts = users.map((user) =>
        convertBetterAuthToAccountResult(user as BetterAuthUser)
      );
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
            (account.djName?.toLowerCase().includes(searchString.toLowerCase()) ?? false)
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
