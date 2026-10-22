import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RequestLineMode, SpotlightRole } from "@wxyc/shared/dtos";

// Both types first appear in the pinned release; importing them makes tsc
// fail on an older install, and the version check makes vitest fail too.
export type PinnedReleaseTypes = [RequestLineMode, SpotlightRole];

const readVersion = (path: string): string =>
  JSON.parse(readFileSync(path, "utf8")).version;

describe("@wxyc/shared pin", () => {
  it("installs the release the manifest pins, exactly", () => {
    const pinned = JSON.parse(readFileSync("package.json", "utf8"))
      .dependencies["@wxyc/shared"];
    expect(pinned).toBe("12.11.0");
    expect(readVersion("node_modules/@wxyc/shared/package.json")).toBe(pinned);
  });
});
