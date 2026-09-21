import { describe, it, expect } from "vitest";
import {
  interpretArtistDeleteError,
  ARTIST_DELETE_FALLBACK_MESSAGE,
  ARTIST_DELETE_INDETERMINATE_MESSAGE,
  ARTIST_DELETE_GONE_MESSAGE,
  ARTIST_DELETE_LOCK_MESSAGE,
} from "@/lib/features/catalog/artistDeleteOutcome";

const wrapped = (status: number | string, data: unknown) => ({
  deleteArtistError: { status, data },
});

/**
 * The server's OWN sentence for each of the four 409s, verbatim from
 * `Backend-Service`'s `deleteArtist` controller (`library.controller.ts:1494-1556`).
 * Every 409 fixture below carries one, matching `releaseDeleteOutcome.test.ts`'s
 * `archive409()`: without a server message in the fixture, a regression that
 * changed the interpreter to prefer `serverMessage(data)` over the client's own
 * wording would pass every test here, which is the one thing this suite exists
 * to catch.
 */
function serverBlockingMessage(
  reason: "artist_has_releases" | "artist_crossreference_source" | "artist_crossreference_target" | "artist_library_crossreference",
  count: number,
): string {
  const plural = count === 1 ? "" : "s";
  switch (reason) {
    case "artist_has_releases":
      return `Cannot delete: artist has ${count} release${plural} on file. Delete or move those releases first.`;
    case "artist_crossreference_source":
      return `Cannot delete: artist is the source of ${count} cross-reference${plural} to other artists.`;
    case "artist_crossreference_target":
      return `Cannot delete: artist is the target of ${count} cross-reference${plural} from other artists.`;
    case "artist_library_crossreference":
      return `Cannot delete: artist has ${count} release cross-reference${plural} on file.`;
  }
}

describe("interpretArtistDeleteError", () => {
  it("marks a lock stand-down retryable — it says nothing about deletability", () => {
    const outcome = interpretArtistDeleteError(
      wrapped(503, {
        message: "Could not delete: the artist is being written to right now. Try again in a moment.",
        reason: "lock_unavailable",
      }),
    );

    expect(outcome.reason).toBe("lock_unavailable");
    expect(outcome.retryable).toBe(true);
  });

  it("falls back to its own wording when a lock stand-down arrives with no message", () => {
    const outcome = interpretArtistDeleteError(wrapped(503, { reason: "lock_unavailable" }));

    expect(outcome.message).toBe(ARTIST_DELETE_LOCK_MESSAGE);
  });

  it.each([
    { label: "an empty string", message: "" },
    { label: "whitespace", message: "   " },
    { label: "a non-string", message: 12 },
  ])("does not surface $label as the lock stand-down's sentence", ({ message }) => {
    const outcome = interpretArtistDeleteError(
      wrapped(503, { message, reason: "lock_unavailable" }),
    );

    expect(outcome.message).toBe(ARTIST_DELETE_LOCK_MESSAGE);
  });

  it("reads a 404 as already gone rather than as a failure to act on", () => {
    const outcome = interpretArtistDeleteError(wrapped(404, { message: "Artist not found" }));

    expect(outcome).toEqual({
      reason: "not_found",
      message: ARTIST_DELETE_GONE_MESSAGE,
      retryable: false,
    });
  });

  it.each([
    { label: "a non-object body", err: wrapped(409, "<html>502</html>") },
    { label: "an unrecognised reason", err: wrapped(409, { reason: "something_new" }) },
    { label: "a 400", err: wrapped(400, { message: "bad id" }) },
    { label: "a 401", err: wrapped(401, { message: "unauthorized" }) },
    {
      label: "a blocking reason on the wrong status",
      err: wrapped(400, { reason: "artist_has_releases", count: 2 }),
    },
    {
      label: "the lock reason on a 409",
      err: wrapped(409, { reason: "lock_unavailable" }),
    },
  ])("says nothing was changed only when the server answered below 500 — $label", ({ err }) => {
    const outcome = interpretArtistDeleteError(err);

    expect(outcome.reason).toBe("unknown");
    expect(outcome.message).toBe(ARTIST_DELETE_FALLBACK_MESSAGE);
    expect(outcome.retryable).toBe(false);
  });

  it.each([
    { label: "a 500", err: wrapped(500, { message: "boom" }) },
    { label: "a 502 behind a gateway", err: wrapped(502, undefined) },
    { label: "a dropped connection", err: wrapped("FETCH_ERROR", undefined) },
    { label: "an unparseable body", err: wrapped("PARSING_ERROR", undefined) },
    { label: "an unwrapped error", err: { status: 409, data: { reason: "artist_has_releases" } } },
    { label: "undefined", err: undefined },
  ])("refuses to claim nothing was changed when no answer came back — $label", ({ err }) => {
    const outcome = interpretArtistDeleteError(err);

    // The delete may well have committed on a response that never arrived.
    // Claiming it did not is the one thing this branch must never do, and a
    // retry is safe: a second attempt on a deleted row reads as "already
    // gone".
    expect(outcome.reason).toBe("indeterminate");
    expect(outcome.message).toBe(ARTIST_DELETE_INDETERMINATE_MESSAGE);
    expect(outcome.message).not.toContain("Nothing was changed");
    expect(outcome.retryable).toBe(true);
  });

  it("keeps every non-retryable refusal unretryable, whatever the transport did", () => {
    expect(
      interpretArtistDeleteError(
        wrapped(409, {
          reason: "artist_has_releases",
          count: 1,
          message: serverBlockingMessage("artist_has_releases", 1),
        }),
      ).retryable,
    ).toBe(false);
    expect(interpretArtistDeleteError(wrapped(404, { message: "gone" })).retryable).toBe(false);
  });
});

describe("keys inherited from Object.prototype never pass as a blocking reason", () => {
  // `reason in TABLE` would see these (an object's own keys are not the only
  // ones `in` walks), and each degrades differently: `__proto__` hands the
  // table object itself to a call, `toString`/`valueOf` hand back a function
  // that is not one of the four message builders, and `hasOwnProperty` hands
  // back a boolean where `message: string` is declared. None of that is
  // reachable through the fixed lookup, but the case is cheap enough to pin
  // directly rather than trust the implementation alone.
  it.each(["__proto__", "toString", "constructor", "hasOwnProperty", "valueOf"])(
    "treats %s as unrecognised rather than as a table lookup",
    (reason) => {
      let outcome: ReturnType<typeof interpretArtistDeleteError> | undefined;
      expect(() => {
        outcome = interpretArtistDeleteError(wrapped(409, { reason, count: 2 }));
      }).not.toThrow();

      expect(outcome).toEqual({
        reason: "unknown",
        message: ARTIST_DELETE_FALLBACK_MESSAGE,
        retryable: false,
      });
    },
  );
});

describe("the four dependent-count refusals", () => {
  const casesByReason = [
    {
      reason: "artist_has_releases" as const,
      noun: "release",
      fragment: "on file",
    },
    {
      reason: "artist_crossreference_source" as const,
      noun: "cross-reference",
      fragment: "source of",
    },
    {
      reason: "artist_crossreference_target" as const,
      noun: "cross-reference",
      fragment: "target of",
    },
    {
      reason: "artist_library_crossreference" as const,
      noun: "release cross-reference",
      fragment: "on file",
    },
  ];

  it.each(casesByReason)(
    "names $reason, restates the server's count, and rewrites the server's own sentence rather than passing it through",
    ({ reason, fragment }) => {
      const outcome = interpretArtistDeleteError(
        wrapped(409, { reason, count: 3, message: serverBlockingMessage(reason, 3) }),
      );

      expect(outcome.reason).toBe(reason);
      expect(outcome.retryable).toBe(false);
      expect(outcome.message).toContain("3");
      expect(outcome.message).toContain(fragment);
      // Client-owned, not the server's: "Nothing was changed" is a sentence
      // none of Backend's four refusal bodies send, and "Cannot delete:" is
      // the exact opener every one of them does. A change that fell back to
      // `serverMessage(data)` would drop the first and pick up the second.
      expect(outcome.message).toContain("Nothing was changed");
      expect(outcome.message).not.toContain("Cannot delete:");
    },
  );

  it.each(casesByReason)("uses the singular noun when the count is exactly one — $reason", ({ reason, noun }) => {
    const outcome = interpretArtistDeleteError(
      wrapped(409, { reason, count: 1, message: serverBlockingMessage(reason, 1) }),
    );

    expect(outcome.message).toContain(`1 ${noun}`);
    expect(outcome.message).not.toContain(`1 ${noun}s`);
  });

  // A count this module cannot trust must not become a number on screen, and
  // must not take the sentence down with it either. The fixture still
  // carries the server's message (built off a plausible real count) so this
  // stays a fixture the real client-owned-wording test above would also
  // exercise, not a shape the interpreter never actually sees.
  it.each([
    { label: "absent", extra: {} },
    { label: "a string", extra: { count: "3" } },
    { label: "zero, which contradicts the refusal", extra: { count: 0 } },
    { label: "negative", extra: { count: -1 } },
    { label: "fractional", extra: { count: 1.5 } },
  ])("still names the reason when the count is $label", ({ extra }) => {
    const outcome = interpretArtistDeleteError(
      wrapped(409, {
        reason: "artist_has_releases",
        message: serverBlockingMessage("artist_has_releases", 3),
        ...extra,
      }),
    );

    expect(outcome.reason).toBe("artist_has_releases");
    expect(outcome.message).toContain("releases");
    expect(outcome.message).not.toMatch(/\b(0|-1|1\.5|NaN|undefined|null)\b/);
  });

  it("never degrades to the sentence that says the reason could not be read", () => {
    const outcome = interpretArtistDeleteError(
      wrapped(409, {
        reason: "artist_has_releases",
        count: 2,
        message: serverBlockingMessage("artist_has_releases", 2),
      }),
    );

    expect(outcome.message).not.toBe(ARTIST_DELETE_FALLBACK_MESSAGE);
    expect(outcome.message).not.toContain("could not be read");
  });
});
