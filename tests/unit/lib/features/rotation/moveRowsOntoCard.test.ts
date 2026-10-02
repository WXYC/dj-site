import { describe, it, expect, vi } from "vitest";
import { moveRowsOntoCard } from "@/lib/features/rotation/moveRowsOntoCard";

describe("moveRowsOntoCard", () => {
  it("attempts every row in order even after one rejects", async () => {
    const boom = { status: 500 };
    const attempted: number[] = [];
    const move = vi.fn((rotationId: number) => {
      attempted.push(rotationId);
      return rotationId === 901 ? Promise.reject(boom) : Promise.resolve();
    });

    await moveRowsOntoCard([900, 901, 902], move, vi.fn(), vi.fn());

    expect(attempted).toEqual([900, 901, 902]);
  });

  it("calls onRowSettled once per row, in order, with that row's outcome", async () => {
    const boom = { status: 500 };
    const move = vi.fn((rotationId: number) =>
      rotationId === 901 ? Promise.reject(boom) : Promise.resolve(),
    );
    const settled: unknown[] = [];

    await moveRowsOntoCard(
      [900, 901, 902],
      move,
      (rotationId, outcome) => settled.push([rotationId, outcome]),
      vi.fn(),
    );

    expect(settled).toEqual([
      [900, { ok: true }],
      [901, { ok: false, error: boom }],
      [902, { ok: true }],
    ]);
  });

  it("calls settle exactly once, after the last row, with the batch's outcome", async () => {
    const boom = { status: 500 };
    const order: string[] = [];
    const move = vi.fn((rotationId: number) => {
      order.push(`move:${rotationId}`);
      return rotationId === 901 ? Promise.reject(boom) : Promise.resolve();
    });
    const settle = vi.fn(() => order.push("settle"));

    await moveRowsOntoCard([900, 901], move, vi.fn(), settle);

    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith({
      moved: [900],
      failed: [{ rotationId: 901, error: boom }],
    });
    expect(order).toEqual(["move:900", "move:901", "settle"]);
  });

  it("names the moved and the failed rows in the returned outcome", async () => {
    const boom = { status: 500 };
    const move = vi.fn((rotationId: number) =>
      rotationId === 901 ? Promise.reject(boom) : Promise.resolve(),
    );

    const outcome = await moveRowsOntoCard([900, 901, 902], move, vi.fn(), vi.fn());

    expect(outcome).toEqual({
      moved: [900, 902],
      failed: [{ rotationId: 901, error: boom }],
    });
  });

  it("never throws, even when every row is refused", async () => {
    const move = vi.fn(() => Promise.reject({ status: 500 }));

    await expect(moveRowsOntoCard([900], move, vi.fn(), vi.fn())).resolves.toMatchObject({
      moved: [],
    });
  });

  // The guarantee covers `move` alone. A row whose write landed must never be
  // reported as failed because the caller's own callback threw afterwards:
  // a retry built on that report would resend a row that already moved.
  it("lets a throw from onRowSettled escape instead of recording the row's move as failed", async () => {
    const callbackBug = new Error("callback bug");
    const move = vi.fn(() => Promise.resolve());
    const onRowSettled = vi.fn(() => {
      throw callbackBug;
    });
    const settle = vi.fn();

    await expect(moveRowsOntoCard([900, 901], move, onRowSettled, settle)).rejects.toBe(
      callbackBug,
    );

    expect(onRowSettled.mock.calls).toEqual([[900, { ok: true }]]);
    expect(move.mock.calls).toEqual([[900]]);
    expect(settle).not.toHaveBeenCalled();
  });
});
