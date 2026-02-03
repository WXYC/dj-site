import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock better-auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: null })),
    updateUser: vi.fn(() => Promise.resolve({})),
  },
}));

// Mock experiences API
const mockSetPreference = vi.fn(() => ({
  unwrap: () => Promise.resolve({}),
}));
vi.mock("@/lib/features/experiences/api", () => ({
  useSetExperiencePreferenceMutation: vi.fn(() => [mockSetPreference]),
}));

// Mock MUI Joy styles
vi.mock("@mui/joy/styles", () => ({
  useColorScheme: vi.fn(() => ({
    mode: "light",
    setMode: vi.fn(),
  })),
}));

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

describe("themePreferenceHooks", () => {
  const originalWindow = global.window;
  const originalFetch = global.fetch;
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage = {};

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
      },
      writable: true,
    });

    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            experience: "modern",
            colorMode: "light",
          }),
      })
    ) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("useThemePreferenceActions", () => {
    it("should return persistPreference function", async () => {
      const { useThemePreferenceActions } = await import(
        "./themePreferenceHooks"
      );
      const { result } = renderHook(() => useThemePreferenceActions());

      expect(typeof result.current.persistPreference).toBe("function");
    });

    it("should call localStorage setItem when persisting preference", async () => {
      const { useThemePreferenceActions } = await import(
        "./themePreferenceHooks"
      );
      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("modern-dark");
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "wxyc_app_skin",
        "modern-dark"
      );
    });

    it("should call setPreference mutation when persisting", async () => {
      const { useThemePreferenceActions } = await import(
        "./themePreferenceHooks"
      );
      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("classic-light");
      });

      expect(mockSetPreference).toHaveBeenCalledWith({
        preference: "classic-light",
      });
    });

    it("should call updateUser when updateUser option is true and user is logged in", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.useSession).mockReturnValue({
        data: { user: { id: "user-123" } },
      } as any);

      const { useThemePreferenceActions } = await import(
        "./themePreferenceHooks"
      );
      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("modern-dark", {
          updateUser: true,
        });
      });

      expect(authClient.updateUser).toHaveBeenCalledWith({
        appSkin: "modern-dark",
      });
    });

    it("should not call updateUser when updateUser option is false", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.useSession).mockReturnValue({
        data: { user: { id: "user-123" } },
      } as any);

      const { useThemePreferenceActions } = await import(
        "./themePreferenceHooks"
      );
      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("modern-dark", {
          updateUser: false,
        });
      });

      expect(authClient.updateUser).not.toHaveBeenCalled();
    });

    it("should handle setPreference error gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockSetPreference.mockImplementationOnce(() => ({
        unwrap: () => Promise.reject(new Error("API Error")),
      }));

      const { useThemePreferenceActions } = await import(
        "./themePreferenceHooks"
      );
      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("modern-dark");
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to update app_state preference:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("buildPreference", () => {
    it("should build classic-light preference", async () => {
      const { buildPreference } = await import("./themePreferenceHooks");
      expect(buildPreference("classic", "light")).toBe("classic-light");
    });

    it("should build classic-dark preference", async () => {
      const { buildPreference } = await import("./themePreferenceHooks");
      expect(buildPreference("classic", "dark")).toBe("classic-dark");
    });

    it("should build modern-light preference", async () => {
      const { buildPreference } = await import("./themePreferenceHooks");
      expect(buildPreference("modern", "light")).toBe("modern-light");
    });

    it("should build modern-dark preference", async () => {
      const { buildPreference } = await import("./themePreferenceHooks");
      expect(buildPreference("modern", "dark")).toBe("modern-dark");
    });
  });

  describe("useThemePreferenceSync", () => {
    it("should be a callable hook", async () => {
      const { useThemePreferenceSync } = await import("./themePreferenceHooks");
      expect(typeof useThemePreferenceSync).toBe("function");
    });

    it("should render without errors when mode is null", async () => {
      const { useColorScheme } = await import("@mui/joy/styles");
      vi.mocked(useColorScheme).mockReturnValue({
        mode: null,
        setMode: vi.fn(),
      } as any);

      const { useThemePreferenceSync } = await import("./themePreferenceHooks");

      // Should not throw
      expect(() => renderHook(() => useThemePreferenceSync())).not.toThrow();
    });

    it("should render with light mode without errors", async () => {
      const mockSetMode = vi.fn();
      const { useColorScheme } = await import("@mui/joy/styles");
      vi.mocked(useColorScheme).mockReturnValue({
        mode: "light",
        setMode: mockSetMode,
      } as any);

      const { useThemePreferenceSync } = await import("./themePreferenceHooks");

      expect(() => renderHook(() => useThemePreferenceSync())).not.toThrow();
    });

    it("should read from localStorage when available", async () => {
      mockLocalStorage["wxyc_app_skin"] = "modern-dark";

      const mockSetMode = vi.fn();
      const { useColorScheme } = await import("@mui/joy/styles");
      vi.mocked(useColorScheme).mockReturnValue({
        mode: "light",
        setMode: mockSetMode,
      } as any);

      const { useThemePreferenceSync } = await import("./themePreferenceHooks");

      renderHook(() => useThemePreferenceSync());

      await waitFor(() => {
        expect(window.localStorage.getItem).toHaveBeenCalledWith("wxyc_app_skin");
      });
    });

    it("should use user appSkin preference when available", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      vi.mocked(authClient.useSession).mockReturnValue({
        data: { user: { id: "user-123", appSkin: "classic-dark" } },
      } as any);

      const mockSetMode = vi.fn();
      const { useColorScheme } = await import("@mui/joy/styles");
      vi.mocked(useColorScheme).mockReturnValue({
        mode: "light",
        setMode: mockSetMode,
      } as any);

      const { useThemePreferenceSync } = await import("./themePreferenceHooks");

      renderHook(() => useThemePreferenceSync());

      await waitFor(() => {
        expect(mockSetMode).toHaveBeenCalledWith("dark");
      });
    });
  });

  describe("localStorage error handling", () => {
    it("should handle localStorage getItem error gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      Object.defineProperty(window, "localStorage", {
        value: {
          getItem: vi.fn(() => {
            throw new Error("localStorage error");
          }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const mockSetMode = vi.fn();
      const { useColorScheme } = await import("@mui/joy/styles");
      vi.mocked(useColorScheme).mockReturnValue({
        mode: "light",
        setMode: mockSetMode,
      } as any);

      const { useThemePreferenceSync } = await import("./themePreferenceHooks");

      expect(() => renderHook(() => useThemePreferenceSync())).not.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle localStorage setItem error gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      Object.defineProperty(window, "localStorage", {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(() => {
            throw new Error("localStorage write error");
          }),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const { useThemePreferenceActions } = await import(
        "./themePreferenceHooks"
      );
      const { result } = renderHook(() => useThemePreferenceActions());

      await act(async () => {
        await result.current.persistPreference("modern-dark");
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to write app skin to localStorage:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("fetch error handling", () => {
    it("should handle fetch error when fetching app state", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network error"))
      ) as any;

      const mockSetMode = vi.fn();
      const { useColorScheme } = await import("@mui/joy/styles");
      vi.mocked(useColorScheme).mockReturnValue({
        mode: "light",
        setMode: mockSetMode,
      } as any);

      const { useThemePreferenceSync } = await import("./themePreferenceHooks");

      expect(() => renderHook(() => useThemePreferenceSync())).not.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle non-ok fetch response", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        })
      ) as any;

      const mockSetMode = vi.fn();
      const { useColorScheme } = await import("@mui/joy/styles");
      vi.mocked(useColorScheme).mockReturnValue({
        mode: "light",
        setMode: mockSetMode,
      } as any);

      const { useThemePreferenceSync } = await import("./themePreferenceHooks");

      expect(() => renderHook(() => useThemePreferenceSync())).not.toThrow();
    });
  });
});
