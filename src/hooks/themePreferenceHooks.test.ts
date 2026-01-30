import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { buildPreference, useThemePreferenceActions } from "./themePreferenceHooks";

// Mock dependencies
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: vi.fn(() => ({
      data: { user: { id: "user-1" } },
    })),
    updateUser: vi.fn(),
  },
}));

vi.mock("@/lib/features/experiences/api", () => ({
  useSetExperiencePreferenceMutation: vi.fn(() => [
    vi.fn(() => ({ unwrap: () => Promise.resolve() })),
    {},
  ]),
}));

vi.mock("@mui/joy/styles", () => ({
  useColorScheme: vi.fn(() => ({ mode: "light", setMode: vi.fn() })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

describe("themePreferenceHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe("buildPreference", () => {
    it.each([
      ["classic", "light", "classic-light"],
      ["classic", "dark", "classic-dark"],
      ["modern", "light", "modern-light"],
      ["modern", "dark", "modern-dark"],
    ] as const)(
      'should build "%s-%s" preference',
      (experience, colorMode, expected) => {
        expect(buildPreference(experience, colorMode)).toBe(expected);
      }
    );

    it("should return a valid AppSkinPreference type", () => {
      const result = buildPreference("modern", "dark");
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^(classic|modern)-(light|dark)$/);
    });
  });

  describe("useThemePreferenceActions", () => {
    it("should return persistPreference function", () => {
      const { result } = renderHook(() => useThemePreferenceActions());
      expect(typeof result.current.persistPreference).toBe("function");
    });

    it("should call persistPreference without error", async () => {
      const { result } = renderHook(() => useThemePreferenceActions());

      // Just verify the call completes without throwing
      await expect(
        act(async () => {
          await result.current.persistPreference("modern-dark");
        })
      ).resolves.not.toThrow();
    });

    it("should call setPreference mutation", async () => {
      const { useSetExperiencePreferenceMutation } = await import("@/lib/features/experiences/api");
      const mockSetPreference = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
      vi.mocked(useSetExperiencePreferenceMutation).mockReturnValue([mockSetPreference, {} as any]);

      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("classic-light");
      });

      expect(mockSetPreference).toHaveBeenCalledWith({ preference: "classic-light" });
    });

    it("should call updateUser when updateUser option is true", async () => {
      const { authClient } = await import("@/lib/features/authentication/client");

      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("modern-light", { updateUser: true });
      });

      expect(authClient.updateUser).toHaveBeenCalledWith({ appSkin: "modern-light" });
    });

    it("should not call updateUser when updateUser option is false", async () => {
      const { authClient } = await import("@/lib/features/authentication/client");
      vi.mocked(authClient.updateUser).mockClear();

      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("modern-dark", { updateUser: false });
      });

      expect(authClient.updateUser).not.toHaveBeenCalled();
    });
  });
});
