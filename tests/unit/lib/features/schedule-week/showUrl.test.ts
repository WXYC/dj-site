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

  // Every one of these is a number to `Number()`, and every one of them lands
  // on a real row: 1000, 16, 12, 7, 12. A wrong `show` loads a different set,
  // so the notations no id is written in have to be refused outright rather
  // than parsed and hoped about.
  it.each(["1e3", "0x10", " 12 ", "\t12", "+7", "12 "])(
    "refuses %s rather than resolving it to some other row",
    (raw) => {
      expect(positiveIdParam(raw)).toBeNull();
    },
  );

  // Past 2^53 the parse rounds, and the rounded value can be another row's id.
  it("refuses a digit run too long to survive the parse", () => {
    expect(positiveIdParam("9007199254740993")).toBeNull();
  });

  // The largest id the parse can carry exactly is still an id.
  it("reads the largest exactly-representable id", () => {
    expect(positiveIdParam("9007199254740991")).toBe(9007199254740991);
  });
});
