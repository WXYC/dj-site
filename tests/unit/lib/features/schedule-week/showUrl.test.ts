import { describe, it, expect } from "vitest";
import {
  entryAnchorId,
  hrefForShowEntry,
  positiveIdParam,
} from "@/lib/features/schedule-week/showUrl";

describe("entryAnchorId", () => {
  // A bare number is not a valid selector target without escaping, so the
  // fragment the row link carries has to name a prefixed id.
  it("prefixes the playcut id", () => {
    expect(entryAnchorId(1951179)).toBe("entry-1951179");
  });
});

describe("hrefForShowEntry", () => {
  it("names the show, the playcut, and the anchor to scroll to", () => {
    expect(hrefForShowEntry(300, 901)).toBe("?show=300&entry=901#entry-901");
  });

  // Query-only, so it resolves against whatever path the listing is served on
  // and cannot carry a path that disagrees with it.
  it("carries no path of its own", () => {
    expect(hrefForShowEntry(300, 901)!.startsWith("?")).toBe(true);
  });

  // The backend projects a flowsheet row with a null show_id as 0, and no show
  // has that id, so there is no page to point at.
  it("refuses a play that belongs to no show", () => {
    expect(hrefForShowEntry(0, 901)).toBeNull();
  });
});

describe("positiveIdParam", () => {
  it("reads a row id off the URL", () => {
    expect(positiveIdParam("1951179")).toBe(1951179);
  });

  it.each([null, "", "0", "-3", "1.5", "901; drop"])(
    "resolves %s to nothing selected rather than to another row",
    (raw) => {
      expect(positiveIdParam(raw)).toBeNull();
    },
  );
});
