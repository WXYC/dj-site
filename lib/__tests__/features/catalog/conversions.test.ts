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
// Cloned (not aliased) so a later test mutating this fixture wouldn't
// silently corrupt `unlinkedRowBase` and the two spread-derived fixtures
// above. The `expect("id" in unlinkedRowOmittedId).toBe(false)` assertion in
// the omitted-key rotation_id test is load-bearing — keeping the clone
// isolates it.
const unlinkedRowOmittedId = {
  ...unlinkedRowBase,
} as unknown as AlbumSearchResultJSON;

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

// Real BS `/library/rotation` wire shape per the `Rotation` schema in
// `@wxyc/shared/api.yaml:1364` and `getRotationFromDB` in Backend-Service
// `apps/backend/services/library.service.ts:280-335`. The label field on the
// wire is `record_label` (BS aliases `COALESCE(library.label, rotation.record_label)
// AS record_label`), NOT `label`. dj-site#709: the rotation API was mistyping
// these rows as `AlbumSearchResultJSON[]` whose label field is `label`, so
// `convertToAlbumEntry` read `undefined` and coalesced to `""` on every
// rotation row — the empty string then flowed into `state.search.query.label`
// and was POSTed to BS as empty. Fixtures cover the populated, null, and
// omitted shapes the wire actually emits.
const rotationWireRowSonamos = {
  id: 1001,
  add_date: "2026-05-01T00:00:00.000Z",
  album_title: "DOGA",
  artist_name: "Juana Molina",
  code_letters: "RO",
  code_number: 42,
  code_artist_number: 14,
  format_name: "CD",
  genre_name: "Rock",
  record_label: "Sonamos",
  rotation_id: 5001,
  rotation_bin: "H",
  plays: 7,
} as unknown as AlbumSearchResultJSON;

const rotationWireRowNullLabel = {
  id: 1002,
  add_date: "2026-05-02T00:00:00.000Z",
  album_title: "Sometimes Forever",
  artist_name: "Soccer Mommy",
  code_letters: "SO",
  code_number: 7,
  code_artist_number: 12,
  format_name: "CD",
  genre_name: "Rock",
  record_label: null,
  rotation_id: 5002,
  rotation_bin: "M",
  plays: 3,
} as unknown as AlbumSearchResultJSON;

// Catalog search responses (`AlbumSearchResultJSON`) carry the label under
// `label`, not `record_label`. Regression guard so the wire-shape fallback
// doesn't break the catalog search path.
const catalogSearchRow: AlbumSearchResultJSON = {
  id: 2001,
  add_date: "2026-05-10T00:00:00.000Z",
  album_title: "Quarantine the Past",
  artist_name: "Pavement",
  code_letters: "PA",
  code_number: 18,
  code_artist_number: 9,
  format_name: "Vinyl",
  genre_name: "Rock",
  label: "Drag City",
  rotation_id: undefined,
  rotation_bin: undefined,
  plays: 11,
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

      it("synthesizes DIFFERENT ids when artist/album/label differ", () => {
        // Catches a regression that drops any of those three from the hash.
        const yenbett = convertToAlbumEntry(unlinkedRowNullId);
        const differentArtistAlbumLabel = convertToAlbumEntry({
          ...unlinkedRowBase,
          album_title: "DOGA",
          artist_name: "Juana Molina",
          label: "Sonamos",
          id: null as unknown as number,
        } as AlbumSearchResultJSON);
        expect(yenbett.id).not.toBe(differentArtistAlbumLabel.id);
      });

      // Per-field collision pins for synthesizeAlbumId. The hash inputs
      // are 6 fields (artist|album|label|letters|artist_num|num). A single
      // combined "all code_* differ at once" assertion would still pass if
      // a regression dropped any one of those fields from the hash key —
      // the remaining 5 inputs would still produce distinct hashes. Pin
      // each input individually by holding all others equal to
      // `unlinkedRowBase` (which has empty strings / zeros for code_*),
      // varying exactly one.
      it("synthesizes DIFFERENT ids when only code_letters differ", () => {
        const a = convertToAlbumEntry(unlinkedRowNullId);
        const b = convertToAlbumEntry({
          ...unlinkedRowBase,
          code_letters: "Z",
          id: null as unknown as number,
        } as AlbumSearchResultJSON);
        expect(a.id).not.toBe(b.id);
      });

      it("synthesizes DIFFERENT ids when only code_artist_number differs", () => {
        const a = convertToAlbumEntry(unlinkedRowNullId);
        const b = convertToAlbumEntry({
          ...unlinkedRowBase,
          code_artist_number: 7,
          id: null as unknown as number,
        } as AlbumSearchResultJSON);
        expect(a.id).not.toBe(b.id);
      });

      it("synthesizes DIFFERENT ids when only code_number differs", () => {
        // Real WXYC case: a multi-format reissue (CD vs LP) of the same
        // release where the rotation snapshot carries different
        // code_number values but identical artist / album / label / letters
        // / code_artist_number.
        const a = convertToAlbumEntry(unlinkedRowNullId);
        const b = convertToAlbumEntry({
          ...unlinkedRowBase,
          code_number: 99,
          id: null as unknown as number,
        } as AlbumSearchResultJSON);
        expect(a.id).not.toBe(b.id);
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

    // dj-site#709 regression pins. BS `/library/rotation` returns rows shaped
    // by the contract `Rotation` schema where the label field is
    // `record_label`. The rotation API was mistyping responses as
    // `AlbumSearchResultJSON[]` whose label field is `label`, so the
    // conversion read `undefined` and coalesced to `""` on every rotation
    // row — the empty string then flowed into `state.search.query.label`
    // and was POSTed to BS as empty. Fix: read `record_label` first, fall
    // back to `label` (catalog search shape), then `""`.
    describe("rotation wire shape carries record_label (dj-site#709)", () => {
      it("reads record_label when present (rotation wire shape)", () => {
        const result = convertToAlbumEntry(rotationWireRowSonamos);
        expect(result.label).toBe("Sonamos");
      });

      it("falls through to empty string when record_label is null", () => {
        const result = convertToAlbumEntry(rotationWireRowNullLabel);
        expect(result.label).toBe("");
      });

      it("still reads label on the catalog search wire shape (regression guard)", () => {
        const result = convertToAlbumEntry(catalogSearchRow);
        expect(result.label).toBe("Drag City");
      });

      // BinLibraryDetails has `label` (not `record_label`) per
      // `@wxyc/shared/api.yaml:1505-1525`. The new fallback chain
      // (`record_label` → `label` → `""`) MUST still reach the
      // BinLibraryDetails `label` field: `"record_label" in response` is
      // FALSE for a real bin row → undefined → falls through to
      // `response.label` → "self-released". Pins the bin path so a future
      // tightening (e.g. dropping the `?? response.label` arm or reordering
      // the union) can't silently regress bin-detail label rendering.
      it("still reads label on the BinLibraryDetails wire shape (no record_label key)", () => {
        expect("record_label" in binDetails).toBe(false);
        const result = convertToAlbumEntry(binDetails);
        expect(result.label).toBe("self-released");
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

      it("drops album_id + rotation linkage on the wire for a library-UNLINKED (id:undefined) row", () => {
        const albumEntry = convertToAlbumEntry(unlinkedRowUndefinedId);
        expect(albumEntry.rotation_id).toBe(5042);
        expect(albumEntry.rotation_bin).toBe(Rotation.S);

        const state = flowsheetSlice.reducer(
          defaultFlowsheetFrontendState,
          flowsheetSlice.actions.setRotationMetadata({
            album_id: albumEntry.id,
            rotation_id: albumEntry.rotation_id,
            rotation_bin: albumEntry.rotation_bin,
          })
        );
        // The synthesized id and the rotation metadata both still live in
        // Redux state — they're load-bearing for the picker UI (React keys,
        // displaying the bin badge on the selected row). Only the wire
        // payload is gated.
        expect(state.search.query.album_id).toBe(albumEntry.id);
        expect(state.search.query.album_id).toBeLessThan(0);
        expect(state.search.query.rotation_id).toBe(5042);
        expect(state.search.query.rotation_bin).toBe(Rotation.S);

        const submission = convertQueryToSubmission(state.search.query) as {
          album_id?: number;
          rotation_id?: number;
          rotation_bin?: Rotation;
        };
        // dj-site#701 fix: `convertQueryToSubmission` gates the catalog
        // variant on `album_id > 0`. Synthesized negative ids fall through
        // to the freeform variant — BS used to take `albumId != null` on
        // negative numbers and TypeError; now the unlinked-row submit just
        // loses rotation linkage on the wire (recoverable when BS-side
        // schema work lets `rotation_id` ride without `album_id`).
        // Freeform `artist_name` / `album_title` come from sibling
        // `setSearchProperty` dispatches in the live picker, not from
        // `setRotationMetadata`; out of scope for this e2e.
        expect(submission.album_id).toBeUndefined();
        expect(submission.rotation_id).toBeUndefined();
        expect(submission.rotation_bin).toBeUndefined();
      });

      it("drops album_id + rotation linkage on the wire for a library-UNLINKED (id omitted) row", () => {
        // Sibling coverage for the omitted-key wire shape — JSON omission
        // is the most common upstream coercion mode. Both id-absence shapes
        // (id:undefined and id-omitted) take the FALSE branch of
        // `isSearchResult` and the same `synthesizeAlbumId` path; the only
        // observable difference is whether `"id" in response` short-circuits
        // inside the discriminator. Structurally symmetric to the
        // id:undefined sibling above so a regression that diverged only one
        // path (e.g., a future reducer that special-cased absent keys)
        // would surface here, not pass silently.
        const albumEntry = convertToAlbumEntry(unlinkedRowOmittedId);
        expect(albumEntry.rotation_id).toBe(5042);
        expect(albumEntry.rotation_bin).toBe(Rotation.S);

        const state = flowsheetSlice.reducer(
          defaultFlowsheetFrontendState,
          flowsheetSlice.actions.setRotationMetadata({
            album_id: albumEntry.id,
            rotation_id: albumEntry.rotation_id,
            rotation_bin: albumEntry.rotation_bin,
          })
        );
        expect(state.search.query.album_id).toBe(albumEntry.id);
        expect(state.search.query.album_id).toBeLessThan(0);
        expect(state.search.query.rotation_id).toBe(5042);
        expect(state.search.query.rotation_bin).toBe(Rotation.S);

        const submission = convertQueryToSubmission(state.search.query) as {
          album_id?: number;
          rotation_id?: number;
          rotation_bin?: Rotation;
        };
        // See sibling id:undefined e2e for the dj-site#701 gate rationale.
        expect(submission.album_id).toBeUndefined();
        expect(submission.rotation_id).toBeUndefined();
        expect(submission.rotation_bin).toBeUndefined();
      });
    });
  });
});
