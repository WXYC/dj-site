import { describe, it, expect } from "vitest";

describe("runner time zone", () => {
  it("is pinned to UTC for this process, not merely declared in config", () => {
    // Behavioral, not textual: proves the zone the node pool's worker
    // actually resolved to, not just that a TZ line exists in the config.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });
});
