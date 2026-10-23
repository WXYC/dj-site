import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { useReorderableEntries } from "@/src/hooks/useReorderableEntries";

const entry = (id: number) => ({ id, play_order: id }) as unknown as FlowsheetEntry;
const A = entry(1);
const B = entry(2);
const C = entry(3);

describe("useReorderableEntries", () => {
  it("holds the drag-start order through a mid-drag change to the entries", () => {
    const reorder = vi.fn();
    const { result, rerender } = renderHook(
      ({ entries }) => useReorderableEntries({ entries, reorder }),
      { initialProps: { entries: [A, B, C] } }
    );

    act(() => result.current.dragContext.onEntryDragStart());
    rerender({ entries: [C, B, A] });

    expect(result.current.shown.map((e) => e.id)).toEqual([1, 2, 3]);

    act(() => result.current.onReorder([B, A, C]));
    act(() => result.current.dragContext.onEntryDragEnd(A));

    expect(reorder).toHaveBeenCalledTimes(1);
    expect(result.current.shown.map((e) => e.id)).toEqual([3, 2, 1]);
  });

  it("passes the action the entry and the position the drag computed", () => {
    const reorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderableEntries({ entries: [A, B, C], reorder })
    );

    act(() => result.current.dragContext.onEntryDragStart());
    act(() => result.current.onReorder([B, C, A]));
    act(() => result.current.dragContext.onEntryDragEnd(A));

    expect(reorder).toHaveBeenCalledWith(A, 3);
  });

  it("re-renders at drag end when the drag moved nothing, and does not call the action", () => {
    const reorder = vi.fn();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useReorderableEntries({ entries: [A, B, C], reorder });
    });

    act(() => result.current.dragContext.onEntryDragStart());
    const before = renders;
    act(() => result.current.dragContext.onEntryDragEnd(A));

    expect(renders).toBeGreaterThan(before);
    expect(reorder).not.toHaveBeenCalled();
  });

  it("keeps the drag context's identity across renders", () => {
    const { result, rerender } = renderHook(
      ({ entries }) => useReorderableEntries({ entries, reorder: vi.fn() }),
      { initialProps: { entries: [A, B] } }
    );
    const first = result.current.dragContext;
    rerender({ entries: [B, A] });
    expect(result.current.dragContext).toBe(first);
  });

  it("reports drag state to the caller at start and end", () => {
    const onDraggingChange = vi.fn();
    const { result } = renderHook(() =>
      useReorderableEntries({
        entries: [A, B],
        reorder: vi.fn(),
        onDraggingChange,
      })
    );

    act(() => result.current.dragContext.onEntryDragStart());
    expect(onDraggingChange).toHaveBeenLastCalledWith(true);
    act(() => result.current.dragContext.onEntryDragEnd(A));
    expect(onDraggingChange).toHaveBeenLastCalledWith(false);
  });
});
