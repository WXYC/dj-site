import { describe, it, expect } from "vitest";
import {
  createExceptionGate,
  DEDUPE_WINDOW_MS,
  BUCKET_CAPACITY,
  REFILL_INTERVAL_MS,
} from "@/lib/exception-gate";

function setUp() {
  let t = 1_000_000;
  const gate = createExceptionGate(() => t);
  return { gate, advance: (ms: number) => (t += ms) };
}

const err = (message: string) => new Error(message);

describe("createExceptionGate", () => {
  it("drops a repeat inside the dedupe window without spending a token", () => {
    const { gate, advance } = setUp();
    expect(gate.admit(err("a"))).toBe(true);
    advance(DEDUPE_WINDOW_MS - 1);
    expect(gate.admit(err("a"))).toBe(false);
    expect(gate.dropped).toBe(1);
    // 19 tokens remain: the suppressed repeat cost nothing.
    for (let i = 0; i < BUCKET_CAPACITY - 1; i++) {
      expect(gate.admit(err(`distinct-${i}`))).toBe(true);
    }
    expect(gate.admit(err("one-too-many"))).toBe(false);
  });

  it("admits the same error again once the window has passed", () => {
    const { gate, advance } = setUp();
    expect(gate.admit(err("a"))).toBe(true);
    advance(DEDUPE_WINDOW_MS);
    expect(gate.admit(err("a"))).toBe(true);
  });

  it("keys on $exception_fingerprint when present", () => {
    const { gate } = setUp();
    expect(gate.admit(err("a"), { $exception_fingerprint: "f" })).toBe(true);
    expect(gate.admit(err("b"), { $exception_fingerprint: "f" })).toBe(false);
    expect(gate.admit(err("a"), { $exception_fingerprint: "g" })).toBe(true);
  });

  it("drops the 21st distinct error and refills one token per interval", () => {
    const { gate, advance } = setUp();
    for (let i = 0; i < BUCKET_CAPACITY; i++) {
      expect(gate.admit(err(`e${i}`))).toBe(true);
    }
    expect(gate.admit(err("e-over"))).toBe(false);
    advance(REFILL_INTERVAL_MS - 1);
    expect(gate.admit(err("e-early"))).toBe(false);
    advance(1);
    expect(gate.admit(err("e-refilled"))).toBe(true);
    expect(gate.admit(err("e-again"))).toBe(false);
  });

  it("bounds the dedupe table", () => {
    const { gate, advance } = setUp();
    let admitted = 0;
    for (let i = 0; i < 1500; i++) {
      // One refill interval per send keeps a token available, so every distinct key is admitted and tracked.
      advance(REFILL_INTERVAL_MS);
      if (gate.admit(err(`e${i}`))) {
        admitted++;
      }
    }
    expect(admitted).toBe(1500);
    expect(gate.trackedKeys).toBe(1000);
  });

  it("never throws on a malformed error or context", () => {
    const { gate } = setUp();
    expect(() => gate.admit(null as unknown as Error)).not.toThrow();
    expect(() => gate.admit(err("x"), null as never)).not.toThrow();
  });
});
