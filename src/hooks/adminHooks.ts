import { adminSlice } from "@/lib/features/admin/frontend";
import { useGetRosterQuery } from "@/lib/features/admin/api";
import { useAppSelector } from "@/lib/hooks";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

export const useAccountListResults = () => {
  const searchString = useAppSelector(adminSlice.selectors.getSearchString);
  const page = useAppSelector(adminSlice.selectors.getPage);
  const debouncedSearch = useDebouncedValue(searchString, 300);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetRosterQuery({ search: debouncedSearch, page });

  return {
    data: data?.accounts ?? [],
    isLoading: isLoading || isFetching,
    isError,
    error: error ? new Error(error.message) : null,
    refetch,
  };
};
