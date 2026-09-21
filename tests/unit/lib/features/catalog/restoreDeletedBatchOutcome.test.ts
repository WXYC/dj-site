import { describe, it, expect } from "vitest";
import {
  interpretRestoreError,
  restoreAnsweredWithoutWriting,
  RESTORE_ALREADY_RESTORED_MESSAGE,
  RESTORE_FALLBACK_MESSAGE,
  RESTORE_INDETERMINATE_MESSAGE,
  RESTORE_LOCK_MESSAGE,
  RESTORE_RESOLUTION_REQUIRED_MESSAGE,
  RESTORE_UNRESTORABLE_KIND_MESSAGE,
} from "@/lib/features/catalog/restoreDeletedBatchOutcome";

const wrapped = (status: number | string, data: unknown) => ({
  restoreDeletedBatchError: { status, data },
});

// The endpoint's own bodies, verbatim. A mock trimmed to the clause a test
// happens to assert on cannot catch the module preferring server text over its
// own: both sentences read the same once the half that differs is gone.
const SERVER_UNRESTORABLE_KIND =
  "Cannot restore: this batch holds a 'artist' entity, which has no restore plan. This is permanent, not retryable.";
const SERVER_RESOLUTION_REQUIRED =
  "Cannot restore without a decision: the call code is held by another release. Re-send with resolution=next_free_code or resolution=decline.";
const SERVER_ALREADY_RESTORED =
  "Cannot restore: this batch is already back in the catalog (library ids: 53375)";
const SERVER_LOCK = "Could not restore: the catalog is being written to right now. Try again in a moment.";

describe("interpretRestoreError", () => {
  it("marks a stale-listing unrestorable-kind refusal permanent, not retryable", () => {
    const outcome = interpretRestoreError(
      wrapped(409, {
        message: SERVER_UNRESTORABLE_KIND,
        reason: "unrestorable_kind",
        entity_kind: "artist",
      }),
    );

    expect(outcome.reason).toBe("unrestorable_kind");
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toBe(RESTORE_UNRESTORABLE_KIND_MESSAGE);
  });

  it("surfaces a resolution_required 400 as a readable, non-retryable refusal", () => {
    const outcome = interpretRestoreError(
      wrapped(400, { message: SERVER_RESOLUTION_REQUIRED, reason: "resolution_required", conflicts: [] }),
    );

    expect(outcome.reason).toBe("resolution_required");
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toBe(RESTORE_RESOLUTION_REQUIRED_MESSAGE);
    // The server's sentence tells the caller to re-send with a `resolution`
    // parameter. This is the one screen that has no way to, so putting that
    // instruction in front of the librarian names an action he cannot take.
    expect(outcome.message).not.toMatch(/resolution=/);
  });

  it("names an already-restored batch instead of claiming the restore failed", () => {
    const outcome = interpretRestoreError(
      wrapped(409, {
        message: SERVER_ALREADY_RESTORED,
        reason: "already_restored",
        entity_ids: [53375],
      }),
    );

    // Nothing on the listing changes when a restore succeeds, so the row keeps
    // its Restore button and this 409 is the ordinary second press. Sending it
    // to the fallback would tell the librarian the card is still deleted when
    // it is back on the shelf.
    expect(outcome.reason).toBe("already_restored");
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toBe(RESTORE_ALREADY_RESTORED_MESSAGE);
    expect(outcome.message).not.toBe(RESTORE_FALLBACK_MESSAGE);
    // The `library` ids the server names address rows no screen here can open.
    expect(outcome.message).not.toMatch(/53375/);
  });

  it("marks a lock stand-down retryable, and keeps the server's own sentence", () => {
    // The lock is the one named outcome that prefers server wording: what a
    // locked catalog is waiting on cannot be reconstructed client-side.
    const outcome = interpretRestoreError(wrapped(503, { message: SERVER_LOCK, reason: "lock_unavailable" }));

    expect(outcome.reason).toBe("lock_unavailable");
    expect(outcome.retryable).toBe(true);
    expect(outcome.message).toBe(SERVER_LOCK);
  });

  it("falls back to its own lock wording when the stand-down carries no message", () => {
    const outcome = interpretRestoreError(wrapped(503, { reason: "lock_unavailable" }));

    expect(outcome.message).toBe(RESTORE_LOCK_MESSAGE);
  });

  it("reports that the reason was not read for a refusal it cannot classify", () => {
    const outcome = interpretRestoreError(wrapped(404, { message: "Delete batch not found" }));

    expect(outcome.reason).toBe("unknown");
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toBe(RESTORE_FALLBACK_MESSAGE);
    // "There was no reason" would be a claim about a reply nobody here has
    // seen; "the reason could not be read" stays true of any of them.
    expect(outcome.message).toMatch(/the reason could not be read/);
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

  it("is false for a fulfilled mutation, which has no error at all", () => {
    // `invalidatesTags` calls this with `undefined` on success, and a `true`
    // here would skip every invalidation a successful restore needs.
    expect(restoreAnsweredWithoutWriting(undefined)).toBe(false);
  });
});
