import { describe, it, expect } from "vitest";
import {
  convertBinToFlowsheet,
  convertBinToQueue,
} from "@/lib/features/bin/conversions";
import { convertToAlbumEntry } from "@/lib/features/catalog/conversions";
import {
  createTestBinResponse,
  createTestAlbum,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { Rotation } from "@/lib/features/rotation/types";

describe("bin conversions", () => {
  describe("convertToAlbumEntry", () => {
    it("should convert album_id to id", () => {
      const response = createTestBinResponse({
        album_id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
      });
      const result = convertToAlbumEntry(response);
      expect(result.id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
    });

    it("should convert album_title to title", () => {
      const response = createTestBinResponse({
        album_title: "Great Album",
      });
      const result = convertToAlbumEntry(response);
      expect(result.title).toBe("Great Album");
    });

    it("should extract artist name", () => {
      const response = createTestBinResponse({
        artist_name: "Cool Artist",
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.name).toBe("Cool Artist");
    });

    it("should extract artist lettercode", () => {
      const response = createTestBinResponse({
        code_letters: "CA",
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.lettercode).toBe("CA");
    });

    it("should extract artist numbercode", () => {
      const response = createTestBinResponse({
        code_artist_number: 42,
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.numbercode).toBe(42);
    });

    it("should extract artist genre", () => {
      const response = createTestBinResponse({
        genre_name: "Jazz",
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.genre).toBe("Jazz");
    });

    it("should use Unknown for null genre", () => {
      const response = createTestBinResponse({
        genre_name: null as unknown as string,
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.genre).toBe("Unknown");
    });

    it("should extract entry from code_number", () => {
      const response = createTestBinResponse({
        code_number: 99,
      });
      const result = convertToAlbumEntry(response);
      expect(result.entry).toBe(99);
    });

    it("should extract format", () => {
      const response = createTestBinResponse({
        format_name: "Vinyl",
      });
      const result = convertToAlbumEntry(response);
      expect(result.format).toBe("Vinyl");
    });

    it("should use Unknown for null format", () => {
      const response = createTestBinResponse({
        format_name: null as unknown as string,
      });
      const result = convertToAlbumEntry(response);
      expect(result.format).toBe("Unknown");
    });

    it("should extract label", () => {
      const response = createTestBinResponse({
        label: "Indie Records",
      });
      const result = convertToAlbumEntry(response);
      expect(result.label).toBe("Indie Records");
    });

    it("should handle undefined label as empty string", () => {
      const response = createTestBinResponse({
        label: undefined,
      });
      const result = convertToAlbumEntry(response);
      expect(result.label).toBe("");
    });

    it("should set alternate_artist to empty string", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.alternate_artist).toBe("");
    });

    it("should set rotation_bin to undefined", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.rotation_bin).toBeUndefined();
    });

    it("should set add_date to undefined", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.add_date).toBeUndefined();
    });

    it("should keep plays undefined for bin responses", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.plays).toBeUndefined();
    });

    it("should set rotation_id to undefined", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.rotation_id).toBeUndefined();
    });

    it("should set artist.id to undefined", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.artist.id).toBeUndefined();
    });
  });

  describe("convertBinToFlowsheet", () => {
    const createBinEntry = (overrides: Partial<AlbumEntry> = {}): AlbumEntry =>
      createTestAlbum(overrides);

    // Type for the actual return shape from convertBinToFlowsheet
    type BinFlowsheetResult = {
      album_id: number;
      track_title: string;
      artist_name: string;
      record_label: string;
      rotation_id?: number;
      request_flag: boolean;
    };

    it("should convert album_id", () => {
      const binEntry = createBinEntry({ id: 123 });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetResult;
      expect(result.album_id).toBe(123);
    });

    it("should use album title as track_title", () => {
      const binEntry = createBinEntry({ title: "Cool Album" });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetResult;
      expect(result.track_title).toBe("Cool Album");
    });

    // Catalog variant intentionally omits artist_name — the wire schema's
    // FlowsheetCreateSongFromCatalog (@wxyc/shared) has no such field, and
    // BS backfills artist info from the library row keyed by album_id
    // (apps/backend/controllers/flowsheet.controller.ts addEntry, lookup
    // branch). Sending it would be a no-op at best and a type-violation
    // against the wire union. Freeform branch coverage for artist_name
    // preservation lives in the `synthesized negative album_id` describe
    // block below.

    it("should include record_label", () => {
      const binEntry = createBinEntry({ label: "Big Label" });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetResult;
      expect(result.record_label).toBe("Big Label");
    });

    it("should include rotation_id when present", () => {
      const binEntry = createBinEntry({
        rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
      });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetResult;
      expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
    });

    it("should set request_flag to false", () => {
      const binEntry = createBinEntry();
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetResult;
      expect(result.request_flag).toBe(false);
    });

    // #608 — "Play Now from bin" on a library-unlinked bin row was sending
    // the synthesized negative `album_id` (from synthesizeAlbumId) straight
    // through to POST /flowsheet/, bypassing the convertQueryToSubmission
    // gate Jake added in 04f027a. BS branches on `album_id != null` and
    // takes the library-lookup path on negative numbers → TypeError 500.
    // Gate at source: drop album_id when synthesized, route via freeform
    // with the snapshot fields BS's else branch requires. As of
    // @wxyc/shared 1.9.0 (BS#1308) the freeform variant carries rotation_id,
    // so the rotation linkage stays on the wire too.
    describe("synthesized negative album_id", () => {
      type FreeformResult = {
        album_id?: undefined;
        track_title: string;
        artist_name: string;
        album_title: string;
        record_label?: string;
        rotation_id?: number;
        request_flag: boolean;
      };

      it("omits album_id when binEntry.id is negative (synthesized)", () => {
        const binEntry = createBinEntry({ id: -987654321 });
        const result = convertBinToFlowsheet(binEntry) as FreeformResult;
        expect(result.album_id).toBeUndefined();
      });

      it("carries the album_title snapshot field BS's freeform branch requires", () => {
        const binEntry = createBinEntry({ id: -1, title: "Tzenni" });
        const result = convertBinToFlowsheet(binEntry) as FreeformResult;
        expect(result.album_title).toBe("Tzenni");
      });

      it("preserves rotation_id on the freeform shape (BS#1308 / @wxyc/shared 1.9.0)", () => {
        const binEntry = createBinEntry({
          id: -1,
          rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
        });
        const result = convertBinToFlowsheet(binEntry) as FreeformResult;
        expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
      });

      it("still carries artist_name + track_title + record_label snapshot", () => {
        const binEntry = createBinEntry({
          id: -1,
          title: "Tzenni",
          label: "Glitterbeat",
          artist: {
            id: undefined,
            name: "Noura Mint Seymali",
            lettercode: "S",
            numbercode: 1,
            genre: "Unknown",
          },
        });
        const result = convertBinToFlowsheet(binEntry) as FreeformResult;
        expect(result.artist_name).toBe("Noura Mint Seymali");
        expect(result.track_title).toBe("Tzenni");
        expect(result.record_label).toBe("Glitterbeat");
      });

      it("leaves positive ids unchanged (catalog variant still emits album_id)", () => {
        const binEntry = createBinEntry({ id: 42 });
        const result = convertBinToFlowsheet(binEntry) as BinFlowsheetResult;
        expect(result.album_id).toBe(42);
      });
    });
  });

  describe("convertBinToQueue", () => {
    const createBinEntry = (overrides: Partial<AlbumEntry> = {}): AlbumEntry =>
      createTestAlbum(overrides);

    it("should convert album_id", () => {
      const binEntry = createBinEntry({ id: 456 });
      const result = convertBinToQueue(binEntry);
      expect(result.album_id).toBe(456);
    });

    it("should set song to empty string", () => {
      const binEntry = createBinEntry({ title: "Album Title" });
      const result = convertBinToQueue(binEntry);
      expect(result.song).toBe("");
    });

    it("should use album title as album field", () => {
      const binEntry = createBinEntry({ title: "Album Title" });
      const result = convertBinToQueue(binEntry);
      expect(result.album).toBe("Album Title");
    });

    it("should include artist name", () => {
      const binEntry = createBinEntry({
        artist: { id: undefined, name: "Queue Artist", lettercode: "QA", numbercode: 1, genre: "Electronic" },
      });
      const result = convertBinToQueue(binEntry);
      expect(result.artist).toBe("Queue Artist");
    });

    it("should include label", () => {
      const binEntry = createBinEntry({ label: "Queue Label" });
      const result = convertBinToQueue(binEntry);
      expect(result.label).toBe("Queue Label");
    });

    it("should include rotation_id", () => {
      const binEntry = createBinEntry({
        rotation_id: TEST_ENTITY_IDS.ROTATION.MEDIUM,
      });
      const result = convertBinToQueue(binEntry);
      expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.MEDIUM);
    });

    it("should include rotation_bin", () => {
      const binEntry = createBinEntry({ rotation_bin: Rotation.H });
      const result = convertBinToQueue(binEntry);
      expect(result.rotation_bin).toBe(Rotation.H);
    });

    it("should set request to false", () => {
      const binEntry = createBinEntry();
      const result = convertBinToQueue(binEntry);
      expect(result.request).toBe(false);
    });
  });
});
