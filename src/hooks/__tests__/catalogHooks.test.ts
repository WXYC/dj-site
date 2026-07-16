import { describe, it, expect } from "vitest";
import {
  buildCatalogQuery,
  dedupeAlbumEntriesById,
  toLibraryQueryParams,
} from "../catalogHooks";
import { createTestAlbum } from "@/tests/helpers";
import type {
  CatalogFilters,
  CatalogSearchRow,
} from "@/lib/features/catalog/types";

const row = (overrides: Partial<CatalogSearchRow>): CatalogSearchRow => ({
  id: overrides.id ?? "row-0",
  operator: "AND",
  field: "all",
  value: "",
  exact: false,
  ...overrides,
});

const defaultFilters: CatalogFilters = {
  genres: [],
  formats: [],
  tags: [],
};

describe("dedupeAlbumEntriesById", () => {
  it("keeps the first row for each album id", () => {
    const first = createTestAlbum({ id: 7000, title: "First" });
    const second = createTestAlbum({ id: 7000, title: "Second" });
    const other = createTestAlbum({ id: 2 });
    const deduped = dedupeAlbumEntriesById([first, second, other]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].title).toBe("First");
    expect(deduped[1].id).toBe(2);
  });

});

describe("buildCatalogQuery", () => {
  it("returns empty string for one empty row", () => {
    expect(buildCatalogQuery([row({})])).toBe("");
  });

  it("renders an all-field row as a bare term", () => {
    expect(buildCatalogQuery([row({ value: "Stereolab" })])).toBe("Stereolab");
  });

  it.each([
    ["artist", "artist:Stereolab"],
    ["album", "album:Stereolab"],
    ["label", "label:Stereolab"],
  ])("renders %s-field row with the prefix", (field, expected) => {
    const result = buildCatalogQuery([
      row({ field: field as CatalogSearchRow["field"], value: "Stereolab" }),
    ]);
    expect(result).toBe(expected);
  });

  it("wraps exact-match values in quotes", () => {
    const result = buildCatalogQuery([
      row({ field: "artist", value: "Cat Power", exact: true }),
    ]);
    expect(result).toBe('artist:"Cat Power"');
  });

  it("threads AND/OR/NOT operators across subsequent rows", () => {
    const result = buildCatalogQuery([
      row({ id: "1", field: "artist", value: "Stereolab" }),
      row({ id: "2", operator: "OR", field: "artist", value: "Cat Power" }),
      row({ id: "3", operator: "NOT", field: "label", value: "Drag City" }),
    ]);
    expect(result).toBe(
      "artist:Stereolab OR artist:Cat Power NOT label:Drag City"
    );
  });

  it("drops rows whose value is empty / whitespace-only", () => {
    const result = buildCatalogQuery([
      row({ id: "1", field: "artist", value: "Stereolab" }),
      row({ id: "2", operator: "OR", field: "album", value: "   " }),
      row({ id: "3", operator: "AND", field: "label", value: "Drag City" }),
    ]);
    expect(result).toBe("artist:Stereolab AND label:Drag City");
  });

  it("drops rows whose inner term is empty after quote stripping", () => {
    expect(buildCatalogQuery([row({ value: '""', exact: true })])).toBe("");
    expect(buildCatalogQuery([row({ value: '"', exact: true })])).toBe("");
  });
});

describe("toLibraryQueryParams", () => {
  it("threads slice state into the request params", () => {
    const params = toLibraryQueryParams(
      [row({ field: "artist", value: "Stereolab" })],
      { ...defaultFilters, genres: ["Rock", "Jazz"], tags: ["exclusives"] },
      2,
      "plays",
      "desc"
    );
    expect(params).toMatchObject({
      q: "artist:Stereolab",
      page: 2,
      sort: "plays",
      order: "desc",
      on_streaming: false,
      missing: undefined,
      genres: "Rock,Jazz",
      formats: undefined,
    });
    expect(params.limit).toBeGreaterThan(0);
  });

  it("maps missing tag to missing=true", () => {
    const params = toLibraryQueryParams(
      [row({})],
      { ...defaultFilters, tags: ["missing"] },
      0,
      "album",
      "asc"
    );
    expect(params.missing).toBe(true);
    expect(params.on_streaming).toBeUndefined();
  });

  it("maps rotation tags to comma-separated rotation_bins", () => {
    const params = toLibraryQueryParams(
      [row({})],
      { ...defaultFilters, tags: ["H", "M"] },
      0,
      "album",
      "asc"
    );
    expect(params.rotation_bins).toBe("H,M");
  });

  it("omits empty q when all rows are blank", () => {
    const params = toLibraryQueryParams(
      [row({})],
      defaultFilters,
      0,
      "album",
      "asc"
    );
    expect(params.q).toBeUndefined();
  });

  it("omits empty genre and format arrays from params", () => {
    const params = toLibraryQueryParams(
      [row({})],
      defaultFilters,
      0,
      "album",
      "asc"
    );
    expect(params.genres).toBeUndefined();
    expect(params.formats).toBeUndefined();
    expect(params.on_streaming).toBeUndefined();
    expect(params.genres).toBeUndefined();
    expect(params.formats).toBeUndefined();
  });

  it("emits comma-separated genres and formats", () => {
    const params = toLibraryQueryParams(
      [row({})],
      { ...defaultFilters, genres: ["Rock"], formats: ["cd", "Vinyl"] },
      0,
      "album",
      "asc"
    );
    expect(params.genres).toBe("Rock");
    expect(params.formats).toBe("cd,Vinyl");
  });
});
