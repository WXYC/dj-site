import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useWindowSize,
  usePublicRoutes,
  useShiftKey,
  resetApplication,
} from "./applicationHooks";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

// Mock Redux hooks
vi.mock("@/lib/hooks", () => ({
  useAppDispatch: vi.fn(() => vi.fn()),
}));

// Mock APIs and slices
vi.mock("@/lib/features/flowsheet/api", () => ({
  flowsheetApi: {
    util: {
      resetApiState: vi.fn(() => ({ type: "flowsheet/reset" })),
    },
  },
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    actions: {
      reset: vi.fn(() => ({ type: "flowsheet/sliceReset" })),
    },
  },
}));

vi.mock("@/lib/features/catalog/api", () => ({
  catalogApi: {
    util: {
      resetApiState: vi.fn(() => ({ type: "catalog/reset" })),
    },
  },
}));

vi.mock("@/lib/features/catalog/frontend", () => ({
  catalogSlice: {
    actions: {
      reset: vi.fn(() => ({ type: "catalog/sliceReset" })),
    },
  },
}));

vi.mock("@/lib/features/bin/api", () => ({
  binApi: {
    util: {
      resetApiState: vi.fn(() => ({ type: "bin/reset" })),
    },
  },
}));

vi.mock("@/lib/features/authentication/frontend", () => ({
  authenticationSlice: {
    actions: {
      reset: vi.fn(() => ({ type: "auth/reset" })),
    },
  },
}));

describe("applicationHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useWindowSize", () => {
    it("should return width and height properties", () => {
      const { result } = renderHook(() => useWindowSize());

      // Hook should return an object with width and height
      expect(result.current).toHaveProperty("width");
      expect(result.current).toHaveProperty("height");
    });

    it("should update on window resize", async () => {
      // Set initial window size
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 1024,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        value: 768,
      });

      const { result } = renderHook(() => useWindowSize());

      await waitFor(() => {
        expect(result.current.width).toBe(1024);
        expect(result.current.height).toBe(768);
      });
    });

    it("should respond to resize events", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 1024,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        value: 768,
      });

      const { result } = renderHook(() => useWindowSize());

      await waitFor(() => {
        expect(result.current.width).toBe(1024);
      });

      // Simulate resize
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          value: 800,
        });
        Object.defineProperty(window, "innerHeight", {
          writable: true,
          value: 600,
        });
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(result.current.width).toBe(800);
        expect(result.current.height).toBe(600);
      });
    });
  });

  describe("usePublicRoutes", () => {
    it("should return true for /live route", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/live");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(true);
    });

    it("should return true for /login route", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/login");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(true);
    });

    it("should return true for root route", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(true);
    });

    it("should return false for /dashboard route", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/dashboard");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(false);
    });

    it("should return false for /dashboard/catalog route", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/dashboard/catalog");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(false);
    });
  });

  describe("useShiftKey", () => {
    it("should return false initially", () => {
      const { result } = renderHook(() => useShiftKey());

      expect(result.current).toBe(false);
    });

    it("should return true when shift key is pressed", async () => {
      const { result } = renderHook(() => useShiftKey());

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it("should return false when shift key is released", async () => {
      const { result } = renderHook(() => useShiftKey());

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
      });

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it("should not change state for other keys", async () => {
      const { result } = renderHook(() => useShiftKey());

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      });

      expect(result.current).toBe(false);
    });
  });

  describe("resetApplication", () => {
    it("should dispatch reset actions for all slices", () => {
      const mockDispatch = vi.fn();

      resetApplication(mockDispatch);

      // Should dispatch multiple reset actions
      expect(mockDispatch).toHaveBeenCalled();
    });
  });
});
