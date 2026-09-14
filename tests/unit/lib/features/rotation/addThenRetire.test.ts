import { describe, it, expect, vi } from "vitest";
import { addThenRetire } from "@/lib/features/rotation/addThenRetire";

describe("addThenRetire", () => {
  it("lands the add before any retire — the ordering that fails safe", async () => {
    const calls: string[] = [];
    const add = vi.fn(async () => {
      calls.push("add");
    });
    const retire = vi.fn(async (rotationId: number) => {
      calls.push(`retire:${rotationId}`);
    });

    const outcome = await addThenRetire(add, [900, 901], retire);

    expect(calls).toEqual(["add", "retire:900", "retire:901"]);
    expect(outcome).toEqual({ step: "done", added: true, retireFailures: [] });
  });

  it("attempts no retire when the add is refused, leaving the prior entries in place", async () => {
    const boom = { status: 500 };
    const retire = vi.fn(async () => {});

    const outcome = await addThenRetire(() => Promise.reject(boom), [900], retire);

    expect(retire).not.toHaveBeenCalled();
    expect(outcome).toEqual({ step: "add-failed", error: boom });
  });

  it("attempts every retire after one fails and reports each failure with its entry", async () => {
    const boom = { status: 500 };
    const retire = vi.fn((rotationId: number) =>
      rotationId === 900 ? Promise.reject(boom) : Promise.resolve(),
    );

    const outcome = await addThenRetire(async () => {}, [900, 901], retire);

    expect(retire).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({
      step: "done",
      added: true,
      retireFailures: [{ rotationId: 900, error: boom }],
    });
  });

  it("retires without adding when no add is requested — a pure removal", async () => {
    const retire = vi.fn(async () => {});

    const outcome = await addThenRetire(null, [900], retire);

    expect(retire).toHaveBeenCalledWith(900);
    expect(outcome).toEqual({ step: "done", added: false, retireFailures: [] });
  });
});
