import { adminSlice } from "@/lib/features/admin/frontend";
import { useGetRosterQuery } from "@/lib/features/admin/api";
import { useAppSelector } from "@/lib/hooks";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

/**
 * @param organizationSlug Station organization slug, read server-side by the
 *   roster page. Every caller on a page must pass the same value, or RTK Query
 *   will keep a separate roster cache entry per slug.
 */
export const useAccountListResults = (organizationSlug: string) => {
  const searchString = useAppSelector(adminSlice.selectors.getSearchString);
  const page = useAppSelector(adminSlice.selectors.getPage);
  const debouncedSearch = useDebouncedValue(searchString, 300);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetRosterQuery({ search: debouncedSearch, page, organizationSlug });

  return {
    data: data?.accounts ?? [],
    isLoading: isLoading || isFetching,
    isError,
    error: error ? new Error(error.message) : null,
    refetch,
  };
};
