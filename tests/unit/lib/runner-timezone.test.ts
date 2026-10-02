import { describe, it, expect } from "vitest";
import { stubProcessTimeZone } from "@/tests/helpers/time.vitest";

describe("runner time zone", () => {
  it("is pinned to UTC for this process, not merely declared in config", ({ task }) => {
    // The zone check proves a project only while this file runs in it;
    // routed to another project it would keep passing and prove that one.
    expect(task.file.projectName).toBe("node");
    // Behavioral, not textual: proves the zone the node project's worker
    // actually resolved to, not just that a TZ line exists in the config.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  it("moves this process's resolved zone to the one asked for", () => {
    stubProcessTimeZone("Asia/Tokyo");
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Tokyo");
  });

  it("is back to the UTC pin in the next test, proving the stub's own cleanup ran", () => {
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  it("restores the zone even when the stub's own assertion fails", () => {
    // "US/Eastern" is a valid IANA zone name but not the canonical one --
    // Intl resolves it to "America/New_York", so the helper's own assertion
    // throws here. That throw must not skip the helper's cleanup.
    expect(() => stubProcessTimeZone("US/Eastern")).toThrow();
  });

  it("is still back to the UTC pin after that failed call", () => {
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });
});
