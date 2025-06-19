import { useListAccountsQuery } from "@/lib/features/admin/api";
import { adminSlice } from "@/lib/features/admin/frontend";
import { useAppSelector } from "@/lib/hooks";

export const useAccountListResults = () => {
  const { data, isError, isLoading, error } = useListAccountsQuery(undefined);

  const searchString = useAppSelector(adminSlice.selectors.getSearchString);

  return {
    data:
      searchString.length > 0
        ? data?.filter(
            (account) =>
              account.userName
                .toLowerCase()
                .includes(searchString.toLowerCase()) ||
              account.realName
                .toLowerCase()
                .includes(searchString.toLowerCase()) ||
              account.djName.toLowerCase().includes(searchString.toLowerCase())
          ) ?? []
        : data ?? [],
    isLoading,
    isError,
    error,
  };
};
