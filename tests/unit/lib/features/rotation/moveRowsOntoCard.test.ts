import { describe, it, expect, vi } from "vitest";
import {
  moveRowsOntoCard,
  CONSECUTIVE_FAILURE_STOP_THRESHOLD,
} from "@/lib/features/rotation/moveRowsOntoCard";

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
      notAttempted: [],
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
      notAttempted: [],
    });
  });

  it("never throws, even when every row is refused", async () => {
    const move = vi.fn(() => Promise.reject({ status: 500 }));

    await expect(moveRowsOntoCard([900], move, vi.fn(), vi.fn())).resolves.toMatchObject({
      moved: [],
    });
  });

  // The guarantee covers `move` alone. A row whose write landed must never be
  // reported as failed, nor as not attempted, because the caller's own
  // callback threw afterwards: a retry built on either report would resend a
  // row that already moved. `settle` still fires, so the rows that moved are
  // refetched, and the only row it names not attempted is the one the loop
  // never reached.
  it("lets a throw from onRowSettled escape after settling once, with the row it threw on still recorded as moved", async () => {
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
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith({ moved: [900], failed: [], notAttempted: [901] });
  });

  // `settle` runs last and outside the guard as well, so its throw is the one
  // the caller sees -- over a throw from `onRowSettled` that was already on
  // its way out, too.
  it.each([
    ["after every row has landed", () => {}],
    [
      "in place of a throw from onRowSettled",
      () => {
        throw new Error("callback bug");
      },
    ],
  ])("rejects with settle's own throw %s", async (_when, onRowSettled) => {
    const settleBug = new Error("settle bug");
    const settle = vi.fn(() => {
      throw settleBug;
    });

    await expect(
      moveRowsOntoCard([900, 901], () => Promise.resolve(), onRowSettled, settle),
    ).rejects.toBe(settleBug);

    expect(settle).toHaveBeenCalledTimes(1);
  });

  it("stops after three consecutive failures, leaving the rest not attempted", async () => {
    const boom = { status: 500 };
    const failing = new Set([901, 902, 903]);
    const attempted: number[] = [];
    const move = vi.fn((rotationId: number) => {
      attempted.push(rotationId);
      return failing.has(rotationId) ? Promise.reject(boom) : Promise.resolve();
    });
    const settle = vi.fn();

    const outcome = await moveRowsOntoCard(
      [900, 901, 902, 903, 904, 905],
      move,
      vi.fn(),
      settle,
    );

    expect(attempted).toEqual([900, 901, 902, 903]);
    expect(outcome).toEqual({
      moved: [900],
      failed: [
        { rotationId: 901, error: boom },
        { rotationId: 902, error: boom },
        { rotationId: 903, error: boom },
      ],
      notAttempted: [904, 905],
    });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(outcome);
  });

  it("names no row not attempted when the stop lands on the batch's last three rows", async () => {
    const boom = { status: 500 };
    const failing = new Set([901, 902, 903]);
    const move = vi.fn((rotationId: number) =>
      failing.has(rotationId) ? Promise.reject(boom) : Promise.resolve(),
    );
    const settle = vi.fn();

    const outcome = await moveRowsOntoCard([900, 901, 902, 903], move, vi.fn(), settle);

    expect(outcome).toEqual({
      moved: [900],
      failed: [
        { rotationId: 901, error: boom },
        { rotationId: 902, error: boom },
        { rotationId: 903, error: boom },
      ],
      notAttempted: [],
    });
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it("resets the consecutive-failure count on a success, so the batch does not stop early", async () => {
    expect(CONSECUTIVE_FAILURE_STOP_THRESHOLD).toBe(3);
    const boom = { status: 500 };
    const failing = new Set([901, 902, 904, 905, 906]);
    const move = vi.fn((rotationId: number) =>
      failing.has(rotationId) ? Promise.reject(boom) : Promise.resolve(),
    );

    const outcome = await moveRowsOntoCard(
      [900, 901, 902, 903, 904, 905, 906, 907],
      move,
      vi.fn(),
      vi.fn(),
    );

    // 901 and 902 fail, 903 succeeds and resets the count, so the three
    // consecutive failures that stop the batch are 904, 905, and 906.
    expect(move.mock.calls.map(([id]) => id)).toEqual([900, 901, 902, 903, 904, 905, 906]);
    expect(outcome.notAttempted).toEqual([907]);
  });

  // Every spec above uses promises that are already settled, so a loop that
  // fired every `move` up front without awaiting would still pass them.
  it("awaits each row's move before starting the next", async () => {
    const attempted: number[] = [];
    let resolveFirst!: () => void;
    const move = vi.fn((rotationId: number) => {
      attempted.push(rotationId);
      if (rotationId === 900) {
        return new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve();
    });

    const donePromise = moveRowsOntoCard([900, 901], move, vi.fn(), vi.fn());

    await Promise.resolve();
    await Promise.resolve();
    expect(attempted).toEqual([900]);

    resolveFirst();
    await donePromise;
    expect(attempted).toEqual([900, 901]);
  });
});
