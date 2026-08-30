import { describe, it, expect } from "vitest";
import {
  foldForSearch,
  accountMatchesSearch,
  isOnboardingIncomplete,
  selectRosterView,
  sortRosterForDisplay,
} from "@/lib/features/admin/roster-filter";
import { Authorization } from "@/lib/features/admin/types";
import { createTestAccountResult } from "@/tests/helpers";

const juana = createTestAccountResult({
  realName: "Juana Molina",
  userName: "jmolina",
  djName: "DJ Paradoja",
  email: "juana@wxyc.org",
  authorization: Authorization.DJ,
});

const nilufer = createTestAccountResult({
  realName: "Nilüfer Yanya",
  userName: "nyanya",
  djName: undefined,
  email: "nilufer@wxyc.org",
  authorization: Authorization.MD,
});

const jessica = createTestAccountResult({
  realName: "Jessica Pratt",
  userName: "jpratt",
  djName: "On Your Own",
  email: "jessica@wxyc.org",
  authorization: Authorization.SM,
});

const roster = [jessica, juana, nilufer];

describe("foldForSearch", () => {
  it.each([
    ["Juana Molina", "juana molina"],
    ["Nilüfer", "nilufer"],
    ["Hermanos Gutiérrez", "hermanos gutierrez"],
    ["CSILLAGRABLÓK", "csillagrablok"],
  ])("folds %s to %s", (input, expected) => {
    expect(foldForSearch(input)).toBe(expected);
  });
});

describe("accountMatchesSearch", () => {
  it("matches every column the roster renders, not just the name", () => {
    expect(accountMatchesSearch(juana, "Juana Molina")).toBe(true);
    expect(accountMatchesSearch(juana, "jmolina")).toBe(true);
    expect(accountMatchesSearch(juana, "Paradoja")).toBe(true);
    expect(accountMatchesSearch(juana, "juana@wxyc.org")).toBe(true);
  });

  // The regression this module exists for: better-auth's `contains` compiles to
  // a case-sensitive Postgres LIKE, so a lowercase query found nothing.
  it("ignores case", () => {
    expect(accountMatchesSearch(juana, "juana molina")).toBe(true);
    expect(accountMatchesSearch(juana, "JUANA")).toBe(true);
  });

  it("ignores diacritics in both the query and the account", () => {
    expect(accountMatchesSearch(nilufer, "nilufer")).toBe(true);
    expect(accountMatchesSearch(nilufer, "Nilüfer")).toBe(true);
  });

  it("requires every whitespace-separated term, but not in one column", () => {
    expect(accountMatchesSearch(juana, "juana jmolina")).toBe(true);
    expect(accountMatchesSearch(juana, "molina juana")).toBe(true);
    expect(accountMatchesSearch(juana, "juana pratt")).toBe(false);
  });

  it("treats a blank query as no filter", () => {
    expect(accountMatchesSearch(juana, "")).toBe(true);
    expect(accountMatchesSearch(juana, "   ")).toBe(true);
  });

  it("does not throw on accounts missing the optional columns", () => {
    const sparse = createTestAccountResult({
      realName: "No Real Name",
      userName: "sparse",
      djName: undefined,
      email: undefined,
    });
    expect(accountMatchesSearch(sparse, "sparse")).toBe(true);
    expect(accountMatchesSearch(sparse, "nothing")).toBe(false);
  });
});

describe("sortRosterForDisplay", () => {
  it("orders alphabetically by real name so pages are stable", () => {
    expect(sortRosterForDisplay(roster).map((a) => a.realName)).toEqual([
      "Jessica Pratt",
      "Juana Molina",
      "Nilüfer Yanya",
    ]);
  });

  it("breaks ties on real name with the username", () => {
    const [a, b] = sortRosterForDisplay([
      createTestAccountResult({ realName: "Same Name", userName: "zzz" }),
      createTestAccountResult({ realName: "Same Name", userName: "aaa" }),
    ]);
    expect([a.userName, b.userName]).toEqual(["aaa", "zzz"]);
  });

  it("does not mutate its input", () => {
    const input = [...roster];
    sortRosterForDisplay(input);
    expect(input).toEqual(roster);
  });
});

describe("isOnboardingIncomplete", () => {
  // The roster's only evidence about the signup flow. `authType` cannot stand
  // in for it: `provision-user.ts` creates every account with
  // `emailVerified: true`, so it reports Confirmed for a DJ who has never
  // opened the setup email.
  it("selects the account better-auth reported as not onboarded", () => {
    expect(isOnboardingIncomplete(createTestAccountResult({ hasCompletedOnboarding: false }))).toBe(
      true
    );
    expect(isOnboardingIncomplete(createTestAccountResult({ hasCompletedOnboarding: true }))).toBe(
      false
    );
  });

  // `convertBetterAuthToAccountResult` coerces a missing flag to `false`, so a
  // row off the roster's own API always carries a real boolean. The absent case
  // is pinned because the predicate is exported: a caller reading a session
  // `user`, where the flag genuinely can be missing, must not read a DJ who is
  // still locked out of the signup flow as onboarded. Every other onboarding
  // gate in the app answers this the same way.
  it("treats an absent flag as onboarding never finished", () => {
    const noFlag = createTestAccountResult({});
    delete noFlag.hasCompletedOnboarding;
    expect(isOnboardingIncomplete(noFlag)).toBe(true);
  });
});

describe("selectRosterView", () => {
  // Filtering and slicing preserve input order, so the view is fed the sorted
  // roster the hook keeps out of the per-keystroke path.
  const ordered = sortRosterForDisplay(roster);
  const view = (overrides: Partial<Parameters<typeof selectRosterView>[1]> = {}) =>
    selectRosterView(ordered, {
      search: "",
      roles: [],
      onboarding: "all",
      page: 0,
      pageSize: 2,
      ...overrides,
    });

  it("preserves the order it is given", () => {
    expect(view({ pageSize: 50 }).matches.map((a) => a.realName)).toEqual([
      "Jessica Pratt",
      "Juana Molina",
      "Nilüfer Yanya",
    ]);
  });

  it("returns only the requested page", () => {
    expect(view({ page: 0 }).pageAccounts.map((a) => a.userName)).toEqual(["jpratt", "jmolina"]);
    expect(view({ page: 1 }).pageAccounts.map((a) => a.userName)).toEqual(["nyanya"]);
    expect(view().totalPages).toBe(2);
  });

  it("filters by role, keeping everything when no role is selected", () => {
    expect(view({ roles: [], pageSize: 50 }).matches).toHaveLength(3);
    expect(view({ roles: [Authorization.SM], pageSize: 50 }).matches).toEqual([jessica]);
    expect(
      view({ roles: [Authorization.MD, Authorization.SM], pageSize: 50 }).matches.map(
        (a) => a.userName
      )
    ).toEqual(["jpratt", "nyanya"]);
  });

  it("applies search and role together", () => {
    expect(view({ search: "j", roles: [Authorization.DJ], pageSize: 50 }).matches).toEqual([juana]);
  });

  // A filter can shrink the roster under the page the admin is standing on.
  it("clamps a page that no longer exists onto the last one", () => {
    const clamped = view({ page: 9, pageSize: 2 });
    expect(clamped.page).toBe(1);
    expect(clamped.pageAccounts.map((a) => a.userName)).toEqual(["nyanya"]);
  });

  it("reports one page and no accounts when nothing matches", () => {
    const empty = view({ search: "nobody" });
    expect(empty.matches).toEqual([]);
    expect(empty.pageAccounts).toEqual([]);
    expect(empty.page).toBe(0);
    expect(empty.totalPages).toBe(1);
  });

  describe("onboarding filter", () => {
    const onboarded = createTestAccountResult({
      realName: "Alan Sondheim",
      userName: "asondheim",
      hasCompletedOnboarding: true,
    });
    const stranded = createTestAccountResult({
      realName: "Beverly Glenn-Copeland",
      userName: "bglenncopeland",
      hasCompletedOnboarding: false,
    });
    const mixed = sortRosterForDisplay([onboarded, stranded, jessica]);
    const mixedView = (overrides: Partial<Parameters<typeof selectRosterView>[1]> = {}) =>
      selectRosterView(mixed, {
        search: "",
        roles: [],
        onboarding: "all",
        page: 0,
        pageSize: 50,
        ...overrides,
      });

    it('keeps every account under "all"', () => {
      expect(mixedView().matches).toHaveLength(3);
    });

    it("narrows to the DJs who never finished signing up", () => {
      expect(mixedView({ onboarding: "incomplete" }).matches.map((a) => a.userName)).toEqual([
        "bglenncopeland",
      ]);
    });

    it("narrows to the DJs who did", () => {
      expect(mixedView({ onboarding: "complete" }).matches.map((a) => a.userName)).toEqual([
        "asondheim",
        "jpratt",
      ]);
    });

    it("ANDs with search and role, so a filtered roster can be searched", () => {
      expect(
        mixedView({ onboarding: "incomplete", search: "beverly" }).matches.map((a) => a.userName)
      ).toEqual(["bglenncopeland"]);
      expect(mixedView({ onboarding: "incomplete", roles: [Authorization.SM] }).matches).toEqual([]);
    });

    // Same hazard the role filter has: narrowing to a handful of stranded DJs
    // from page 3 must not render as an empty roster.
    it("clamps the page when the filter shrinks the roster underfoot", () => {
      const clamped = mixedView({ onboarding: "incomplete", page: 4, pageSize: 2 });
      expect(clamped.page).toBe(0);
      expect(clamped.pageAccounts.map((a) => a.userName)).toEqual(["bglenncopeland"]);
    });
  });
});
