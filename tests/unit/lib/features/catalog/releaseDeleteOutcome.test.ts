import { describe, it, expect } from "vitest";
import {
  interpretReleaseDeleteError,
  RELEASE_DELETE_FALLBACK_MESSAGE,
  RELEASE_DELETE_INDETERMINATE_MESSAGE,
  RELEASE_DELETE_GONE_MESSAGE,
  RELEASE_DELETE_LOCK_MESSAGE,
} from "@/lib/features/catalog/releaseDeleteOutcome";

const wrapped = (status: number | string, data: unknown) => ({
  deleteAlbumError: { status, data },
});

describe("interpretReleaseDeleteError", () => {
  it("marks a lock stand-down retryable — it says nothing about deletability", () => {
    const outcome = interpretReleaseDeleteError(
      wrapped(503, {
        message: "Could not delete: the release is being written to right now. Try again in a moment.",
        reason: "lock_unavailable",
      }),
    );

    expect(outcome.reason).toBe("lock_unavailable");
    expect(outcome.retryable).toBe(true);
  });

  it("falls back to its own wording when a lock stand-down arrives with no message", () => {
    const outcome = interpretReleaseDeleteError(wrapped(503, { reason: "lock_unavailable" }));

    expect(outcome.message).toBe(RELEASE_DELETE_LOCK_MESSAGE);
  });

  it.each([
    { label: "an empty string", message: "" },
    { label: "whitespace", message: "   " },
    { label: "a non-string", message: 12 },
  ])("does not surface $label as the lock stand-down's sentence", ({ message }) => {
    const outcome = interpretReleaseDeleteError(
      wrapped(503, { message, reason: "lock_unavailable" }),
    );

    expect(outcome.message).toBe(RELEASE_DELETE_LOCK_MESSAGE);
  });

  it("reads a 404 as already gone rather than as a failure to act on", () => {
    const outcome = interpretReleaseDeleteError(wrapped(404, { message: "Album not found" }));

    expect(outcome).toEqual({
      reason: "not_found",
      message: RELEASE_DELETE_GONE_MESSAGE,
      retryable: false,
    });
  });

  it.each([
    { label: "a non-object body", err: wrapped(409, "<html>502</html>") },
    { label: "an unrecognised reason", err: wrapped(409, { reason: "something_new" }) },
    { label: "a 400", err: wrapped(400, { message: "bad id" }) },
    { label: "a 401", err: wrapped(401, { message: "unauthorized" }) },
    // Regression guard: the delete no longer refuses on flowsheet plays, so
    // this reason cannot arrive from a current backend — but if a stale
    // proxy or a rollback ever sent it again, it must not resurrect the old
    // refusal-on-the-merits treatment (a passed-through server sentence,
    // its own named reason). It is just another 409 this module does not
    // classify.
    {
      label: "a stale flowsheet-plays reason this module no longer classifies",
      err: wrapped(409, {
        reason: "flowsheet_references",
        message: "Cannot delete: release has 12 flowsheet plays on record",
      }),
    },
    // The delete can still refuse on other grounds (a bound digital-asset
    // row, for one) — this module was never written to name that reason, so
    // it degrades the same way as any other refusal it does not recognize.
    {
      label: "a refusal this module was never written to name",
      err: wrapped(409, {
        reason: "digital_asset_references",
        message: "Cannot delete: release has 2 digital assets on record",
      }),
    },
  ])("says nothing was changed only when the server answered below 500 — $label", ({ err }) => {
    const outcome = interpretReleaseDeleteError(err);

    expect(outcome.reason).toBe("unknown");
    expect(outcome.message).toBe(RELEASE_DELETE_FALLBACK_MESSAGE);
    expect(outcome.retryable).toBe(false);
  });

  it.each([
    { label: "a 500", err: wrapped(500, { message: "boom" }) },
    { label: "a 502 behind a gateway", err: wrapped(502, undefined) },
    { label: "a dropped connection", err: wrapped("FETCH_ERROR", undefined) },
    { label: "an unparseable body", err: wrapped("PARSING_ERROR", undefined) },
    { label: "an unwrapped error", err: { status: 409, data: { reason: "lock_unavailable" } } },
    { label: "undefined", err: undefined },
  ])("refuses to claim nothing was changed when no answer came back — $label", ({ err }) => {
    const outcome = interpretReleaseDeleteError(err);

    // The delete may well have committed on a response that never arrived.
    // Claiming it did not is the one thing this branch must never do, and a
    // retry is safe: a second attempt on a deleted row reads as "already
    // gone".
    expect(outcome.reason).toBe("indeterminate");
    expect(outcome.message).toBe(RELEASE_DELETE_INDETERMINATE_MESSAGE);
    expect(outcome.message).not.toContain("Nothing was changed");
    expect(outcome.retryable).toBe(true);
  });

  it("keeps every non-retryable refusal unretryable, whatever the transport did", () => {
    expect(
      interpretReleaseDeleteError(wrapped(409, { reason: "digital_asset_references" })).retryable,
    ).toBe(false);
    expect(interpretReleaseDeleteError(wrapped(404, { message: "gone" })).retryable).toBe(false);
  });
});
