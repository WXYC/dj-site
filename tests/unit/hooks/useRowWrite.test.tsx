import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRowWrite } from "@/src/hooks/useRowWrite";

// Every setter `useState` hands out, so a test can assert that none ran after unmount
// (React 19 no longer warns about that, so the absence of a warning proves nothing).
const setters = vi.hoisted(() => [] as ReturnType<typeof vi.fn>[]);
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      const [value, set] = actual.useState(initial);
      const spy = vi.fn(set as (...args: unknown[]) => void);
      setters.push(spy);
      return [value, spy];
    }) as unknown as typeof actual.useState,
  };
});

type Action = "checkout" | "release";

const LOST_RACE = { lostRace: true };
const isLostRace = (err: unknown) => err === LOST_RACE;

/** A promise the test settles by hand, to hold a write or a reload open. */
const deferred = () => {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
type Deferred = ReturnType<typeof deferred>;

const setUp = (reload: () => Promise<unknown>[] = () => []) => {
  const onFailure = vi.fn();
  const onLostRace = vi.fn();
  const hook = renderHook(() => useRowWrite<Action>({ reload, isLostRace, onFailure, onLostRace }));
  return { ...hook, onFailure, onLostRace };
};

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

describe("useRowWrite", () => {
  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
    unhandled.length = 0;
  });

  it("reports an unlocked row as neither loading nor disabled", () => {
    const { result } = setUp();

    expect(result.current.lock(1, "checkout")).toEqual({ loading: false, disabled: false });
  });

  it("locks the row for the whole write: loading on its own action, disabled for any", async () => {
    const write = deferred();
    const { result } = setUp();

    let done!: Promise<void>;
    act(() => {
      done = result.current.write(1, "checkout", () => write.promise);
    });

    expect(result.current.lock(1, "checkout")).toEqual({ loading: true, disabled: true });
    expect(result.current.lock(1, "release")).toEqual({ loading: false, disabled: true });
    expect(result.current.lock(2, "checkout")).toEqual({ loading: false, disabled: false });

    await act(async () => {
      write.resolve();
      await done;
    });
    expect(result.current.lock(1, "checkout")).toEqual({ loading: false, disabled: false });
  });

  it("sends nothing for a second call on a locked row, even before the re-render", async () => {
    const write = deferred();
    const run = vi.fn(() => write.promise);
    const { result } = setUp();

    // Not awaited: a regressed guard would start a second write that never settles,
    // and awaiting it would hang this file instead of failing this assertion.
    let done!: Promise<void>;
    act(() => {
      done = result.current.write(1, "checkout", run);
      void result.current.write(1, "checkout", run);
      void result.current.write(1, "release", run);
    });

    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => {
      write.resolve();
      await done;
    });
  });

  it("locks rows independently", async () => {
    const run = vi.fn(async () => {});
    const { result } = setUp();

    await act(async () => {
      await Promise.all([result.current.write(1, "checkout", run), result.current.write(2, "checkout", run)]);
    });

    expect(run).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["resolves", (d: Deferred) => d.resolve(), undefined],
    ["fails", (d: Deferred) => d.reject(new Error("boom")), "failure"],
    ["loses the race", (d: Deferred) => d.reject(LOST_RACE), "race"],
  ] as const)("keeps the row locked until the reload settles when the write %s", async (_label, settle, outcome) => {
    const reload = deferred();
    const { result, onFailure, onLostRace } = setUp(() => [reload.promise]);

    let done!: Promise<void>;
    await act(async () => {
      const run = deferred();
      done = result.current.write(1, "checkout", () => run.promise);
      settle(run);
      await Promise.resolve();
    });

    expect(result.current.lock(1, "checkout").disabled).toBe(true);
    // The lost-race notice says the lists were reloaded, so it waits for them.
    expect(onLostRace).not.toHaveBeenCalled();

    await act(async () => {
      reload.resolve();
      await done;
    });

    expect(result.current.lock(1, "checkout").disabled).toBe(false);
    expect(onFailure).toHaveBeenCalledTimes(outcome === "failure" ? 1 : 0);
    expect(onLostRace).toHaveBeenCalledTimes(outcome === "race" ? 1 : 0);
  });

  it("unlocks the row when a reload rejects", async () => {
    const { result } = setUp(() => [Promise.reject(new Error("offline")), Promise.resolve()]);

    await act(async () => {
      await result.current.write(1, "checkout", async () => {});
    });

    expect(result.current.lock(1, "checkout").disabled).toBe(false);
  });

  it("hands a failure that is not a lost race to onFailure, with the row and action, and no lost-race notice", async () => {
    const err = new Error("boom");
    const { result, onFailure, onLostRace } = setUp();

    await act(async () => {
      await result.current.write(7, "release", async () => {
        throw err;
      });
    });

    expect(onFailure).toHaveBeenCalledWith(err, 7, "release");
    expect(onLostRace).not.toHaveBeenCalled();
  });

  it("hands a lost race to onLostRace, with the row and action, and no failure", async () => {
    const { result, onFailure, onLostRace } = setUp();

    await act(async () => {
      await result.current.write(7, "release", async () => {
        throw LOST_RACE;
      });
    });

    expect(onLostRace).toHaveBeenCalledWith(7, "release");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("treats a lost race as silent when the caller supplies no notice", async () => {
    const { result } = renderHook(() => useRowWrite<Action>({ reload: () => [], isLostRace, onFailure: vi.fn() }));

    await act(async () => {
      await result.current.write(1, "checkout", async () => {
        throw LOST_RACE;
      });
    });

    expect(result.current.lock(1, "checkout").disabled).toBe(false);
  });

  it.each([
    ["resolves", (d: Deferred) => d.resolve()],
    ["fails", (d: Deferred) => d.reject(new Error("boom"))],
    ["loses the race", (d: Deferred) => d.reject(LOST_RACE)],
  ] as const)("sets no state and calls no callback when the page unmounts mid-write that %s", async (_label, settle) => {
    process.on("unhandledRejection", onUnhandled);
    const { result, unmount, onFailure, onLostRace } = setUp(() => [Promise.reject(new Error("store torn down"))]);

    const run = deferred();
    let done!: Promise<void>;
    act(() => {
      done = result.current.write(1, "checkout", () => run.promise);
    });
    unmount();
    setters.forEach((setter) => setter.mockClear());
    settle(run);
    await done;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setters.flatMap((setter) => setter.mock.calls)).toEqual([]);
    expect(onFailure).not.toHaveBeenCalled();
    expect(onLostRace).not.toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });
});
