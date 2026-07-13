import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { AlbumEntry } from "@/lib/features/catalog/types";

const dispatch = vi.fn();
const addToQueue = vi.fn();
const addToFlowsheet = vi.fn();
const deleteFromBin = vi.fn();

vi.mock("@/lib/hooks", () => ({ useAppDispatch: () => dispatch }));
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useQueue: () => ({ addToQueue }),
  useFlowsheet: () => ({ addToFlowsheet }),
}));
vi.mock("@/src/hooks/binHooks", () => ({
  useDeleteFromBin: () => ({ deleteFromBin }),
}));
vi.mock("@/lib/features/bin/conversions", () => ({
  convertBinToQueue: (e: AlbumEntry) => ({ q: e.id }),
  convertBinToFlowsheet: (e: AlbumEntry) => ({ f: e.id }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/lib/features/application/frontend", () => ({
  applicationSlice: {
    actions: { openPanel: (p: unknown) => ({ type: "openPanel", payload: p }) },
  },
}));

import { useBinEntryActions } from "./useBinEntryActions";

const entry = { id: 7, title: "DOGA" } as AlbumEntry;

describe("useBinEntryActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers info + remove when not live", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, false));
    expect(result.current.map((a) => a.id)).toEqual(["info", "remove"]);
  });

  it("adds queue + play when live", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true));
    expect(result.current.map((a) => a.id)).toEqual([
      "info",
      "queue",
      "play",
      "remove",
    ]);
  });

  it("wires each run handler to the right effect", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.info.run();
    expect(dispatch).toHaveBeenCalledWith({
      type: "openPanel",
      payload: { type: "album-detail", albumId: 7 },
    });

    byId.queue.run();
    expect(addToQueue).toHaveBeenCalledWith({ q: 7 });

    byId.play.run();
    expect(addToFlowsheet).toHaveBeenCalledWith({ f: 7 });

    byId.remove.run();
    expect(deleteFromBin).toHaveBeenCalledWith(7);
  });
});
