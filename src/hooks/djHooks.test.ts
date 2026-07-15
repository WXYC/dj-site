import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import type { ModifiableData } from "@/lib/features/authentication/types";
import { createTestStore } from "@/lib/test-utils";
import type { AppStore } from "@/lib/store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUpdateUser = vi.fn();
const mockGetSession = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authBaseURL: "http://auth.test",
  authClient: {
    updateUser: (...args: any[]) => mockUpdateUser(...args),
    getSession: (...args: any[]) => mockGetSession(...args),
  },
}));

vi.mock("@/src/utilities/throwIfBetterAuthError", () => ({
  throwIfBetterAuthError: vi.fn(),
}));

// useDJAccount pulls the signed-in DJ from useRegistry; stub a resolved user so
// handleSaveData proceeds to the updateUser call.
vi.mock("./authenticationHooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authenticationHooks")>();
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

        const { useDJAccount } = await import("./djHooks");
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

        const { useDJAccount } = await import("./djHooks");
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

      const { useDJAccount } = await import("./djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      await act(async () => {
        await result.current.handleSaveData(
          formEvent({ realName: "Juana Molina" })
        );
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({ realName: "Juana Molina" });
    });

    it("ignores fields that were never modified", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "bio", value: true })
      );

      const { useDJAccount } = await import("./djHooks");
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

      const { useDJAccount } = await import("./djHooks");
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
      expect(toast.error).toHaveBeenCalledWith(
        "Real name and DJ name can't be empty — keeping the previous value."
      );
      // …and no reset fires: the dropped field still needs fixing.
      expect(modifications(store)).toContain("realName");
    });
  });

  describe("modification reset scoping (#636 + failed-save retry)", () => {
    it("preserves modifications set before the hook mounts", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "pronouns", value: true })
      );

      const { useDJAccount } = await import("./djHooks");
      renderHook(() => useDJAccount(), { wrapper: createWrapper(store) });

      // Mounting the hook must NOT wipe the pre-existing edit.
      expect(modifications(store)).toContain("pronouns");
    });

    it("resets modifications after a successful save", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "bio", value: true })
      );

      const { useDJAccount } = await import("./djHooks");
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

      const { useDJAccount } = await import("./djHooks");
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
