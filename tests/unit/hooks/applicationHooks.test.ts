import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeStore } from "@/lib/store";
import { applicationSlice } from "@/lib/features/application/frontend";
import { adminSlice } from "@/lib/features/admin/frontend";
import {
  resolveOrganizationIdAdmin,
  resetOrganizationIdCache,
} from "@/lib/features/authentication/organization-utils";
import { resetApplication } from "@/src/hooks/applicationHooks";

describe("resetApplication (logout state hygiene) — #639/#616", () => {
  beforeEach(() => {
    resetOrganizationIdCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resets application (panel/sidebar/auth-stage) and admin (search/page) slice state", () => {
    const store = makeStore();

    // Seed previous-session UI + admin state.
    store.dispatch(applicationSlice.actions.openPanel({ type: "settings" }));
    store.dispatch(applicationSlice.actions.setAuthStage("reset"));
    store.dispatch(adminSlice.actions.setSearchString("bromberg"));
    store.dispatch(adminSlice.actions.setPage(3));

    expect(applicationSlice.selectors.getRightbarPanel(store.getState())).toEqual({
      type: "settings",
    });
    expect(adminSlice.selectors.getSearchString(store.getState())).toBe("bromberg");
    expect(adminSlice.selectors.getPage(store.getState())).toBe(3);

    resetApplication(store.dispatch);

    // Nothing from the previous session survives.
    expect(applicationSlice.selectors.getRightbarPanel(store.getState())).toEqual({
      type: "default",
    });
    expect(applicationSlice.selectors.getAuthStage(store.getState())).toBe("otp-email");
    expect(adminSlice.selectors.getSearchString(store.getState())).toBe("");
    expect(adminSlice.selectors.getPage(store.getState())).toBe(0);
  });

  it("clears the admin org-id cache so it can't leak into the next session", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        return { ok: true, json: async () => ({ id: "org-123" }) } as unknown as Response;
      })
    );

    await resolveOrganizationIdAdmin("wxyc");
    await resolveOrganizationIdAdmin("wxyc"); // served from cache — no new fetch
    expect(calls).toBe(1);

    // A logout (dispatch is irrelevant to the cache clear) must drop the entry.
    resetApplication(vi.fn() as never);

    await resolveOrganizationIdAdmin("wxyc"); // cache cleared → refetch
    expect(calls).toBe(2);
  });
});
