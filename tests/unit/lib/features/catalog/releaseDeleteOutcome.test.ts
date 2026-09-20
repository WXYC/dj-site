import { describe, it, expect } from "vitest";
import {
  interpretReleaseDeleteError,
  RELEASE_DELETE_FALLBACK_MESSAGE,
  RELEASE_DELETE_INDETERMINATE_MESSAGE,
  RELEASE_DELETE_GONE_MESSAGE,
  RELEASE_DELETE_LOCK_MESSAGE,
  releaseDeleteDigitalAssetsMessage,
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
    // refusal-on-the-merits treatment (a passed-through server sentence, its
    // own named reason). Status alone does not earn a name here: the archive
    // refusal below is classified on its `reason`, and this one has to miss
    // that test rather than ride the 409 in with it.
    {
      label: "a stale flowsheet-plays reason this module no longer classifies",
      err: wrapped(409, {
        reason: "flowsheet_references",
        message: "Cannot delete: release has 12 flowsheet plays on record",
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

describe("the archive refusal — the one 409 the endpoint still raises", () => {
  const archive409 = (extra: Record<string, unknown> = {}) =>
    wrapped(409, {
      message: "Cannot delete: release has 2 digital assets on record (ids: 88, 91)",
      reason: "digital_asset_references",
      asset_count: 2,
      assets: [{ id: 88 }, { id: 91 }],
      ...extra,
    });

  // The fallback says the reason could not be read. Said about this reply it
  // is simply false -- the body names the reason, the count and the ids -- and
  // it is said on a screen whose only other affordance is Cancel, so the
  // librarian is told nothing and given nowhere to go.
  it("never degrades to the sentence that says the reason could not be read", () => {
    const outcome = interpretReleaseDeleteError(archive409());

    expect(outcome.reason).toBe("digital_assets");
    expect(outcome.message).not.toBe(RELEASE_DELETE_FALLBACK_MESSAGE);
    expect(outcome.message).not.toContain("could not be read");
  });

  // Not retryable and "nothing was changed" are both load-bearing: the row is
  // still shelved, and pressing again cannot change that.
  it("refuses on the merits — the button is withdrawn, and the shelf is unchanged", () => {
    const outcome = interpretReleaseDeleteError(archive409());

    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toContain("Nothing was changed");
  });

  // The one fact that lets him act. Without it the sentence is a dead end: he
  // cannot tell whether to retry, re-file, or ask someone.
  it("names the archive as the thing holding the release", () => {
    expect(interpretReleaseDeleteError(archive409()).message).toContain("audio archive");
  });

  // Restated because the count is the librarian's only sense of scale.
  it("restates the server's count", () => {
    expect(interpretReleaseDeleteError(archive409()).message).toContain("2 recordings");
    expect(
      interpretReleaseDeleteError(archive409({ asset_count: 1 })).message,
    ).toContain("1 recording");
  });

  // Deliberately dropped: the ids address `digital_asset` rows no screen in
  // this app can open, so printing them names something the librarian cannot
  // act on and invites him to go looking for a page that does not exist.
  it("drops the asset ids the server sends", () => {
    const message = interpretReleaseDeleteError(archive409()).message;

    expect(message).not.toContain("88");
    expect(message).not.toContain("91");
  });

  // A count this module cannot trust must not become a number on screen, and
  // must not take the sentence down with it either -- the archive fact stands
  // on its own.
  it.each([
    { label: "absent", extra: { asset_count: undefined } },
    { label: "a string", extra: { asset_count: "2" } },
    { label: "zero, which contradicts the refusal", extra: { asset_count: 0 } },
    { label: "negative", extra: { asset_count: -1 } },
    { label: "fractional", extra: { asset_count: 1.5 } },
  ])("still names the archive when the count is $label", ({ extra }) => {
    const outcome = interpretReleaseDeleteError(archive409(extra));

    expect(outcome.reason).toBe("digital_assets");
    expect(outcome.message).toContain("audio archive");
    expect(outcome.message).toContain("recordings");
    expect(outcome.message).not.toMatch(/\b(0|-1|1\.5|NaN|undefined|null)\b/);
  });

  // Status and reason have to agree, the same rule the lock stand-down
  // follows: a bare 409 from a proxy is not this refusal, and this reason on
  // another status is not a shape the endpoint produces.
  it.each([
    { label: "a 409 with no reason at all", err: wrapped(409, { message: "nope" }) },
    {
      label: "the archive reason on a 400",
      err: wrapped(400, { reason: "digital_asset_references", asset_count: 2 }),
    },
  ])("does not name the archive for $label", ({ err }) => {
    expect(interpretReleaseDeleteError(err).reason).toBe("unknown");
  });

  // The builder is exported so the confirmation screen's own test can assert
  // the rendered sentence without restating it, and a reworded refusal stays
  // one edit.
  it("builds the same sentence the interpreter returns", () => {
    expect(interpretReleaseDeleteError(archive409()).message).toBe(
      releaseDeleteDigitalAssetsMessage(2),
    );
  });
});
