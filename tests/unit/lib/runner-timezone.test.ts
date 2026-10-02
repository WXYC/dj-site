import { describe, it, expect } from "vitest";

describe("runner time zone", () => {
  it("is pinned to UTC for this process, not merely declared in config", ({ task }) => {
    // The zone check proves a project only while this file runs in it;
    // routed to another project it would keep passing and prove that one.
    expect(task.file.projectName).toBe("node");
    // Behavioral, not textual: proves the zone the node project's worker
    // actually resolved to, not just that a TZ line exists in the config.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });
});
