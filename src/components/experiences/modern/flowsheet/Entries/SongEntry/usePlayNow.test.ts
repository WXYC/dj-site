import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { usePlayNow } from "./usePlayNow";

const addToFlowsheetMock = vi.fn((_params: Record<string, unknown>) => ({
  unwrap: () => Promise.resolve(),
}));

vi.mock("@/lib/features/flowsheet/api", () => ({
  useAddToFlowsheetMutation: () => [addToFlowsheetMock],
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => ({ loading: false, info: { id: 1 } }),
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => vi.fn(),
}));

const queueEntry = (overrides: Partial<FlowsheetSongEntry>): FlowsheetSongEntry => ({
  id: 3,
  play_order: 3,
  show_id: 7,
  track_title: "la paradoja",
  artist_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  request_flag: false,
  ...overrides,
});

describe("usePlayNow submission payload (#607/#701 gate)", () => {
  beforeEach(() => {
    addToFlowsheetMock.mockClear();
  });

  it("omits album_id/rotation_bin for a freeform queue entry (album_id undefined)", () => {
    const { result } = renderHook(() => usePlayNow(queueEntry({})));
    result.current();

    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect("album_id" in payload).toBe(false);
    expect("rotation_bin" in payload).toBe(false);
    expect(payload.artist_name).toBe("Juana Molina");
  });

  it("drops a synthesized negative album_id but keeps rotation_id (freeform wire carries it, BS#1308)", () => {
    const { result } = renderHook(() =>
      usePlayNow(queueEntry({ album_id: -42, rotation_id: 9 }))
    );
    result.current();

    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect("album_id" in payload).toBe(false);
    expect(payload.rotation_id).toBe(9);
  });

  it("carries the linkage keys for a real positive album_id", () => {
    const { result } = renderHook(() =>
      usePlayNow(queueEntry({ album_id: 42, rotation_id: 9, rotation: "H" }))
    );
    result.current();

    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect(payload.album_id).toBe(42);
    expect(payload.rotation_id).toBe(9);
    expect(payload.rotation_bin).toBe("H");
  });
});
