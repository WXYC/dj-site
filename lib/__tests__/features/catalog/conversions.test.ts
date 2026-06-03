import { describe, it, expect } from "vitest";
import { convertToAlbumEntry } from "@/lib/features/catalog/conversions";
import { convertQueryToSubmission } from "@/lib/features/flowsheet/conversions";
import {
  flowsheetSlice,
  defaultFlowsheetFrontendState,
} from "@/lib/features/flowsheet/frontend";
import { Rotation } from "@/lib/features/rotation/types";
import type { AlbumSearchResultJSON } from "@/lib/features/catalog/types";
import type { BinLibraryDetails } from "@wxyc/shared/dtos";

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

// Library-unlinked rotation row: `album_id` doesn't link to a library row
// (e.g. "Yenbett" by Noura Mint Seymali). The BS query COALESCEs artist/album/
// label from the rotation snapshot, but `library.id` is null.
//
// Three wire shapes are reachable in practice:
//   * `id: null` — postgres-js / Drizzle LEFT JOIN miss (current BS behavior).
//                  The `id !== undefined` discriminator returns TRUE here
//                  (`null !== undefined`), so rotation fields ALREADY survived
//                  pre-fix. Kept as a current-behavior baseline.
//   * `id: undefined` — what a future OpenAPI decoder, a client-side
//                       `?? undefined`, or a manual coercion would produce.
//                       This is the path the fix repairs.
//   * `id` key omitted — what JSON omission (the field absent from the wire
//                        body) would produce. The fix also repairs this.
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
const unlinkedRowOmittedId = unlinkedRowBase as unknown as AlbumSearchResultJSON;

// Real `BinLibraryDetails` shape per `@wxyc/shared/api.yaml:1505-1525` — 9
// fields, no `id`, no rotation fields, no `add_date`, no `plays`. This is the
// branch that exercises the `isSearchResult` gating for the library-bound
// fields (`add_date`, `plays`) and verifies the rotation fields stay
// undefined when the response doesn't declare them.
const binDetails: BinLibraryDetails = {
  album_id: 1234,
  album_title: "Edits",
  artist_name: "Chuquimamani-Condori",
  label: "self-released",
  code_letters: "QC",
  code_artist_number: 0,
  code_number: 0,
  format_name: "CD",
  genre_name: "Electronic",
};

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

    // These id:null assertions pass on BOTH pre-fix and post-fix code —
    // `null !== undefined` is TRUE, so `isSearchResult` returned TRUE and
    // rotation fields already survived. Kept as a current-behavior baseline
    // (so a future tightening like `response.id != null` would surface here),
    // NOT as a pin for the #691 fix. See the `id:undefined or omitted` block
    // below for the actual regression coverage.
    describe("library-unlinked rotation rows with id:null (current behavior baseline)", () => {
      it("preserves rotation_id", () => {
        const result = convertToAlbumEntry(unlinkedRowNullId);
        expect(result.rotation_id).toBe(5042);
      });

      it("preserves rotation_bin", () => {
        const result = convertToAlbumEntry(unlinkedRowNullId);
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
        // Two DISTINCT object references with equivalent payloads — pins the
        // cross-call stability React keys depend on (which a same-reference
        // call wouldn't catch; the function is pure on properties).
        const first = convertToAlbumEntry(unlinkedRowNullId);
        const second = convertToAlbumEntry({
          ...unlinkedRowBase,
          id: null as unknown as number,
        } as AlbumSearchResultJSON);
        expect(first.id).toBeLessThan(0);
        expect(first.id).toBe(second.id);
      });

      it("synthesizes DIFFERENT ids for different snapshots", () => {
        // Partial collision-freedom pin: two rows with different snapshot
        // fields must hash to different negative ids. (True collision-freedom
        // over arbitrary inputs is not testable; this guards the common case
        // and would catch a regression that, say, hashed only `artist_name`.)
        // Known collision risk: two unlinked rotation rows with IDENTICAL
        // snapshot fields but different rotation_ids would still collide —
        // tracked as a follow-up; see comment on `synthesizeAlbumId`.
        const yenbett = convertToAlbumEntry(unlinkedRowNullId);
        const otherUnlinked = convertToAlbumEntry({
          ...unlinkedRowBase,
          album_title: "DOGA",
          artist_name: "Juana Molina",
          label: "Sonamos",
          id: null as unknown as number,
        } as AlbumSearchResultJSON);
        expect(yenbett.id).not.toBe(otherUnlinked.id);
      });
    });

    // These are the actual #691 regression pins — both assertions FAIL on the
    // pre-fix code (revert lib/features/catalog/conversions.ts and rerun to
    // verify). The pre-fix discriminator `id !== undefined` evaluates FALSE
    // for `id: undefined` and FALSE for an omitted key, taking the
    // BinLibraryDetails branch and dropping `rotation_id` / `rotation_bin`.
    describe("library-unlinked rotation rows with id:undefined or omitted (regression for #691)", () => {
      it("preserves rotation_id when id is undefined", () => {
        const result = convertToAlbumEntry(unlinkedRowUndefinedId);
        expect(result.rotation_id).toBe(5042);
      });

      it("preserves rotation_id when id key is omitted", () => {
        // JSON omission is the most common upstream coercion mode — the
        // `id` field is simply absent from the response body. `"id" in
        // response` is FALSE; pre-fix isSearchResult false; pre-fix code
        // dropped rotation_id.
        const result = convertToAlbumEntry(unlinkedRowOmittedId);
        expect("id" in unlinkedRowOmittedId).toBe(false);
        expect(result.rotation_id).toBe(5042);
      });

      it("preserves rotation_bin when id is undefined", () => {
        const result = convertToAlbumEntry(unlinkedRowUndefinedId);
        expect(result.rotation_bin).toBe(Rotation.S);
      });

      it("preserves rotation_bin when id key is omitted", () => {
        const result = convertToAlbumEntry(unlinkedRowOmittedId);
        expect(result.rotation_bin).toBe(Rotation.S);
      });
    });

    // These tests exercise the actual `BinLibraryDetails` branch (no `id`,
    // no `rotation_*`, no `add_date`, no `plays`). They pin the
    // `isSearchResult` gating audit promised in the commit body: removing
    // any of the `isSearchResult ? ... : undefined` gates on add_date / plays
    // would surface a `TS2339: Property 'add_date' does not exist on type
    // 'BinLibraryDetails'` error here, OR — if the gate were replaced with
    // a runtime `in` check that silently returned undefined — these
    // assertions would still hold for these fields. The substantive pin is
    // that the rotation fields stay undefined for a real BinLibraryDetails,
    // which the `in`-operator check enforces correctly.
    describe("BinLibraryDetails responses (DJ bin browse, no rotation context)", () => {
      it("preserves album_id, title, artist", () => {
        const result = convertToAlbumEntry(binDetails);
        expect(result.id).toBe(1234);
        expect(result.title).toBe("Edits");
        expect(result.artist.name).toBe("Chuquimamani-Condori");
      });

      it("leaves rotation fields undefined (not declared on BinLibraryDetails)", () => {
        const result = convertToAlbumEntry(binDetails);
        expect(result.rotation_id).toBeUndefined();
        expect(result.rotation_bin).toBeUndefined();
      });

      it("leaves library-bound metadata undefined (add_date, plays not on BinLibraryDetails)", () => {
        const result = convertToAlbumEntry(binDetails);
        expect(result.add_date).toBeUndefined();
        expect(result.plays).toBeUndefined();
      });
    });

    describe("end-to-end: rotation pick → mutation submission", () => {
      // Asserts the chain the picker uses (per the #691 forensics):
      //   useGetRotationQuery (rotationApi.transformResponse)
      //     → convertToAlbumEntry
      //     → RotationEntryFields dispatches setRotationMetadata({ album_id, rotation_id, rotation_bin })
      //     → state.search.query
      //     → convertQueryToSubmission
      //     → wire payload
      it("carries album_id + rotation_id from a library-LINKED row through to the wire payload", () => {
        const albumEntry = convertToAlbumEntry(linkedRow);
        expect(albumEntry.id).toBe(1001);
        expect(albumEntry.rotation_id).toBe(5001);

        const state = flowsheetSlice.reducer(
          defaultFlowsheetFrontendState,
          flowsheetSlice.actions.setRotationMetadata({
            album_id: albumEntry.id,
            rotation_id: albumEntry.rotation_id,
            rotation_bin: albumEntry.rotation_bin,
          })
        );
        expect(state.search.query.album_id).toBe(1001);
        expect(state.search.query.rotation_id).toBe(5001);

        const submission = convertQueryToSubmission(state.search.query) as {
          album_id?: number;
          rotation_id?: number;
          rotation_bin?: Rotation;
        };
        // Pin both legs — earlier coverage asserted only rotation_id, which
        // would silently pass if a regression dropped album_id from the
        // submission (or routed it through a non-album union branch).
        expect(submission.album_id).toBe(1001);
        expect(submission.rotation_id).toBe(5001);
        expect(submission.rotation_bin).toBe(Rotation.H);
      });

      it("carries rotation_id from a library-UNLINKED row through to the wire payload", () => {
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

        const submission = convertQueryToSubmission(state.search.query) as {
          album_id?: number;
          rotation_id?: number;
        };
        expect(submission.rotation_id).toBe(5042);

        // KNOWN ISSUE (not introduced by #691; tracked separately): the
        // submission also carries the negative synthetic album_id from
        // `synthesizeAlbumId`. Backend-Service `flowsheet.controller.ts`
        // takes the `body.album_id != null` branch for any negative number,
        // calls `getAlbumFromDB(-X)` (returns undefined), then throws
        // TypeError on `albumInfo.record_label = ...`. The fix in this PR
        // restores rotation_id propagation through the conversion layer; the
        // end-to-end picker flow for library-unlinked rotation rows requires
        // a follow-up to either (a) strip negative ids in
        // `convertQueryToSubmission`, or (b) coerce to null when the id is
        // synthetic. Asserted here as the current observed behavior so the
        // test fails loudly if either layer changes without a coordinated
        // update.
        expect(submission.album_id).toBeLessThan(0);
      });
    });
  });
});
