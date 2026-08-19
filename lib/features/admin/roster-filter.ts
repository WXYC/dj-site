import { Account, Authorization } from "./types";

/**
 * The roster's search and filters run over the accounts already in memory.
 *
 * They cannot run on the server: better-auth's `admin/list-users` accepts one
 * search field out of `email | name` and one filter field, ANDed — it can
 * express neither "any of the four text columns" nor a station-role filter,
 * whose value lives on `auth_member`, a table that endpoint never joins.
 */

const COMBINING_MARKS = /\p{Diacritic}/gu;

/**
 * Case- and diacritic-insensitive form for substring matching.
 *
 * Diacritics fold on both sides so a name typed off an ASCII keyboard finds
 * the account that carries the mark (`nilufer` -> Nilüfer Yanya); DJs enter
 * names both ways and neither spelling is the wrong one to search by.
 */
export function foldForSearch(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/**
 * The columns free-text search reads: every text column the table renders.
 *
 * Role is deliberately absent. Its labels share common substrings with names
 * ("ma" is in "Station Manager"), so folding it in here would make ordinary
 * queries drag in a third of the roster. The role column is searched through
 * the dedicated role filter, which is exact.
 */
function searchableFields(account: Account): string[] {
  return [account.realName, account.userName, account.djName ?? "", account.email ?? ""];
}

/**
 * Does `account` match every whitespace-separated term in `query`?
 *
 * Terms are matched independently across the whole row rather than against a
 * single column, so "juana jmolina" — a real name plus a username — matches
 * the one account carrying both, and word order does not matter.
 */
export function accountMatchesSearch(account: Account, query: string): boolean {
  const terms = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = searchableFields(account).map(foldForSearch);
  return terms.every((term) => haystack.some((field) => field.includes(term)));
}

/** An empty selection means "every role", not "no roles". */
function accountMatchesRoles(account: Account, roles: Authorization[]): boolean {
  return roles.length === 0 || roles.includes(account.authorization);
}

/**
 * Alphabetical by the name the table shows, ties broken by username.
 *
 * The order has to come from here rather than the server: `admin/list-users`
 * is issued without a sort, so its row order is whatever Postgres returns and
 * can differ between two reads of the same data — which would let a row swap
 * pages under an admin who only clicked "next".
 */
function sortForDisplay(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    const byRealName = a.realName.localeCompare(b.realName, undefined, { sensitivity: "base" });
    if (byRealName !== 0) return byRealName;
    return a.userName.localeCompare(b.userName, undefined, { sensitivity: "base" });
  });
}

export type RosterQuery = {
  search: string;
  roles: Authorization[];
  page: number;
  pageSize: number;
};

export type RosterView = {
  /** Every account passing the filters, in display order. */
  matches: Account[];
  /** The slice of `matches` on the page being shown. */
  pageAccounts: Account[];
  /** `page` clamped into range — the page actually shown. */
  page: number;
  totalPages: number;
};

/**
 * Apply search, role filter, ordering and pagination in one pass.
 *
 * `page` is clamped rather than trusted: a filter can shrink the roster out
 * from under the page an admin is standing on, and an out-of-range page would
 * otherwise render as an empty roster that looks like "no accounts".
 */
export function selectRosterView(accounts: Account[], query: RosterQuery): RosterView {
  const matches = sortForDisplay(
    accounts.filter(
      (account) =>
        accountMatchesSearch(account, query.search) && accountMatchesRoles(account, query.roles)
    )
  );

  const totalPages = Math.max(1, Math.ceil(matches.length / query.pageSize));
  const page = Math.min(Math.max(query.page, 0), totalPages - 1);
  const start = page * query.pageSize;

  return {
    matches,
    pageAccounts: matches.slice(start, start + query.pageSize),
    page,
    totalPages,
  };
}
