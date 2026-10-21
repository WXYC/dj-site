import { describe, it, expect, vi, afterEach } from "vitest";
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

describe("handled-error gate scenarios (error-tracking.md section 5)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  type Step = {
    id: string;
    at: number;
    keys: string[];
    admit: boolean;
    dropped?: number;
    warn: boolean;
  };
  const MIN = 60_000;
  const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
  const fill20 = (id: string, at: number): Step => ({ id, at, keys: range("k", 20), admit: true, warn: false });

  const scenarios: { name: string; capacity?: number; steps: Step[] }[] = [
    {
      name: "A: 20/21 boundary, refill",
      steps: [
        fill20("A1", 0),
        { id: "A2", at: 0, keys: ["k21"], admit: false, warn: true },
        { id: "A3", at: 30 * MIN - 1000, keys: ["k22"], admit: false, warn: true },
        { id: "A4", at: 30 * MIN, keys: ["k23"], admit: true, dropped: 2, warn: false },
        { id: "A5", at: 30 * MIN, keys: ["k24"], admit: false, warn: false },
        { id: "A6", at: 60 * MIN, keys: ["k25"], admit: true, dropped: 1, warn: false },
        { id: "A7", at: 90 * MIN, keys: ["k26"], admit: true, warn: false },
      ],
    },
    {
      name: "B: deduped repeat costs no token",
      steps: [
        { id: "B1", at: 0, keys: ["kA"], admit: true, warn: false },
        { id: "B2", at: 0, keys: ["kA"], admit: false, warn: true },
        { id: "B3", at: MIN - 1000, keys: ["kA"], admit: false, warn: false },
        { id: "B4", at: MIN, keys: ["kA"], admit: true, dropped: 2, warn: false },
      ],
    },
    {
      name: "C: refill capped at 20",
      steps: [
        { id: "C1", at: 0, keys: ["k1"], admit: true, warn: false },
        { id: "C2", at: 600 * MIN, keys: ["k2"], admit: true, warn: false },
      ],
    },
    {
      name: "D: a full bucket restarts the refill clock",
      steps: [
        fill20("D1", 29 * MIN),
        { id: "D2", at: 30 * MIN, keys: ["k21"], admit: false, warn: true },
        { id: "D3", at: 59 * MIN - 1000, keys: ["k22"], admit: false, warn: true },
        { id: "D4", at: 59 * MIN, keys: ["k23"], admit: true, dropped: 2, warn: false },
      ],
    },
    {
      name: "E: dedupe table bound, with unexpired keys",
      capacity: 1002,
      steps: [
        ...range("k", 1000).map((k, i) => ({ id: `E1-${k}`, at: i + 1, keys: [k], admit: true, warn: false })),
        { id: "E2", at: 30_000, keys: ["k1001"], admit: true, warn: false },
        { id: "E3", at: 30_000, keys: ["k1"], admit: true, warn: false },
        { id: "E4", at: 30_000, keys: ["k3"], admit: false, warn: true },
      ],
    },
    {
      name: "F: drop-warning rate limit",
      steps: [
        fill20("F0", 0),
        { id: "F1", at: 0, keys: ["k21"], admit: false, warn: true },
        { id: "F2", at: 15 * MIN - 1000, keys: ["k22"], admit: false, warn: false },
        { id: "F3", at: 15 * MIN, keys: ["k23"], admit: false, warn: true },
        { id: "F4", at: 15 * MIN + 1000, keys: ["k24"], admit: false, warn: false },
      ],
    },
  ];

  it.each(scenarios)("$name", ({ capacity, steps }) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let t = 0;
    const gate = createExceptionGate(() => t, capacity);
    for (const step of steps) {
      t = step.at;
      for (const key of step.keys) {
        const warnsBefore = warn.mock.calls.length;
        const admitted = gate.admit(err(key));
        expect(admitted, `${step.id} admit`).toBe(step.admit);
        expect(warn.mock.calls.length > warnsBefore, `${step.id} warn`).toBe(step.warn);
        if (admitted) {
          expect(gate.takeDropped(), `${step.id} dropped_since_last`).toBe(step.dropped ?? 0);
        }
      }
    }
  });

  it("keys on error type plus fingerprint", () => {
    const { gate } = setUp();
    const ctx = { $exception_fingerprint: "f" };
    expect(gate.admit(new TypeError("a"), ctx)).toBe(true);
    expect(gate.admit(new SyntaxError("a"), ctx)).toBe(true);
    expect(gate.admit(new TypeError("b"), ctx)).toBe(false);
  });

  it("dedupes separately per static label, never by context", () => {
    const { gate } = setUp();
    expect(gate.admit(err("a"), undefined, "one")).toBe(true);
    expect(gate.admit(err("a"), undefined, "two")).toBe(true);
    expect(gate.admit(err("a"), undefined, "one")).toBe(false);
    expect(gate.admit(err("b"), { url: "/x" })).toBe(true);
    expect(gate.admit(err("b"), { url: "/y" })).toBe(false);
  });
});
