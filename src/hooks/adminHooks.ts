import { adminSlice } from "@/lib/features/admin/frontend";
import { useGetRosterQuery } from "@/lib/features/admin/api";
import { selectRosterView, type RosterView } from "@/lib/features/admin/roster-filter";
import { ROSTER_PAGE_SIZE } from "@/lib/features/admin/types";
import { useAppSelector } from "@/lib/hooks";
import { useMemo } from "react";

const EMPTY_VIEW: RosterView = { matches: [], pageAccounts: [], page: 0, totalPages: 1 };

/**
 * The roster, narrowed by the admin's search and role filter.
 *
 * The whole roster is fetched once and narrowed here rather than per keystroke
 * on the server — see `roster-filter.ts` for why the server cannot express
 * these queries.
 *
 * @param organizationSlug Station organization slug, read server-side by the
 *   roster page. Every caller on a page must pass the same value, or RTK Query
 *   will keep a separate roster cache entry per slug.
 */
export const useAccountListResults = (organizationSlug: string) => {
  const searchString = useAppSelector(adminSlice.selectors.getSearchString);
  const roleFilter = useAppSelector(adminSlice.selectors.getRoleFilter);
  const page = useAppSelector(adminSlice.selectors.getPage);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetRosterQuery({ organizationSlug });

  const accounts = data?.accounts;
  const view = useMemo(
    () =>
      accounts
        ? selectRosterView(accounts, {
            search: searchString,
            roles: roleFilter,
            page,
            pageSize: ROSTER_PAGE_SIZE,
          })
        : EMPTY_VIEW,
    [accounts, searchString, roleFilter, page]
  );

  return {
    /** The page of matching accounts the table renders. */
    accounts: view.pageAccounts,
    /** Every matching account, across pages — what a CSV export should carry. */
    matches: view.matches,
    /** The page being shown, which is `page` clamped into range. */
    page: view.page,
    totalPages: view.totalPages,
    /** Accounts on the roster before search and role filtering. */
    totalAccounts: accounts?.length ?? 0,
    isLoading: isLoading || isFetching,
    isError,
    error: error ? new Error(error.message) : null,
    refetch,
  };
};
