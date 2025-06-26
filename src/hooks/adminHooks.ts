import { useListAccountsQuery } from "@/lib/features/admin/api";
import { adminSlice } from "@/lib/features/admin/frontend";
import { useAppSelector } from "@/lib/hooks";
import { useMemo } from "react";

export const useAccountListResults = () => {
  const { data, isError, isLoading, error } = useListAccountsQuery(undefined);

  const searchString = useAppSelector(adminSlice.selectors.getSearchString);

  const filteredData = useMemo(() => {
    if (searchString.length > 0) {
      return (
        data?.filter(
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
    return data ?? [];
  }, [data, searchString]);

  return {
    data: filteredData,
    isLoading,
    isError,
    error,
  };
};
