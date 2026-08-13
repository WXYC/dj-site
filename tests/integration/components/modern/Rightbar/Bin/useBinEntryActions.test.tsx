import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Unarchive } from "@mui/icons-material";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import {
  MISSING_ARTIST_BIN_PLAY_MESSAGE,
  VARIOUS_ARTISTS_BIN_PLAY_MESSAGE,
} from "@/lib/features/flowsheet/various-artists-guard";

const dispatch = vi.fn();
const addToQueue = vi.fn();
const addToFlowsheet = vi.fn(() => Promise.resolve());
const deleteFromBin = vi.fn();

const convertBinToQueueMock = vi.fn((e: AlbumEntry) => ({ q: e.id }));
const convertBinToFlowsheetMock = vi.fn(
  // Test fixtures always carry a real numeric id.
  (e: AlbumEntry): { f: number } | null => ({ f: e.id! })
);

vi.mock("@/lib/hooks", () => ({ useAppDispatch: () => dispatch }));
vi.mock("@/lib/features/bin/conversions", () => ({
  convertBinToQueue: (e: AlbumEntry) => convertBinToQueueMock(e),
  convertBinToFlowsheet: (e: AlbumEntry) => convertBinToFlowsheetMock(e),
}));
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));
vi.mock("@/lib/features/application/frontend", () => ({
  applicationSlice: {
    actions: { openPanel: (p: unknown) => ({ type: "openPanel", payload: p }) },
  },
}));

import { useBinEntryActions } from "@/src/components/experiences/modern/Rightbar/Bin/useBinEntryActions";

// The credit matters to the queue toast, so it has to be on the fixture —
// an entry with no artist at all makes the refused branch unreachable and
// the assertions below vacuous.
const entry = createTestAlbum({
  id: 7,
  title: "DOGA",
  artist: createTestArtist({ name: "Juana Molina" }),
});
const compilationEntry = createTestAlbum({
  id: 8,
  title: "Edits",
  artist: createTestArtist({ name: "Various Artists" }),
});
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

  it("refuses Play Now for a refused release credit instead of writing to the flowsheet", () => {
    convertBinToFlowsheetMock.mockReturnValueOnce(null);
    const { result } = renderHook(() =>
      useBinEntryActions(compilationEntry, true, deps)
    );
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.play.run();

    expect(addToFlowsheet).not.toHaveBeenCalled();
    // Pinned to the bin-specific constant, not a substring both messages
    // share: the remedy it names is the only thing standing between the DJ
    // and a dead end, and the generic copy would satisfy a looser matcher.
    expect(toastErrorMock).toHaveBeenCalledWith(
      VARIOUS_ARTISTS_BIN_PLAY_MESSAGE
    );
  });

  // Same dead end, but the DJ never typed a credit — telling them not to
  // write "Various Artists" would name a mistake they did not make.
  it("refuses Play Now for a release with no credit and does not blame Various Artists", () => {
    convertBinToFlowsheetMock.mockReturnValueOnce(null);
    const uncredited = createTestAlbum({
      id: 9,
      title: "Untitled",
      artist: undefined,
    });
    const { result } = renderHook(() =>
      useBinEntryActions(uncredited, true, deps)
    );
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.play.run();

    expect(addToFlowsheet).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      MISSING_ARTIST_BIN_PLAY_MESSAGE
    );
  });

  // The queue conversion drops the credit silently, so the toast is the only
  // notice the DJ gets that the artist cell still needs filling.
  it("says what the queued entry is still missing when the credit is refused", () => {
    const { result } = renderHook(() =>
      useBinEntryActions(compilationEntry, true, deps)
    );
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.queue.run();

    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Added Edits to queue. Name the performer in the artist cell before playing it."
    );
  });

  it("confirms a credited entry without the caveat", () => {
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.queue.run();

    expect(toastSuccessMock).toHaveBeenCalledWith("Added DOGA to queue");
  });

  it("does not remove a refused entry from the bin, even with Shift held", async () => {
    convertBinToFlowsheetMock.mockReturnValueOnce(null);
    const { result } = renderHook(() => useBinEntryActions(entry, true, deps));
    const byId = Object.fromEntries(result.current.map((a) => [a.id, a]));

    byId.play.run({ shiftKey: true });
    await Promise.resolve();

    expect(deleteFromBin).not.toHaveBeenCalled();
  });
});
