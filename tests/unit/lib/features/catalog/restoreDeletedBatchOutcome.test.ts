import { describe, it, expect } from "vitest";
import {
  interpretRestoreError,
  restoreAnsweredWithoutWriting,
  RESTORE_FALLBACK_MESSAGE,
  RESTORE_INDETERMINATE_MESSAGE,
  RESTORE_LOCK_MESSAGE,
  RESTORE_RESOLUTION_REQUIRED_MESSAGE,
  RESTORE_UNRESTORABLE_KIND_MESSAGE,
} from "@/lib/features/catalog/restoreDeletedBatchOutcome";

const wrapped = (status: number | string, data: unknown) => ({
  restoreDeletedBatchError: { status, data },
});

describe("interpretRestoreError", () => {
  it("marks a stale-listing unrestorable-kind refusal permanent, not retryable", () => {
    const outcome = interpretRestoreError(
      wrapped(409, { message: "no restore plan", reason: "unrestorable_kind", entity_kind: "artist" }),
    );

    expect(outcome.reason).toBe("unrestorable_kind");
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toBe("no restore plan");
  });

  it("falls back to its own wording when the unrestorable-kind refusal carries no message", () => {
    const outcome = interpretRestoreError(wrapped(409, { reason: "unrestorable_kind" }));

    expect(outcome.message).toBe(RESTORE_UNRESTORABLE_KIND_MESSAGE);
  });

  it("surfaces a resolution_required 400 as a readable, non-retryable refusal", () => {
    const outcome = interpretRestoreError(
      wrapped(400, { message: "held by another release", reason: "resolution_required", conflicts: [] }),
    );

    expect(outcome.reason).toBe("resolution_required");
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toBe("held by another release");
  });

  it("falls back to its own wording when resolution_required carries no message", () => {
    const outcome = interpretRestoreError(wrapped(400, { reason: "resolution_required" }));

    expect(outcome.message).toBe(RESTORE_RESOLUTION_REQUIRED_MESSAGE);
  });

  it("marks a lock stand-down retryable", () => {
    const outcome = interpretRestoreError(wrapped(503, { reason: "lock_unavailable" }));

    expect(outcome.reason).toBe("lock_unavailable");
    expect(outcome.retryable).toBe(true);
    expect(outcome.message).toBe(RESTORE_LOCK_MESSAGE);
  });

  it("says nothing changed for an unclassified refusal the server answered without writing", () => {
    const outcome = interpretRestoreError(wrapped(409, { reason: "already_restored" }));

    expect(outcome.reason).toBe("unknown");
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toBe(RESTORE_FALLBACK_MESSAGE);
  });

  it("refuses to claim nothing changed when no answer came back at all", () => {
    const outcome = interpretRestoreError(wrapped(500, { message: "boom" }));

    expect(outcome.reason).toBe("indeterminate");
    expect(outcome.retryable).toBe(true);
    expect(outcome.message).toBe(RESTORE_INDETERMINATE_MESSAGE);
  });

  it("treats an unwrapped rejection as indeterminate", () => {
    const outcome = interpretRestoreError(new Error("network down"));

    expect(outcome.reason).toBe("indeterminate");
  });
});

describe("restoreAnsweredWithoutWriting", () => {
  it("is true for a sub-500 status", () => {
    expect(restoreAnsweredWithoutWriting(wrapped(409, {}))).toBe(true);
  });

  it("is false for a 5xx status", () => {
    expect(restoreAnsweredWithoutWriting(wrapped(500, {}))).toBe(false);
  });

  it("is false when no status is known at all", () => {
    expect(restoreAnsweredWithoutWriting(new Error("network down"))).toBe(false);
  });
});
