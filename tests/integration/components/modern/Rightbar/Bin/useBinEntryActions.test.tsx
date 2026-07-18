import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Unarchive } from "@mui/icons-material";
import type { AlbumEntry } from "@/lib/features/catalog/types";

const push = vi.fn();
const addToQueue = vi.fn();
const addToFlowsheet = vi.fn(() => Promise.resolve());
const deleteFromBin = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/features/bin/conversions", () => ({
  convertBinToQueue: (e: AlbumEntry) => ({ q: e.id }),
  convertBinToFlowsheet: (e: AlbumEntry) => ({ f: e.id }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useBinEntryActions } from "@/src/components/experiences/modern/Rightbar/Bin/useBinEntryActions";

const entry = { id: 7, title: "DOGA" } as AlbumEntry;
// The write callbacks are hoisted in BinContent and passed down; the hook
// itself no longer runs useQueue/useFlowsheet/useDeleteFromBin per row.
const deps = { addToQueue, addToFlowsheet, deleteFromBin };

describe("useBinEntryActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers info + remove when not live", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, false, deps));
    expect(result.current.map((a) => a.id)).toEqual(["info", "remove"]);
  });

  it("adds queue + play when live", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    expect(result.current.map((a) => a.id)).toEqual([
      "info",
      "queue",
      "play",
      "remove",
    ]);
  });

  it("wires each run handler to the right effect", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.info.run();
    expect(push).toHaveBeenCalledWith("/dashboard/album/7");

    byId.queue.run();
    expect(addToQueue).toHaveBeenCalledWith({ q: 7 });

    byId.play.run();
    expect(addToFlowsheet).toHaveBeenCalledWith({ f: 7 });

    byId.remove.run();
    expect(deleteFromBin).toHaveBeenCalledWith(7);
  });

  it("uses the Unarchive icon for remove, matching RemoveFromBin", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, false, deps));
    const remove = result.current.find((a) => a.id === "remove");
    expect(remove?.Icon).toBe(Unarchive);
  });

  it("marks queue and play as Shift-removable, but not info/remove", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));
    expect(byId.queue.shiftRemoves).toBe(true);
    expect(byId.play.shiftRemoves).toBe(true);
    expect(byId.info.shiftRemoves).toBeUndefined();
    expect(byId.remove.shiftRemoves).toBeUndefined();
  });

  it("Shift+click on queue also removes the album from the bin", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.queue.run({ shiftKey: true });
    expect(addToQueue).toHaveBeenCalledWith({ q: 7 });
    expect(deleteFromBin).toHaveBeenCalledWith(7);
  });

  it("Shift+click on play removes only after the flowsheet add succeeds", async () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.play.run({ shiftKey: true });
    expect(deleteFromBin).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(deleteFromBin).toHaveBeenCalledWith(7);
  });

  it("does not remove from bin when the flowsheet add fails", async () => {
    addToFlowsheet.mockImplementationOnce(() => Promise.reject("nope"));
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.play.run({ shiftKey: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(deleteFromBin).not.toHaveBeenCalled();
  });

  it("plain click on queue/play leaves the album in the bin", async () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.queue.run();
    byId.play.run();
    await Promise.resolve();
    await Promise.resolve();
    expect(deleteFromBin).not.toHaveBeenCalled();
  });
});
