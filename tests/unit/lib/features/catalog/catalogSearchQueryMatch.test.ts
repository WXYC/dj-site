import { describe, it, expect } from "vitest";
import { createTestAlbum } from "@/tests/helpers";
import {
  albumMatchesCatalogQueryArg,
  parseRotationBinsFromQueryArg,
} from "@/lib/features/catalog/catalogSearchQueryMatch";

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

  it("excludes non-streaming albums from on_streaming=false filter", () => {
    const streaming = createTestAlbum({ on_streaming: true });
    const notStreaming = createTestAlbum({ on_streaming: false });
    const unknown = createTestAlbum({ on_streaming: undefined });

    expect(
      albumMatchesCatalogQueryArg(notStreaming, { on_streaming: false }),
    ).toBe(true);
    expect(
      albumMatchesCatalogQueryArg(streaming, { on_streaming: false }),
    ).toBe(false);
    expect(
      albumMatchesCatalogQueryArg(unknown, { on_streaming: false }),
    ).toBe(false);
  });

  it("does not exclude unknown streaming status from on_streaming=true filter", () => {
    const unknown = createTestAlbum({ on_streaming: undefined });

    expect(
      albumMatchesCatalogQueryArg(unknown, { on_streaming: true }),
    ).toBe(true);
  });

  it("excludes missing albums from missing=false filter", () => {
    const present = createTestAlbum({ date_lost: undefined });
    const missing = createTestAlbum({
      date_lost: "2024-01-01",
      date_found: undefined,
    });

    expect(
      albumMatchesCatalogQueryArg(present, { missing: false }),
    ).toBe(true);
    expect(
      albumMatchesCatalogQueryArg(missing, { missing: false }),
    ).toBe(false);
  });
});
