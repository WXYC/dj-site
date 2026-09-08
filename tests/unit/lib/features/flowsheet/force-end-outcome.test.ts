import { describe, expect, it } from "vitest";

import {
  classifyForceEndError,
  FORCE_END_COPY,
  FORCE_END_TESTIDS,
} from "@/lib/features/flowsheet/force-end-outcome";

/** The transformed shape `forceEndShow`'s rejection arrives in. */
const wrapped = (status: number | string, message?: string) => ({
  forceEndShowError: {
    status,
    data: message !== undefined ? { message } : undefined,
  },
});

describe("classifyForceEndError", () => {
  it("reads the server's already-ended 400 as the benign race", () => {
    expect(
      classifyForceEndError(wrapped(400, "Bad Request: show is already ended"))
    ).toBe("already_ended");
  });

  it("keeps other 400s as refusals — a bad id is not a closed show", () => {
    expect(
      classifyForceEndError(
        wrapped(400, "Bad Request: show id must be a positive integer")
      )
    ).toBe("refused");
  });

  it("reads a 409 as the show having become the on-air show", () => {
    expect(
      classifyForceEndError(
        wrapped(
          409,
          "Conflict: this is the current on-air show. Re-send with ?force=true to end it anyway."
        )
      )
    ).toBe("now_on_air");
  });

  it.each([[403], [404]])("reads a %i as a plain refusal", (status) => {
    expect(classifyForceEndError(wrapped(status))).toBe("refused");
  });

  it("treats a 5xx as indeterminate — the close may have committed", () => {
    expect(classifyForceEndError(wrapped(500, "Internal Server Error"))).toBe(
      "indeterminate"
    );
  });

  it.each([["FETCH_ERROR"], ["TIMEOUT_ERROR"], ["PARSING_ERROR"]])(
    "treats a %s as indeterminate",
    (status) => {
      expect(classifyForceEndError(wrapped(status))).toBe("indeterminate");
    }
  );

  // An unwrapped rejection never passed through transformErrorResponse, so it
  // did not come off this mutation's wire — a thrown condition, an aborted
  // dispatch. Its status (even a plausible-looking 409) proves nothing about
  // what the server did, so the only safe answer is "unknown". Classifying it
  // as refused would skip invalidation on an outcome that may have written.
  it("treats an unwrapped rejection as indeterminate, never a refusal", () => {
    expect(classifyForceEndError({ status: 409, data: {} })).toBe(
      "indeterminate"
    );
    expect(classifyForceEndError({ status: 400, data: { message: "Bad Request: show is already ended" } })).toBe(
      "indeterminate"
    );
  });

  it.each([[null], [undefined], ["boom"], [42]])(
    "treats %s as indeterminate",
    (err) => {
      expect(classifyForceEndError(err)).toBe("indeterminate");
    }
  );
});

describe("force-end prompt constants", () => {
  // Pinned as literals, not references: the e2e and component suites spell
  // these ids out, so a rename must fail here rather than silently un-drive
  // the dialog — the same contract go-live-handoff.test.ts pins.
  it("pins the testids the suites spell as literals", () => {
    expect(FORCE_END_TESTIDS).toEqual({
      dialog: "force-end-dialog",
      confirm: "force-end-confirm",
      cancel: "force-end-cancel",
    });
  });

  it("keeps every outcome's sentence distinct", () => {
    const sentences = [
      FORCE_END_COPY.ended,
      FORCE_END_COPY.alreadyEnded,
      FORCE_END_COPY.refused,
      FORCE_END_COPY.indeterminate,
    ];
    expect(new Set(sentences).size).toBe(sentences.length);
    for (const sentence of sentences) {
      expect(sentence.length).toBeGreaterThan(0);
    }
  });

  it("says what ending the on-air show does to the DJ on it", () => {
    expect(FORCE_END_COPY.currentWarning).toMatch(/signs the current DJ off/i);
  });
});
