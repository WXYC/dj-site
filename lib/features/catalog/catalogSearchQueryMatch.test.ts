import { describe, it, expect } from "vitest";
import { createTestAlbum } from "@/lib/test-utils";
import {
  albumMatchesCatalogQueryArg,
  parseRotationBinsFromQueryArg,
} from "./catalogSearchQueryMatch";

describe("parseRotationBinsFromQueryArg", () => {
  it("parses comma-separated bins", () => {
    expect(parseRotationBinsFromQueryArg("H,M")).toEqual(["H", "M"]);
  });

  it("ignores invalid tokens", () => {
    expect(parseRotationBinsFromQueryArg("H,N,X")).toEqual(["H"]);
  });
});

describe("albumMatchesCatalogQueryArg", () => {
  it("requires rotation_bin when rotation_bins filter is set", () => {
    const heavy = createTestAlbum({ rotation_bin: "H" });
    const none = createTestAlbum({ rotation_bin: undefined });

    expect(
      albumMatchesCatalogQueryArg(heavy, { rotation_bins: "H" }),
    ).toBe(true);
    expect(
      albumMatchesCatalogQueryArg(none, { rotation_bins: "H" }),
    ).toBe(false);
  });
});
