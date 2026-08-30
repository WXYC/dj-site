import { adminSlice } from "@/lib/features/admin/frontend";
import { useGetRosterQuery } from "@/lib/features/admin/api";
import { selectRosterView, sortRosterForDisplay } from "@/lib/features/admin/roster-filter";
import { Account, ROSTER_PAGE_SIZE } from "@/lib/features/admin/types";
import { useAppSelector } from "@/lib/hooks";
import { useMemo } from "react";

const NO_ACCOUNTS: Account[] = [];

/**
 * The roster, narrowed by the admin's search, role and onboarding filters.
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
  const onboardingFilter = useAppSelector(adminSlice.selectors.getOnboardingFilter);
  const page = useAppSelector(adminSlice.selectors.getPage);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetRosterQuery({ organizationSlug });

  const accounts = data?.accounts ?? NO_ACCOUNTS;

  // Ordering is a property of the roster, not of the query over it, so it is
  // kept out of the per-keystroke path.
  const ordered = useMemo(() => sortRosterForDisplay(accounts), [accounts]);
  const view = useMemo(
    () =>
      selectRosterView(ordered, {
        search: searchString,
        roles: roleFilter,
        onboarding: onboardingFilter,
        page,
        pageSize: ROSTER_PAGE_SIZE,
      }),
    [ordered, searchString, roleFilter, onboardingFilter, page]
  );

  return {
    /** The page of matching accounts the table renders. */
    accounts: view.pageAccounts,
    matches: view.matches,
    page: view.page,
    totalPages: view.totalPages,
    /** Accounts on the roster before search and filtering. */
    totalAccounts: accounts.length,
    isLoading: isLoading || isFetching,
    isError,
    error: error ? new Error(error.message) : null,
    refetch,
  };
};
