import { describe, it, expect } from "vitest";
import { convertToAlbumEntry } from "@/lib/features/catalog/conversions";
import { convertQueryToSubmission } from "@/lib/features/flowsheet/conversions";
import {
  flowsheetSlice,
  defaultFlowsheetFrontendState,
} from "@/lib/features/flowsheet/frontend";
import { Rotation } from "@/lib/features/rotation/types";
import type { AlbumSearchResultJSON } from "@/lib/features/catalog/types";

// Library-linked rotation row: the LEFT JOIN to `library` populates `id`.
// Shape mirrors `getRotationFromDB`'s SELECT (Backend-Service
// `apps/backend/services/library.service.ts:280-335`).
const linkedRow: AlbumSearchResultJSON = {
  id: 1001,
  add_date: "2026-05-01T00:00:00.000Z",
  album_title: "DOGA",
  artist_name: "Juana Molina",
  code_letters: "RO",
  code_number: 42,
  code_artist_number: 14,
  format_name: "CD",
  genre_name: "Rock",
  label: "Sonamos",
  rotation_id: 5001,
  rotation_bin: "H",
  plays: 7,
};

// Library-unlinked rotation row: rotation row whose album_id doesn't link to
// a library row (e.g. "Yenbett" by Noura Mint Seymali — in rotation but not
// in the WXYC library catalog). The BS query COALESCEs artist/album/label
// from rotation's denormalized snapshot, but `library.id` is null.
//
// We exercise two wire shapes — `id: null` (what postgres-js / Drizzle
// produce from a LEFT JOIN miss; see BS `library.rotation.test.ts`) and
// `id: undefined` (what a future OpenAPI decoder, JSON-omitted field, or
// upstream code that coerces null → undefined would produce). Both must
// preserve rotation_id; only the latter is broken by the current
// `id !== undefined` discriminator.
const unlinkedRowBase = {
  add_date: "2026-05-15T00:00:00.000Z",
  album_title: "Yenbett",
  artist_name: "Noura Mint Seymali",
  code_letters: "",
  code_number: 0,
  code_artist_number: 0,
  format_name: "",
  genre_name: "",
  label: "Glitterbeat",
  rotation_id: 5042,
  rotation_bin: "S",
  plays: undefined,
};
const unlinkedRowNullId = {
  ...unlinkedRowBase,
  id: null as unknown as number,
} as AlbumSearchResultJSON;
const unlinkedRowUndefinedId = {
  ...unlinkedRowBase,
  id: undefined as unknown as number,
} as AlbumSearchResultJSON;

describe("catalog conversions", () => {
  describe("convertToAlbumEntry", () => {
    describe("library-linked rotation rows", () => {
      it("preserves rotation_id", () => {
        const result = convertToAlbumEntry(linkedRow);
        expect(result.rotation_id).toBe(5001);
      });

      it("preserves rotation_bin", () => {
        const result = convertToAlbumEntry(linkedRow);
        expect(result.rotation_bin).toBe("H");
      });

      it("preserves library-bound metadata (add_date, plays)", () => {
        const result = convertToAlbumEntry(linkedRow);
        expect(result.add_date).toBe("2026-05-01T00:00:00.000Z");
        expect(result.plays).toBe(7);
      });

      it("uses the real library id (positive)", () => {
        const result = convertToAlbumEntry(linkedRow);
        expect(result.id).toBe(1001);
      });
    });

    describe("library-unlinked rotation rows (regression for #691)", () => {
      it("preserves rotation_id when id is null (postgres-js LEFT JOIN miss)", () => {
        // BS returns library.id as null for rotation rows whose album_id
        // doesn't join to a library row. The picker still needs rotation_id
        // to populate the flowsheet entry so iOS can resolve rotation-derived
        // artwork.
        const result = convertToAlbumEntry(unlinkedRowNullId);
        expect(result.rotation_id).toBe(5042);
      });

      it("preserves rotation_id when id is undefined", () => {
        // The discriminator `"id" in response && response.id !== undefined`
        // returns false for the undefined-id shape, taking the BinLibraryDetails
        // branch even for what is structurally an unlinked rotation row.
        // rotation_id must survive regardless — it's populated by the rotation
        // table, independently of the library LEFT JOIN, on every row.
        const result = convertToAlbumEntry(unlinkedRowUndefinedId);
        expect(result.rotation_id).toBe(5042);
      });

      it("preserves rotation_bin when id is null", () => {
        // rotation_bin is a rotation-table column (line 313 of BS
        // getRotationFromDB), populated independently of the library LEFT
        // JOIN. Same defect class as rotation_id.
        const result = convertToAlbumEntry(unlinkedRowNullId);
        expect(result.rotation_bin).toBe(Rotation.S);
      });

      it("preserves rotation_bin when id is undefined", () => {
        const result = convertToAlbumEntry(unlinkedRowUndefinedId);
        expect(result.rotation_bin).toBe(Rotation.S);
      });

      it("preserves artist_name from the rotation snapshot (COALESCEd by BS)", () => {
        const result = convertToAlbumEntry(unlinkedRowNullId);
        expect(result.artist.name).toBe("Noura Mint Seymali");
      });

      it("preserves album title from the rotation snapshot", () => {
        const result = convertToAlbumEntry(unlinkedRowNullId);
        expect(result.title).toBe("Yenbett");
      });

      it("synthesizes a stable negative id for the missing library row", () => {
        const result = convertToAlbumEntry(unlinkedRowNullId);
        expect(result.id).toBeLessThan(0);
        // The synthetic id must be stable across calls so React keys don't
        // churn between renders.
        const second = convertToAlbumEntry(unlinkedRowNullId);
        expect(result.id).toBe(second.id);
      });

      it("leaves library-bound metadata undefined (add_date, plays)", () => {
        // These ARE legitimately gated on the library link: the BS query
        // sources them from `library.add_date` and `library.plays`, which
        // are null for unlinked rows.
        const result = convertToAlbumEntry({
          ...unlinkedRowNullId,
          add_date: undefined as unknown as string,
          plays: undefined,
        });
        expect(result.add_date).toBeUndefined();
        expect(result.plays).toBeUndefined();
      });
    });

    describe("end-to-end: rotation pick → mutation submission", () => {
      // Asserts the chain the picker uses (per the #691 forensics):
      //   useGetRotationQuery (rotationApi.transformResponse)
      //     → convertToAlbumEntry
      //     → RotationEntryFields dispatches setRotationMetadata({ rotation_id })
      //     → state.search.query.rotation_id
      //     → convertQueryToSubmission
      //     → wire payload
      // Bug #691 broke the second step; this asserts the field survives all
      // four for a library-unlinked rotation row.
      it("carries rotation_id from a library-unlinked row through to the wire payload", () => {
        const albumEntry = convertToAlbumEntry(unlinkedRowUndefinedId);
        expect(albumEntry.rotation_id).toBe(5042);

        const state = flowsheetSlice.reducer(
          defaultFlowsheetFrontendState,
          flowsheetSlice.actions.setRotationMetadata({
            album_id: albumEntry.id,
            rotation_id: albumEntry.rotation_id,
            rotation_bin: albumEntry.rotation_bin,
          })
        );
        expect(state.search.query.rotation_id).toBe(5042);

        const submission = convertQueryToSubmission(state.search.query);
        // The submission union exposes `rotation_id` only in the album_id
        // branch; assert via index access to avoid a type-narrowed dead end.
        expect((submission as { rotation_id?: number }).rotation_id).toBe(
          5042
        );
      });
    });
  });
});
