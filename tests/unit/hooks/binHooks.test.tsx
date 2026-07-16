import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// --- Mocks for useClearBin's dependencies ---
const mockUseRegistry = vi.fn();
const mockUseGetBinQuery = vi.fn();
const toastError = vi.fn();

// Records every deleteFromBin({ dj_id, album_id }) call; unwrap rejects for ids in `failIds`.
const failIds = new Set<number>();
const deleteTrigger = vi.fn((arg: { dj_id: string; album_id: number }) => ({
  unwrap: () =>
    failIds.has(arg.album_id)
      ? Promise.reject(new Error("delete failed"))
      : Promise.resolve(),
}));

// Same shape for useAddToBin's mutation trigger; unwrap rejects for ids in `addFailIds`.
const addFailIds = new Set<number>();
const addTrigger = vi.fn((arg: { dj_id: string; album_id: number }) => ({
  unwrap: () =>
    addFailIds.has(arg.album_id)
      ? Promise.reject(new Error("add failed"))
      : Promise.resolve(),
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => mockUseRegistry(),
}));

vi.mock("@/lib/features/bin/api", () => ({
  useGetBinQuery: (...args: unknown[]) => mockUseGetBinQuery(...args),
  useDeleteFromBinMutation: () => [deleteTrigger, { isLoading: false }],
  useAddToBinMutation: () => [addTrigger, { isLoading: false }],
}));

vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a) },
}));

import { useClearBin, useAddToBin, useDeleteFromBin } from "@/src/hooks/binHooks";

// Flushes the microtask queue past the mutate().unwrap().catch() chain in
// useBinMutation's action callback, which isn't awaited by the caller.
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

const entry = (id: number) => ({ id, title: `Album ${id}` }) as AlbumEntry;

function setBin(bin: AlbumEntry[] | undefined) {
  mockUseGetBinQuery.mockReturnValue({
    data: bin,
    isLoading: false,
    isSuccess: true,
    isError: false,
  });
}

describe("useClearBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failIds.clear();
    mockUseRegistry.mockReturnValue({ loading: false, info: { id: "dj1" } });
    setBin([entry(1), entry(2), entry(3)]);
  });

  it("fires a delete for every bin entry, scoped to the current dj", async () => {
    const { result } = renderHook(() => useClearBin());

    await act(async () => {
      await result.current.clearBin();
    });

    expect(deleteTrigger).toHaveBeenCalledTimes(3);
    expect(deleteTrigger).toHaveBeenCalledWith({ dj_id: "dj1", album_id: 1 });
    expect(deleteTrigger).toHaveBeenCalledWith({ dj_id: "dj1", album_id: 2 });
    expect(deleteTrigger).toHaveBeenCalledWith({ dj_id: "dj1", album_id: 3 });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts once when any delete fails, naming the album, after attempting them all", async () => {
    failIds.add(2);
    const { result } = renderHook(() => useClearBin());

    await act(async () => {
      await result.current.clearBin();
    });

    expect(deleteTrigger).toHaveBeenCalledTimes(3); // allSettled: others still fire
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Couldn't remove Album 2 from the bin"
    );
  });

  it("summarizes overflow when more than three deletes fail", async () => {
    setBin([entry(1), entry(2), entry(3), entry(4), entry(5)]);
    [1, 2, 3, 4, 5].forEach((id) => failIds.add(id));
    const { result } = renderHook(() => useClearBin());

    await act(async () => {
      await result.current.clearBin();
    });

    expect(toastError).toHaveBeenCalledWith(
      "Couldn't remove Album 1, Album 2, Album 3 and 2 more from the bin"
    );
  });

  it("is a no-op when the bin is empty", async () => {
    setBin([]);
    const { result } = renderHook(() => useClearBin());

    await act(async () => {
      await result.current.clearBin();
    });

    expect(deleteTrigger).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("is a no-op when the registry has no dj yet", async () => {
    mockUseRegistry.mockReturnValue({ loading: false, info: undefined });
    const { result } = renderHook(() => useClearBin());

    await act(async () => {
      await result.current.clearBin();
    });

    expect(deleteTrigger).not.toHaveBeenCalled();
  });
});

describe("useAddToBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addFailIds.clear();
    mockUseRegistry.mockReturnValue({ loading: false, info: { id: "dj1" } });
  });

  it("does not toast when the add mutation succeeds", async () => {
    const { result } = renderHook(() => useAddToBin());

    await act(async () => {
      result.current.addToBin(1);
      await flushMicrotasks();
    });

    expect(addTrigger).toHaveBeenCalledWith({ dj_id: "dj1", album_id: 1 });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts once with the add-failure message when the add mutation fails", async () => {
    addFailIds.add(1);
    const { result } = renderHook(() => useAddToBin());

    await act(async () => {
      result.current.addToBin(1);
      await flushMicrotasks();
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Failed to add album to bin");
  });
});

describe("useDeleteFromBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failIds.clear();
    mockUseRegistry.mockReturnValue({ loading: false, info: { id: "dj1" } });
  });

  it("does not toast when the delete mutation succeeds", async () => {
    const { result } = renderHook(() => useDeleteFromBin());

    await act(async () => {
      result.current.deleteFromBin(1);
      await flushMicrotasks();
    });

    expect(deleteTrigger).toHaveBeenCalledWith({ dj_id: "dj1", album_id: 1 });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts once with the remove-failure message when the delete mutation fails", async () => {
    failIds.add(1);
    const { result } = renderHook(() => useDeleteFromBin());

    await act(async () => {
      result.current.deleteFromBin(1);
      await flushMicrotasks();
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Failed to remove album from bin");
  });
});
