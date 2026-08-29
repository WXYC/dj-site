import { describe, it, expect } from "vitest";
import {
  interpretReleaseDeleteError,
  RELEASE_DELETE_FALLBACK_MESSAGE,
  RELEASE_DELETE_INDETERMINATE_MESSAGE,
  RELEASE_DELETE_GONE_MESSAGE,
  RELEASE_DELETE_LOCK_MESSAGE,
  RELEASE_DELETE_REFUSED_MESSAGE,
} from "@/lib/features/catalog/releaseDeleteOutcome";

const wrapped = (status: number | string, data: unknown) => ({
  deleteAlbumError: { status, data },
});

describe("interpretReleaseDeleteError", () => {
  it("passes through the server's sentence for a play-count refusal, count and all", () => {
    const outcome = interpretReleaseDeleteError(
      wrapped(409, {
        message: "Cannot delete: release has 12 flowsheet plays on record",
        reason: "flowsheet_references",
        play_count: 12,
        direct_play_count: 12,
        rotation_linked_play_count: 0,
        legacy_linked_play_count: 0,
      }),
    );

    expect(outcome).toEqual({
      reason: "flowsheet_references",
      message: "Cannot delete: release has 12 flowsheet plays on record",
      retryable: false,
    });
  });

  it("carries the indirect-path breakdown through unaltered", () => {
    const message =
      "Cannot delete: release has 9 flowsheet plays on record (4 linked to the release, 3 via its rotation entry, 2 awaiting linkage from the legacy release id)";

    const outcome = interpretReleaseDeleteError(
      wrapped(409, { message, reason: "flowsheet_references", play_count: 9 }),
    );

    expect(outcome.message).toBe(message);
  });

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

  it.each([
    { label: "a refusal on the merits", status: 409, reason: "flowsheet_references" },
    { label: "a lock stand-down", status: 503, reason: "lock_unavailable" },
  ])("falls back to its own wording when $label arrives with no message", ({ status, reason }) => {
    const outcome = interpretReleaseDeleteError(wrapped(status, { reason }));

    expect(outcome.message).toBe(
      reason === "flowsheet_references"
        ? RELEASE_DELETE_REFUSED_MESSAGE
        : RELEASE_DELETE_LOCK_MESSAGE,
    );
  });

  it.each([
    { label: "an empty string", message: "" },
    { label: "whitespace", message: "   " },
    { label: "a non-string", message: 12 },
  ])("does not surface $label as the refusal sentence", ({ message }) => {
    const outcome = interpretReleaseDeleteError(
      wrapped(409, { message, reason: "flowsheet_references" }),
    );

    expect(outcome.message).toBe(RELEASE_DELETE_REFUSED_MESSAGE);
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
    { label: "an unwrapped error", err: { status: 409, data: { reason: "flowsheet_references" } } },
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

  it("keeps a refusal on the merits unretryable, whatever the transport did", () => {
    expect(
      interpretReleaseDeleteError(
        wrapped(409, { reason: "flowsheet_references", message: "has plays" }),
      ).retryable,
    ).toBe(false);
    expect(interpretReleaseDeleteError(wrapped(404, { message: "gone" })).retryable).toBe(false);
  });
});
