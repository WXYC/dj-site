import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { usePlayNow } from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/usePlayNow";

const addToFlowsheetMock = vi.fn((_params: Record<string, unknown>) => ({
  unwrap: () => Promise.resolve(),
}));

// usePlayNow now writes through useFlowsheetActions (the shared flowsheet
// chokepoint), which also opens three mutation hooks it never fires here —
// they still have to resolve or the hook throws on render.
vi.mock("@/lib/features/flowsheet/api", () => ({
  useAddToFlowsheetMutation: () => [addToFlowsheetMock],
  useRemoveFromFlowsheetMutation: () => [vi.fn()],
  useUpdateFlowsheetMutation: () => [vi.fn()],
  useSwitchEntriesMutation: () => [vi.fn()],
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => ({ loading: false, info: { id: 1 } }),
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => vi.fn(),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
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
    toastErrorMock.mockClear();
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

describe("usePlayNow various-artists refusal", () => {
  beforeEach(() => {
    addToFlowsheetMock.mockClear();
    toastErrorMock.mockClear();
  });

  // Rehydrated from localStorage, this is the pre-guard shape: entries
  // queued before the guard shipped carry the compilation credit verbatim
  // and are still live on DJs' machines.
  it.each(["Various Artists", "VA", "Var. Artists"])(
    "refuses a queue entry credited %s and does not write to the flowsheet",
    (artist_name) => {
      const { result } = renderHook(() =>
        usePlayNow(queueEntry({ artist_name }))
      );
      result.current();

      expect(addToFlowsheetMock).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringMatching(/not "various artists"/i)
      );
    }
  );

  // The bin's Add to Queue escape hatch queues a refused credit with a
  // blank artist for the DJ to fill in; a queue row can also be blanked by
  // hand via the editable artist cell. Either way, replay must refuse until
  // a performer is named — there is no such thing as a blank flowsheet
  // credit.
  it.each(["", "   "])(
    "refuses a queue entry with a blank artist (%j) and does not write to the flowsheet",
    (artist_name) => {
      const { result } = renderHook(() =>
        usePlayNow(queueEntry({ artist_name }))
      );
      result.current();

      expect(addToFlowsheetMock).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringMatching(/not "various artists"/i)
      );
    }
  );

  it("still plays a normally-credited queue entry", () => {
    const { result } = renderHook(() =>
      usePlayNow(queueEntry({ artist_name: "Duke Ellington & John Coltrane" }))
    );
    result.current();

    expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
