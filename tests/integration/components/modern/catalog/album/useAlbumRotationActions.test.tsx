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

/** A kill that rejects only for the listed rotation ids. */
function triggerFailingFor(rotationIds: number[], err: unknown = { status: 500 }) {
  return vi.fn(({ rotation_id }: { rotation_id: number }) => ({
    unwrap: () =>
      rotationIds.includes(rotation_id)
        ? Promise.reject(err)
        : Promise.resolve({}),
  }));
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

    it("adds the new bin before retiring every active entry", async () => {
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
      // The order is the safety property, not an implementation detail: it is
      // what keeps a failed add from leaving the album in no bin at all.
      expect(addTrigger.mock.invocationCallOrder[0]).toBeLessThan(
        killTrigger.mock.invocationCallOrder[0],
      );
    });

    it("retires nothing when the add fails, leaving the prior bin in place", async () => {
      addTrigger.mockImplementation(failingTrigger({ status: 500 }));
      killTrigger.mockImplementation(okTrigger());
      const { result } = renderHook(() => useAlbumRotationActions(album));

      let outcome: boolean | undefined;
      await act(async () => {
        outcome = await result.current.setRotation("M", [{ rotation_id: 900 }]);
      });

      expect(killTrigger).not.toHaveBeenCalled();
      expect(outcome).toBe(false);
      expect(toastErrorMock).toHaveBeenCalledWith("Could not update rotation.");
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

    it("names the half that landed when the retire fails after a successful add", async () => {
      killTrigger.mockImplementation(failingTrigger({ status: 500 }));
      addTrigger.mockImplementation(okTrigger());
      const { result } = renderHook(() => useAlbumRotationActions(album));

      let outcome: boolean | undefined;
      await act(async () => {
        outcome = await result.current.setRotation("H", [{ rotation_id: 900 }]);
      });

      expect(addTrigger).toHaveBeenCalledWith({ album_id: 4242, rotation_bin: "H" });
      expect(outcome).toBe(false);
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Marked for H rotation, but could not retire every previous bin — the album is in 2 bins.",
      );
      expect(toastSuccessMock).not.toHaveBeenCalled();
    });

    // A loop that stops at the first rejection leaves later entries unretired
    // and unattempted, so an album in two bins ends up in three while the
    // operator is told about one.
    it("attempts every retire after one of them fails", async () => {
      addTrigger.mockImplementation(okTrigger());
      killTrigger.mockImplementation(triggerFailingFor([900]));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation("L", [
          { rotation_id: 900 },
          { rotation_id: 901 },
        ]);
      });

      expect(killTrigger).toHaveBeenCalledTimes(2);
      expect(killTrigger).toHaveBeenCalledWith({ rotation_id: 900 });
      expect(killTrigger).toHaveBeenCalledWith({ rotation_id: 901 });
    });

    it("counts the bins the album is left in when every retire fails", async () => {
      addTrigger.mockImplementation(okTrigger());
      killTrigger.mockImplementation(failingTrigger({ status: 500 }));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      let outcome: boolean | undefined;
      await act(async () => {
        outcome = await result.current.setRotation("L", [
          { rotation_id: 900 },
          { rotation_id: 901 },
        ]);
      });

      expect(outcome).toBe(false);
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Marked for L rotation, but could not retire every previous bin — the album is in 3 bins.",
      );
    });

    it("reports the surviving bin when a clear retires some entries and not others", async () => {
      killTrigger.mockImplementation(triggerFailingFor([901]));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      let outcome: boolean | undefined;
      await act(async () => {
        outcome = await result.current.setRotation(null, [
          { rotation_id: 900 },
          { rotation_id: 901 },
        ]);
      });

      expect(outcome).toBe(false);
      expect(addTrigger).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Could not retire every bin — the album is still in 1 bin.",
      );
      expect(toastSuccessMock).not.toHaveBeenCalled();
    });

    it("keeps the generic copy when a clear retires nothing at all", async () => {
      killTrigger.mockImplementation(failingTrigger({ status: 500 }));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      await act(async () => {
        await result.current.setRotation(null, [{ rotation_id: 900 }]);
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Could not update rotation.");
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });

    it("leaves a non-JSON retire failure to the middleware's own toast", async () => {
      addTrigger.mockImplementation(okTrigger());
      killTrigger.mockImplementation(
        failingTrigger({ status: "PARSING_ERROR", data: "<html>404</html>" }),
      );
      const { result } = renderHook(() => useAlbumRotationActions(album));

      let outcome: boolean | undefined;
      await act(async () => {
        outcome = await result.current.setRotation("H", [{ rotation_id: 900 }]);
      });

      expect(outcome).toBe(false);
      expect(toastErrorMock).not.toHaveBeenCalled();
      expect(toastSuccessMock).not.toHaveBeenCalled();
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

    it("tracks isSettingRotation across the add-then-retire sequence", async () => {
      let resolveAdd!: () => void;
      addTrigger.mockImplementation(() => ({
        unwrap: () => new Promise<void>((resolve) => (resolveAdd = resolve)),
      }));
      const { result } = renderHook(() => useAlbumRotationActions(album));

      expect(result.current.isSettingRotation).toBe(false);
      let settled: Promise<boolean>;
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
