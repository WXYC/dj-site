import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import type { ModifiableData } from "@/lib/features/authentication/types";
import { createTestStore } from "@/tests/helpers";
import type { AppStore } from "@/lib/store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUpdateUser = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateIdentity = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authBaseURL: "http://auth.test",
  authClient: {
    updateUser: (...args: any[]) => mockUpdateUser(...args),
    getSession: (...args: any[]) => mockGetSession(...args),
  },
  updateIdentity: (...args: any[]) => mockUpdateIdentity(...args),
}));

vi.mock("@/src/utilities/throwIfBetterAuthError", () => ({
  throwIfBetterAuthError: vi.fn(),
}));

// useDJAccount pulls the signed-in DJ from useRegistry; stub a resolved user so
// handleSaveData proceeds to the updateUser call.
vi.mock("@/src/hooks/authenticationHooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/hooks/authenticationHooks")>();
  return {
    ...actual,
    useRegistry: () => ({
      info: { id: "user-dj1", real_name: "Test DJ 1", dj_name: "Test dj1" },
      loading: false,
    }),
  };
});

function createWrapper(store: AppStore) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(Provider, { store, children });
  };
}

// Build a real <form> so `new FormData(e.currentTarget)` reads named inputs the
// way the browser would.
function formEvent(fields: Record<string, string>) {
  const form = document.createElement("form");
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  return { preventDefault: vi.fn(), currentTarget: form } as any;
}

function modifications(store: AppStore) {
  return authenticationSlice.selectors.getModifications(store.getState());
}

describe("useDJAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { user: { id: "user-dj1" } } });
    mockUpdateUser.mockResolvedValue({ data: { user: { id: "user-dj1" } } });
    mockUpdateIdentity.mockResolvedValue({ status: true, userId: "user-dj1" });
  });

  describe("clearing profile fields (#609)", () => {
    const optionalFields: (keyof ModifiableData)[] = [
      "pronouns",
      "namePronunciation",
      "showTimes",
      "title",
      "semesterHired",
      "bio",
      "location",
    ];

    it.each(optionalFields)(
      "sends an empty string when the optional field %s is cleared",
      async (field) => {
        const store = createTestStore();
        store.dispatch(
          authenticationSlice.actions.modify({ key: field, value: true })
        );

        const { useDJAccount } = await import("@/src/hooks/djHooks");
        const { result } = renderHook(() => useDJAccount(), {
          wrapper: createWrapper(store),
        });

        await act(async () => {
          await result.current.handleSaveData(formEvent({ [field]: "" }));
        });

        expect(mockUpdateUser).toHaveBeenCalledWith({ [field]: "" });
      }
    );

    it.each(["realName", "djName", "email"] as (keyof ModifiableData)[])(
      "drops an empty submission for the required field %s and explains why",
      async (field) => {
        const store = createTestStore();
        store.dispatch(
          authenticationSlice.actions.modify({ key: field, value: true })
        );

        const { useDJAccount } = await import("@/src/hooks/djHooks");
        const { result } = renderHook(() => useDJAccount(), {
          wrapper: createWrapper(store),
        });

        await act(async () => {
          await result.current.handleSaveData(formEvent({ [field]: "" }));
        });

        // Nothing to send once the empty required field is dropped — but the
        // drop must not be silent, and the modify flag must survive so Save
        // stays enabled for the user to fix and resubmit.
        expect(mockUpdateUser).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith(
          "Real name and DJ name can't be empty — keeping the previous value."
        );
        expect(modifications(store)).toContain(field);
      }
    );

    it("still sends a non-empty required field", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "realName", value: true })
      );

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      await act(async () => {
        await result.current.handleSaveData(
          formEvent({ realName: "Juana Molina" })
        );
      });

      expect(mockUpdateIdentity).toHaveBeenCalledWith({
        realName: "Juana Molina",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("ignores fields that were never modified", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "bio", value: true })
      );

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      await act(async () => {
        await result.current.handleSaveData(
          formEvent({ bio: "", location: "Chapel Hill, NC" })
        );
      });

      // Only bio was modified; location must not leak into the payload.
      expect(mockUpdateUser).toHaveBeenCalledWith({ bio: "" });
    });

    it("saves the valid fields but keeps the flags when a required clear is dropped alongside them", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "realName", value: true })
      );
      store.dispatch(
        authenticationSlice.actions.modify({ key: "bio", value: true })
      );

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      await act(async () => {
        await result.current.handleSaveData(
          formEvent({ realName: "", bio: "Late-night freeform." })
        );
      });

      // The clear was dropped but the bio still saves…
      expect(mockUpdateUser).toHaveBeenCalledWith({
        bio: "Late-night freeform.",
      });
      expect(mockUpdateIdentity).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        "Real name and DJ name can't be empty — keeping the previous value."
      );
      // …and no reset fires: the dropped field still needs fixing.
      expect(modifications(store)).toContain("realName");
    });
  });

  // BS#2297 locked `realName`/`djName` to `input: false` in better-auth's
  // `user.additionalFields`, so the public POST /auth/update-user this hook
  // used to send them through answers
  // `400 {field} is not allowed to be set`. They now go to the dedicated
  // self-service route instead; every other profile field is unaffected and
  // still rides `authClient.updateUser`.
  describe("identity fields route to /wxyc/update-identity", () => {
    const identityFields: (keyof ModifiableData)[] = ["realName", "djName"];

    it.each(identityFields)(
      "sends %s to updateIdentity, never to authClient.updateUser",
      async (field) => {
        const store = createTestStore();
        store.dispatch(
          authenticationSlice.actions.modify({ key: field, value: true })
        );

        const { useDJAccount } = await import("@/src/hooks/djHooks");
        const { result } = renderHook(() => useDJAccount(), {
          wrapper: createWrapper(store),
        });

        await act(async () => {
          await result.current.handleSaveData(
            formEvent({ [field]: "DJ spacetime" })
          );
        });

        expect(mockUpdateIdentity).toHaveBeenCalledWith({
          [field]: "DJ spacetime",
        });
        expect(mockUpdateUser).not.toHaveBeenCalled();
      }
    );

    it("splits a mixed submission across both calls", async () => {
      const store = createTestStore();
      for (const key of ["djName", "bio"] as (keyof ModifiableData)[]) {
        store.dispatch(authenticationSlice.actions.modify({ key, value: true }));
      }

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      await act(async () => {
        await result.current.handleSaveData(
          formEvent({ djName: "DJ spacetime", bio: "Late-night freeform." })
        );
      });

      expect(mockUpdateIdentity).toHaveBeenCalledWith({
        djName: "DJ spacetime",
      });
      expect(mockUpdateUser).toHaveBeenCalledWith({
        bio: "Late-night freeform.",
      });
      expect(modifications(store)).toEqual([]);
      expect(toast.success).toHaveBeenCalled();
    });

    // The whole point of the fix: a rejected identity write must surface, not
    // be reported as a save. The 400 that started this was invisible to the
    // DJ except as a toast that said the opposite.
    it("reports an identity failure and keeps the flags for a retry", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "djName", value: true })
      );
      mockUpdateIdentity.mockRejectedValue(
        new Error("djName is not allowed to be set")
      );

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      await act(async () => {
        await result.current.handleSaveData(
          formEvent({ djName: "DJ spacetime" })
        );
      });

      expect(toast.error).toHaveBeenCalledWith(
        "djName is not allowed to be set"
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(modifications(store)).toContain("djName");
    });

    // Ordering matters: if the identity write fails there is nothing to undo,
    // but if the profile write fails after a successful identity write the
    // user must still be told the save failed rather than half-succeeded.
    it("does not report success when the profile write fails after the identity write", async () => {
      const store = createTestStore();
      for (const key of ["djName", "bio"] as (keyof ModifiableData)[]) {
        store.dispatch(authenticationSlice.actions.modify({ key, value: true }));
      }
      mockUpdateUser.mockRejectedValue(new Error("network down"));

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      await act(async () => {
        await result.current.handleSaveData(
          formEvent({ djName: "DJ spacetime", bio: "Late-night freeform." })
        );
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(modifications(store)).toContain("bio");
    });
  });

  describe("modification reset scoping (#636 + failed-save retry)", () => {
    it("preserves modifications set before the hook mounts", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "pronouns", value: true })
      );

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      renderHook(() => useDJAccount(), { wrapper: createWrapper(store) });

      // Mounting the hook must NOT wipe the pre-existing edit.
      expect(modifications(store)).toContain("pronouns");
    });

    it("resets modifications after a successful save", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "bio", value: true })
      );

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      expect(modifications(store)).toContain("bio");

      await act(async () => {
        await result.current.handleSaveData(formEvent({ bio: "New bio" }));
      });

      expect(modifications(store)).toEqual([]);
      expect(toast.success).toHaveBeenCalled();
    });

    it("keeps modifications when the save fails, so Save stays enabled for a retry", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "bio", value: true })
      );
      mockUpdateUser.mockRejectedValue(new Error("network down"));

      const { useDJAccount } = await import("@/src/hooks/djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      await act(async () => {
        await result.current.handleSaveData(formEvent({ bio: "New bio" }));
      });

      // The user's text still sits in the inputs; the flags must survive so
      // isModified stays true and they can resubmit without re-touching.
      expect(modifications(store)).toContain("bio");
      expect(
        authenticationSlice.selectors.isModified(store.getState())
      ).toBe(true);
      expect(toast.error).toHaveBeenCalledWith("network down");
    });
  });
});
