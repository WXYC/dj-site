import { describe, it, expect } from "vitest";
import {
  foldForSearch,
  accountMatchesSearch,
  selectRosterView,
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

describe("selectRosterView", () => {
  const view = (overrides: Partial<Parameters<typeof selectRosterView>[1]> = {}) =>
    selectRosterView(roster, { search: "", roles: [], page: 0, pageSize: 2, ...overrides });

  it("orders matches alphabetically by real name so pages are stable", () => {
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
});
