import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import type { AppStore } from "@/lib/store";
import {
  useWindowSize,
  usePublicRoutes,
  useShiftKey,
  useAlbumImages,
  resetApplication,
} from "./applicationHooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { catalogSlice } from "@/lib/features/catalog/frontend";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/flowsheet"),
}));

// Mock artwork functions to avoid network calls
vi.mock("./artwork/discogs-image", () => ({
  default: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("./artwork/itunes-image", () => ({
  default: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("./artwork/last-fm-image", () => ({
  default: vi.fn(() => Promise.resolve(null)),
}));

describe("applicationHooks", () => {
  let store: AppStore;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  beforeEach(() => {
    store = makeStore();
    vi.clearAllMocks();
  });

  describe("useWindowSize", () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    afterEach(() => {
      Object.defineProperty(window, "innerWidth", {
        value: originalInnerWidth,
        writable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: originalInnerHeight,
        writable: true,
      });
    });

    it("should return current window dimensions", async () => {
      Object.defineProperty(window, "innerWidth", {
        value: 1024,
        writable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: 768,
        writable: true,
      });

      const { result } = renderHook(() => useWindowSize());

      await waitFor(() => {
        expect(result.current.width).toBe(1024);
        expect(result.current.height).toBe(768);
      });
    });

    it("should update dimensions on window resize", async () => {
      const { result } = renderHook(() => useWindowSize());

      await act(async () => {
        Object.defineProperty(window, "innerWidth", {
          value: 1920,
          writable: true,
        });
        Object.defineProperty(window, "innerHeight", {
          value: 1080,
          writable: true,
        });
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(result.current.width).toBe(1920);
        expect(result.current.height).toBe(1080);
      });
    });
  });

  describe("usePublicRoutes", () => {
    it("should return false for protected routes", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/flowsheet");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(false);
    });

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

    it("should return true for root path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(true);
    });

    it("should return true for empty path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(true);
    });

    it("should return false for /admin route", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/admin");

      const { result } = renderHook(() => usePublicRoutes());

      expect(result.current).toBe(false);
    });
  });

  describe("useShiftKey", () => {
    it("should return false initially", () => {
      const { result } = renderHook(() => useShiftKey());
      expect(result.current).toBe(false);
    });

    it("should return true when Shift key is pressed", async () => {
      const { result } = renderHook(() => useShiftKey());

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
      });

      expect(result.current).toBe(true);
    });

    it("should return false when Shift key is released", async () => {
      const { result } = renderHook(() => useShiftKey());

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
      });
      expect(result.current).toBe(true);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
      });

      expect(result.current).toBe(false);
    });

    it("should not respond to other keys", async () => {
      const { result } = renderHook(() => useShiftKey());

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      });

      expect(result.current).toBe(false);
    });
  });

  describe("useAlbumImages", () => {
    beforeEach(async () => {
      // Reset all artwork mocks to return null by default
      const discogs = await import("./artwork/discogs-image");
      const itunes = await import("./artwork/itunes-image");
      const lastfm = await import("./artwork/last-fm-image");
      vi.mocked(discogs.default).mockResolvedValue(null);
      vi.mocked(itunes.default).mockResolvedValue(null);
      vi.mocked(lastfm.default).mockResolvedValue(null);
    });

    it("should return default URL initially", () => {
      const { result } = renderHook(() => useAlbumImages());

      expect(result.current.url).toBe("/img/cassette.png");
      expect(result.current.loading).toBe(false);
    });

    it("should return setAlbum and setArtist functions", () => {
      const { result } = renderHook(() => useAlbumImages());

      expect(typeof result.current.setAlbum).toBe("function");
      expect(typeof result.current.setArtist).toBe("function");
    });

    it("should return default URL when album is not set", async () => {
      const { result } = renderHook(() => useAlbumImages());

      await act(async () => {
        result.current.setArtist("Test Artist");
      });

      await waitFor(() => {
        expect(result.current.url).toBe("/img/cassette.png");
      });
    });

    it("should return default URL when artist is not set", async () => {
      const { result } = renderHook(() => useAlbumImages());

      await act(async () => {
        result.current.setAlbum("Test Album");
      });

      await waitFor(() => {
        expect(result.current.url).toBe("/img/cassette.png");
      });
    });

    it("should fetch artwork when both album and artist are set", async () => {
      const discogs = await import("./artwork/discogs-image");
      vi.mocked(discogs.default).mockResolvedValue("https://example.com/artwork.jpg");

      const { result } = renderHook(() => useAlbumImages());

      await act(async () => {
        result.current.setAlbum("Test Album");
        result.current.setArtist("Test Artist");
      });

      await waitFor(() => {
        expect(result.current.url).toBe("https://example.com/artwork.jpg");
      });
    });

    it("should try second source when first returns null", async () => {
      const discogs = await import("./artwork/discogs-image");
      const itunes = await import("./artwork/itunes-image");
      vi.mocked(discogs.default).mockResolvedValue(null);
      vi.mocked(itunes.default).mockResolvedValue("https://itunes.com/artwork.jpg");

      const { result } = renderHook(() => useAlbumImages());

      await act(async () => {
        result.current.setAlbum("Test Album");
        result.current.setArtist("Test Artist");
      });

      await waitFor(() => {
        // May return itunes or lastfm result depending on random order
        expect(result.current.url).not.toBe("/img/cassette.png");
      }, { timeout: 2000 });
    });

    it("should return default URL when all sources fail", async () => {
      const discogs = await import("./artwork/discogs-image");
      const itunes = await import("./artwork/itunes-image");
      const lastfm = await import("./artwork/last-fm-image");
      vi.mocked(discogs.default).mockResolvedValue(null);
      vi.mocked(itunes.default).mockResolvedValue(null);
      vi.mocked(lastfm.default).mockResolvedValue(null);

      const { result } = renderHook(() => useAlbumImages());

      await act(async () => {
        result.current.setAlbum("Unknown Album");
        result.current.setArtist("Unknown Artist");
      });

      await waitFor(() => {
        expect(result.current.url).toBe("/img/cassette.png");
      });
    });

    it("should call artwork functions with correct parameters", async () => {
      const discogs = await import("./artwork/discogs-image");
      vi.mocked(discogs.default).mockResolvedValue("https://example.com/artwork.jpg");

      const { result } = renderHook(() => useAlbumImages());

      await act(async () => {
        result.current.setAlbum("My Album");
        result.current.setArtist("My Artist");
      });

      await waitFor(() => {
        expect(vi.mocked(discogs.default)).toHaveBeenCalledWith({
          title: "My Album",
          artist: "My Artist",
        });
      });
    });
  });

  describe("resetApplication", () => {
    it("should reset flowsheet slice state", () => {
      // Set some state
      store.dispatch(flowsheetSlice.actions.setAutoplay(true));
      expect(flowsheetSlice.selectors.getAutoplay(store.getState())).toBe(true);

      // Reset
      resetApplication(store.dispatch);

      // Verify reset
      expect(flowsheetSlice.selectors.getAutoplay(store.getState())).toBe(
        false
      );
    });

    it("should reset catalog slice state", () => {
      // Set some state
      store.dispatch(catalogSlice.actions.setSearchQuery("test query"));
      expect(catalogSlice.selectors.getSearchQuery(store.getState())).toBe(
        "test query"
      );

      // Reset
      resetApplication(store.dispatch);

      // Verify reset
      expect(catalogSlice.selectors.getSearchQuery(store.getState())).toBe("");
    });

    it("should reset multiple slices at once", () => {
      // Set state on multiple slices
      store.dispatch(flowsheetSlice.actions.setAutoplay(true));
      store.dispatch(catalogSlice.actions.setSearchQuery("test"));

      // Reset
      resetApplication(store.dispatch);

      // Verify all are reset
      expect(flowsheetSlice.selectors.getAutoplay(store.getState())).toBe(
        false
      );
      expect(catalogSlice.selectors.getSearchQuery(store.getState())).toBe("");
    });
  });
});
