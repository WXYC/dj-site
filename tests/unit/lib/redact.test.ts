import { describe, it, expect } from "vitest";
import { redactEmails, redactEmailsDeep } from "@/lib/redact";

describe("redactEmails", () => {
  it.each([
    ["dj@wxyc.org", "[email]"],
    ["no member with email dj@wxyc.org found", "no member with email [email] found"],
    [
      "merge conflict between dj@wxyc.org and station.manager+admin@wxyc.co.uk",
      "merge conflict between [email] and [email]",
    ],
    ["nothing to redact here", "nothing to redact here"],
    // Not an address: no domain dot. Left alone rather than over-redacting
    // text that merely contains an @ (e.g. a handle or a npm scope).
    ["@wxyc mentioned it", "@wxyc mentioned it"],
  ])("redacts %j", (input, expected) => {
    expect(redactEmails(input)).toBe(expected);
  });
});

describe("redactEmailsDeep", () => {
  it("redacts strings nested in objects and arrays", () => {
    expect(
      redactEmailsDeep({
        message: "failed for dj@wxyc.org",
        list: [{ value: "also station.manager@wxyc.org" }],
        status: 403,
        flagged: true,
        missing: null,
      })
    ).toEqual({
      message: "failed for [email]",
      list: [{ value: "also [email]" }],
      status: 403,
      flagged: true,
      missing: null,
    });
  });

  it("leaves non-plain objects untouched so SDK structures aren't mangled", () => {
    const error = new Error("from dj@wxyc.org");
    const result = redactEmailsDeep({ error }) as { error: Error };

    expect(result.error).toBe(error);
  });

  it("stops at the depth limit instead of recursing without bound", () => {
    // 6 levels deep: past MAX_DEPTH, so the innermost string is returned as-is
    // rather than walked. Bounded traversal matters more than redacting text
    // nobody nests that far.
    const deep = { a: { b: { c: { d: { e: { f: "dj@wxyc.org" } } } } } };

    expect(redactEmailsDeep(deep)).toEqual(deep);
  });

  it("terminates on a cyclic structure", () => {
    const cyclic: Record<string, unknown> = { note: "dj@wxyc.org" };
    cyclic.self = cyclic;

    expect(() => redactEmailsDeep(cyclic)).not.toThrow();
  });
});
