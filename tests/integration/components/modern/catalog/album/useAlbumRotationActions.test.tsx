import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";

const addTrigger = vi.fn();
const killTrigger = vi.fn();

// `@/tests/helpers` pulls in the real store, which registers `rotationApi`'s
// reducer/middleware directly -- only the mutation hooks are faked here.
vi.mock("@/lib/features/rotation/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/rotation/api")>();
  return {
    ...actual,
    useAddRotationEntryMutation: () => [addTrigger],
    useKillRotationEntryMutation: () => [killTrigger],
  };
});

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import { useAlbumRotationActions } from "@/src/components/experiences/modern/catalog/album/useAlbumRotationActions";

const album = createTestAlbum({
  id: 4242,
  title: "DOGA",
  artist: createTestArtist({ name: "Juana Molina" }),
});

function okTrigger(response: unknown = {}) {
  return vi.fn(() => ({ unwrap: () => Promise.resolve(response) }));
}

function failingTrigger(err: unknown) {
  return vi.fn(() => ({ unwrap: () => Promise.reject(err) }));
}

describe("useAlbumRotationActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setRotation", () => {
    it("adds with no prior entries to retire", async () => {
      addTrigger.mockImplementation(okTrigger());
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation("H", []);
      });

      expect(killTrigger).not.toHaveBeenCalled();
      expect(addTrigger).toHaveBeenCalledWith({ album_id: 4242, rotation_bin: "H" });
      expect(toastSuccessMock).toHaveBeenCalledWith("Marked for H rotation.");
    });

    it("retires every active entry before adding the new bin", async () => {
      addTrigger.mockImplementation(okTrigger());
      killTrigger.mockImplementation(okTrigger());
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation("M", [
          { rotation_id: 900 },
          { rotation_id: 901 },
        ]);
      });

      expect(killTrigger).toHaveBeenCalledTimes(2);
      expect(killTrigger).toHaveBeenCalledWith({ rotation_id: 900 });
      expect(killTrigger).toHaveBeenCalledWith({ rotation_id: 901 });
      expect(addTrigger).toHaveBeenCalledWith({ album_id: 4242, rotation_bin: "M" });
      expect(toastSuccessMock).toHaveBeenCalledWith("Marked for M rotation.");
    });

    it("retires without adding when the bin is cleared", async () => {
      killTrigger.mockImplementation(okTrigger());
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation(null, [{ rotation_id: 900 }]);
      });

      expect(killTrigger).toHaveBeenCalledWith({ rotation_id: 900 });
      expect(addTrigger).not.toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalledWith("Removed from rotation.");
    });

    it("is a no-op with no active entries and no bin picked", async () => {
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation(null, []);
      });

      expect(killTrigger).not.toHaveBeenCalled();
      expect(addTrigger).not.toHaveBeenCalled();
      expect(toastSuccessMock).not.toHaveBeenCalled();
    });

    it("toasts one generic error when the add fails, matching the context menu's copy", async () => {
      addTrigger.mockImplementation(failingTrigger({ status: 500 }));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation("H", []);
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Could not update rotation.");
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });

    it("toasts once, not twice, when the retire step fails before the add is attempted", async () => {
      killTrigger.mockImplementation(failingTrigger({ status: 500 }));
      addTrigger.mockImplementation(okTrigger());
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation("H", [{ rotation_id: 900 }]);
      });

      expect(addTrigger).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith("Could not update rotation.");
    });

    it("leaves a non-JSON failure to the middleware's own toast", async () => {
      addTrigger.mockImplementation(
        failingTrigger({ status: "PARSING_ERROR", data: "<html>404</html>" }),
      );
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation("H", []);
      });

      expect(toastErrorMock).not.toHaveBeenCalled();
    });

    it("tracks isSettingRotation across the retire-then-add sequence", async () => {
      let resolveAdd!: () => void;
      addTrigger.mockImplementation(() => ({
        unwrap: () => new Promise<void>((resolve) => (resolveAdd = resolve)),
      }));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      expect(result.current.isSettingRotation).toBe(false);
      let settled: Promise<void>;
      act(() => {
        settled = result.current.setRotation("H", []);
      });

      await waitFor(() => expect(result.current.isSettingRotation).toBe(true));
      await act(async () => {
        resolveAdd();
        await settled;
      });
      expect(result.current.isSettingRotation).toBe(false);
    });
  });

  describe("kill", () => {
    it("kills a single entry by rotation id", async () => {
      killTrigger.mockImplementation(okTrigger());
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.kill(900);
      });

      expect(killTrigger).toHaveBeenCalledWith({ rotation_id: 900 });
      expect(addTrigger).not.toHaveBeenCalled();
    });

    it("toasts the shared error copy on failure", async () => {
      killTrigger.mockImplementation(failingTrigger({ status: 500 }));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.kill(900);
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Could not update rotation.");
    });

    it("marks only the killed row's id busy while its request is in flight", async () => {
      let resolveKill!: () => void;
      killTrigger.mockImplementation(() => ({
        unwrap: () => new Promise<void>((resolve) => (resolveKill = resolve)),
      }));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      expect(result.current.isKilling(900)).toBe(false);
      let settled: Promise<void>;
      act(() => {
        settled = result.current.kill(900);
      });

      await waitFor(() => expect(result.current.isKilling(900)).toBe(true));
      expect(result.current.isKilling(901)).toBe(false);

      await act(async () => {
        resolveKill();
        await settled;
      });
      expect(result.current.isKilling(900)).toBe(false);
    });
  });
});
