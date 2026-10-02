import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
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
    // "US/Eastern" is a real zone, but the runtime reports it as
    // "America/New_York", so the helper's own assertion throws -- after the
    // zone has moved. That throw must not skip the helper's cleanup.
    expect(() => stubProcessTimeZone("US/Eastern")).toThrow(
      /reports TZ="US\/Eastern" as "America\/New_York"/
    );
    // The zone did move, so the UTC the next case sees can only be the
    // cleanup's doing.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York");
  });

  it("is still back to the UTC pin after that failed call", () => {
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  it("blames the pool only when the zone did not move at all", () => {
    // "Etc/UTC" names the zone the process is already pinned to, so the
    // resolved zone reads the same before and after the stub -- from inside
    // the process, exactly what an inert stub under a thread pool looks like.
    expect(() => stubProcessTimeZone("Etc/UTC")).toThrow(
      /did not take effect.*`forks` pool/
    );
  });

  it("moves the zone again on a second call in the same test", () => {
    stubProcessTimeZone("Asia/Tokyo");
    stubProcessTimeZone("America/New_York");
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York");
  });

  it("unwinds both of those calls back to the UTC pin", () => {
    // Each call restores the value it found, so two cleanups land on the pin
    // only when the newest runs first.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  describe("beside an env stub the spec made itself", () => {
    beforeAll(() => {
      vi.stubEnv("RUNNER_TIMEZONE_SPEC_FLAG", "kept");
    });

    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it("moves the zone without disturbing that stub", () => {
      stubProcessTimeZone("Asia/Tokyo");
      expect(process.env.RUNNER_TIMEZONE_SPEC_FLAG).toBe("kept");
    });

    it("restores the zone and nothing else when the test finishes", () => {
      expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
      expect(process.env.RUNNER_TIMEZONE_SPEC_FLAG).toBe("kept");
    });
  });

  describe("called from beforeEach", () => {
    beforeEach(() => {
      stubProcessTimeZone("Asia/Tokyo");
    });

    it("has moved the zone by the time the test body runs", () => {
      expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Tokyo");
    });
  });

  it("is back to the UTC pin after a test whose beforeEach made the call", () => {
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  // Kept last: against a helper that moved the zone before it could fail,
  // this beforeAll would leave the rest of the file off the pin.
  describe("called where no test is running", () => {
    let thrown: unknown;
    let zoneAfterCall: string | undefined;

    beforeAll(() => {
      try {
        stubProcessTimeZone("Asia/Tokyo");
      } catch (error) {
        thrown = error;
      }
      zoneAfterCall = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    });

    it("throws before it moves the zone, leaving nothing to restore", () => {
      expect(thrown).toMatchObject({
        message: expect.stringContaining("can only be called inside a test"),
      });
      expect(zoneAfterCall).toBe("UTC");
    });
  });
});
