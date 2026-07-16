import { describe, it, expect } from "vitest";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import type { FlowsheetResults } from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchProvider";
import { deriveSmartResults } from "@/src/components/experiences/modern/flowsheet/SmartEntry/deriveSmartResults";

const album = (id: number, over: Partial<AlbumEntry> = {}) =>
  createTestAlbum({ id, ...over });

const results = (over: Partial<FlowsheetResults> = {}): FlowsheetResults => ({
  binResults: [],
  rotationResults: [],
  catalogResults: [],
  lmlResults: [],
  ...over,
});

const noFilters = { genres: [], formats: [], rotationTags: [] };

const derive = (r: FlowsheetResults, extra = {}) =>
  deriveSmartResults({
    results: r,
    filters: noFilters,
    locks: {},
    selectedMatchId: null,
    totalCap: 10,
    baseCap: 3,
    ...extra,
  });

describe("deriveSmartResults", () => {
  it("labels and orders groups bin → rotation → catalog → library", () => {
    const model = derive(
      results({
        binResults: [album(1)],
        rotationResults: [album(2)],
        catalogResults: [album(3)],
        lmlResults: [album(4)],
      })
    );
    expect(model.groups.map((g) => g.key)).toEqual([
      "bin",
      "rotation",
      "catalog",
      "library",
    ]);
    expect(model.groups.map((g) => g.label)).toEqual([
      "Your bin",
      "Rotation",
      "Card catalog",
      "Library",
    ]);
    expect(model.flat.map((e) => e.id)).toEqual([1, 2, 3, 4]);
  });

  it("omits empty groups", () => {
    const model = derive(results({ catalogResults: [album(3)] }));
    expect(model.groups.map((g) => g.key)).toEqual(["catalog"]);
  });

  it("dedupes an id to the highest-priority group", () => {
    const model = derive(
      results({
        rotationResults: [album(7)],
        catalogResults: [album(7)], // same id — should be dropped from catalog
      })
    );
    expect(model.groups.map((g) => g.key)).toEqual(["rotation"]);
    expect(model.flat.map((e) => e.id)).toEqual([7]);
  });

  it("drops the selected match from the groups", () => {
    const model = derive(
      results({ catalogResults: [album(1), album(2)] }),
      { selectedMatchId: 1 }
    );
    expect(model.flat.map((e) => e.id)).toEqual([2]);
  });

  describe("locked-field narrowing", () => {
    const stereolab = createTestArtist({ name: "Stereolab" });
    const cannedHeat = createTestArtist({ name: "Canned Heat" });

    it("keeps only entries whose artist exactly matches a locked artist", () => {
      const model = derive(
        results({
          catalogResults: [
            album(1, { artist: stereolab }),
            album(2, { artist: cannedHeat }),
          ],
        }),
        { locks: { artist: "Stereolab" } }
      );
      expect(model.flat.map((e) => e.id)).toEqual([1]);
    });

    it("matches locks case-insensitively", () => {
      const model = derive(
        results({ catalogResults: [album(1, { artist: stereolab })] }),
        { locks: { artist: "stereolab" } }
      );
      expect(model.flat.map((e) => e.id)).toEqual([1]);
    });

    it("narrows on a locked album title", () => {
      const model = derive(
        results({
          catalogResults: [
            album(1, { title: "Dots and Loops" }),
            album(2, { title: "Emperor Tomato Ketchup" }),
          ],
        }),
        { locks: { album: "Dots and Loops" } }
      );
      expect(model.flat.map((e) => e.id)).toEqual([1]);
    });
  });

  describe("filters", () => {
    it("filters by rotation bin", () => {
      const model = derive(
        results({
          rotationResults: [
            album(1, { rotation_bin: "H" }),
            album(2, { rotation_bin: "M" }),
          ],
        }),
        { filters: { genres: [], formats: [], rotationTags: ["H"] } }
      );
      expect(model.flat.map((e) => e.id)).toEqual([1]);
    });

    it("filters by format", () => {
      const model = derive(
        results({
          catalogResults: [
            album(1, { format: "Vinyl" }),
            album(2, { format: "CD" }),
          ],
        }),
        { filters: { genres: [], formats: ["Vinyl"], rotationTags: [] } }
      );
      expect(model.flat.map((e) => e.id)).toEqual([1]);
    });

    it("filters by genre", () => {
      const model = derive(
        results({
          catalogResults: [
            album(1, { artist: createTestArtist({ genre: "Jazz" }) }),
            album(2, { artist: createTestArtist({ genre: "Rock" }) }),
          ],
        }),
        { filters: { genres: ["Jazz"], formats: [], rotationTags: [] } }
      );
      expect(model.flat.map((e) => e.id)).toEqual([1]);
    });
  });

  it("caps total results across groups", () => {
    const many = (base: number) =>
      Array.from({ length: 5 }, (_, i) => album(base + i));
    const model = derive(
      results({
        binResults: many(10),
        rotationResults: many(20),
        catalogResults: many(30),
        lmlResults: many(40),
      }),
      { totalCap: 6, baseCap: 2 }
    );
    expect(model.flat.length).toBe(6);
  });
});
