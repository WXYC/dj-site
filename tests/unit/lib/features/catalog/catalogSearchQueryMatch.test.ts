import { describe, it, expect } from "vitest";
import { createTestAlbum, createTestLmlLibraryItem } from "@/tests/helpers";
import { convertLmlItemToAlbumEntry } from "@/lib/features/lml/lml-conversions";
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

  // The filter values are the server's own format names, so the row's format
  // has to be that same text.
  it("matches the formats filter against the row's own format text", () => {
    const twelveInch = createTestAlbum({ format: '12" Vinyl' });
    const cd = createTestAlbum({ format: "CD" });

    expect(
      albumMatchesCatalogQueryArg(twelveInch, { formats: '12" Vinyl' }),
    ).toBe(true);
    expect(albumMatchesCatalogQueryArg(cd, { formats: '12" Vinyl' })).toBe(
      false,
    );
  });

  // Held against a real adapter, not a hand-built row: a conversion path that
  // narrows the format to a locally-known pair leaves its rows unable to match
  // any filter the server offered, and the filter then silently hides them.
  it("keeps a converted row matchable by the format the server filed it under", () => {
    const album = convertLmlItemToAlbumEntry(
      createTestLmlLibraryItem({ format: '12" Vinyl' }),
    );

    expect(albumMatchesCatalogQueryArg(album, { formats: '12" Vinyl' })).toBe(
      true,
    );
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
