import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import type { ModifiableData } from "@/lib/features/authentication/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUpdateUser = vi.fn();
const mockGetSession = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
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
      info: { id: "u1", real_name: "Jessica Pratt", dj_name: "DJ Pratt" },
      loading: false,
    }),
  };
});

function createTestStore() {
  return configureStore({
    reducer: { authentication: authenticationSlice.reducer },
  });
}

type TestStore = ReturnType<typeof createTestStore>;

function createWrapper(store: TestStore) {
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

function modifications(store: TestStore) {
  return authenticationSlice.selectors.getModifications({
    authentication: store.getState().authentication,
  } as any);
}

describe("useDJAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockUpdateUser.mockResolvedValue({ data: { user: { id: "u1" } } });
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
      "drops an empty submission for the required field %s",
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

        // Nothing to send once the empty required field is dropped.
        expect(mockUpdateUser).not.toHaveBeenCalled();
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
  });

  describe("mount-time reset (#636)", () => {
    it("preserves modifications set before the hook mounts", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "pronouns", value: true })
      );

      const { useDJAccount } = await import("./djHooks");
      renderHook(() => useDJAccount(), { wrapper: createWrapper(store) });

      // The mount-time effect must NOT wipe the pre-existing edit.
      expect(modifications(store)).toContain("pronouns");
    });

    it("resets modifications after a save completes", async () => {
      const store = createTestStore();
      store.dispatch(
        authenticationSlice.actions.modify({ key: "bio", value: true })
      );

      // Hold the update open so the isUpdating true→false transition happens
      // across two separate act() flushes — otherwise act coalesces the
      // intermediate isUpdating:true render and the transition is never seen.
      let resolveUpdate: (value: unknown) => void = () => {};
      mockUpdateUser.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
      );

      const { useDJAccount } = await import("./djHooks");
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(store),
      });

      expect(modifications(store)).toContain("bio");

      // Kick off the save; it parks on the pending updateUser with isUpdating=true.
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = result.current.handleSaveData(formEvent({ bio: "New bio" }));
      });

      // Still mid-save — the reset must not have run yet.
      expect(modifications(store)).toContain("bio");

      await act(async () => {
        resolveUpdate({ data: { user: { id: "u1" } } });
        await pending;
      });

      // Post-save cleanup runs on the isUpdating true→false transition.
      expect(modifications(store)).toEqual([]);
    });
  });
});
