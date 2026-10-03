import { describe, it, expect } from "vitest";
import {
  canMoveRotationRow,
  freeTextRotationMoveRequest,
  rotationMoveRetireIds,
  rotationRowCode,
  rotationRowPresentation,
  selectRotationAdminView,
} from "@/lib/features/rotation/adminList";
import { RotationBin, type RotationListRow } from "@/lib/features/rotation/types";
import { createTestRotationListRow } from "@/tests/fixtures/fixtures";

const unlinked = (overrides: Partial<RotationListRow> = {}): RotationListRow =>
  createTestRotationListRow({
    id: null,
    code_letters: null,
    code_artist_number: null,
    code_number: null,
    genre_name: null,
    format_name: null,
    artist_name: "Chuquimamani-Condori",
    album_title: "Edits",
    record_label: "self-released",
    ...overrides,
  });

describe("rotationRowCode", () => {
  it.each([
    ["all parts present", createTestRotationListRow(), "Rock SL 1/3"],
    ["no genre name", createTestRotationListRow({ genre_name: null }), "SL 1/3"],
    // Backend-Service files every compilation at code_letters "V/A",
    // code_artist_number 0 -- joined naively that is the nonexistent "V/A 0/3".
    [
      "Various Artists bucket",
      createTestRotationListRow({ code_letters: "V/A", code_artist_number: 0 }),
      "Rock V/A-3",
    ],
    ["unlinked row (no code columns)", unlinked(), null],
  ])("%s", (_name, input, expected) => {
    expect(rotationRowCode(input)).toBe(expected);
  });
});

describe("rotationRowPresentation", () => {
  // Presence, not arrival: a future-dated kill is already killed here, so the
  // row shows its scheduled date and offers Unkill instead of a second Kill.
  it.each([
    ["never killed", null, "active"],
    ["killed in the past", "2026-09-01", "killed"],
    ["future-dated kill", "2099-01-01", "killed"],
  ])("%s -> %s", (_name, killDate, expected) => {
    expect(rotationRowPresentation(createTestRotationListRow({ rotation_kill_date: killDate }))).toBe(
      expected,
    );
  });
});

describe("selectRotationAdminView", () => {
  const IHOMF = createTestRotationListRow(); // H, added 09-05, active
  const NILUFER = createTestRotationListRow({
    rotation_id: 5002,
    id: 9002,
    artist_name: "Nilüfer Yanya",
    album_title: "Painless",
    record_label: "ATO",
    code_letters: "NI",
    code_artist_number: 2,
    code_number: 2,
    rotation_add_date: "2026-09-03",
    card: { id: 31, bin: RotationBin.H, number: 1, name: "Late Aug" },
  });
  const HALO = createTestRotationListRow({
    rotation_id: 5003,
    id: 9003,
    artist_name: "Juana Molina",
    album_title: "Halo",
    record_label: "Crammed Discs",
    code_letters: "JM",
    code_artist_number: 1,
    code_number: 2,
    rotation_bin: RotationBin.M,
    rotation_add_date: "2026-08-25",
    card: { id: 22, bin: RotationBin.M, number: 2, name: "Fresh Arrivals" },
  });
  const CHUQUI = unlinked({ rotation_id: 5004, rotation_bin: RotationBin.M, rotation_add_date: "2026-08-30" });
  const DOTS_KILLED = createTestRotationListRow({
    rotation_id: 5005,
    id: 9004,
    album_title: "Dots and Loops",
    code_number: 2,
    rotation_bin: RotationBin.M,
    rotation_add_date: "2026-06-02",
    rotation_kill_date: "2026-09-01",
    card: { id: 21, bin: RotationBin.M, number: 1, name: null },
  });
  const ALL = [IHOMF, NILUFER, HALO, CHUQUI, DOTS_KILLED];
  const none = { search: "", bin: null, cardId: null };

  it("splits presentations, sorts most recently added first, and reports unnarrowed totals", () => {
    const view = selectRotationAdminView(ALL, none);
    expect(view.active.map((r) => r.rotation_id)).toEqual([5001, 5002, 5004, 5003]);
    expect(view.killed.map((r) => r.rotation_id)).toEqual([5005]);
    expect(view.activeTotal).toBe(4);
    expect(view.killedTotal).toBe(1);
    expect(view.narrowed).toBe(false);
    expect(view.searchedActiveCount).toBe(4);
    expect(view.binCounts.get(RotationBin.H)).toBe(2);
    expect(view.binCounts.get(RotationBin.M)).toBe(2);
    expect(view.binCounts.get(RotationBin.L)).toBe(0);
    expect(view.binCounts.get(RotationBin.S)).toBe(0);
    // Card counts only exist under a single selected bin.
    expect(view.cardCounts.size).toBe(0);
  });

  it("never dedupes same-artist re-adds — every row is a row an MD may kill", () => {
    const readd = createTestRotationListRow({ rotation_id: 5006, rotation_bin: RotationBin.L, rotation_add_date: "2026-09-06" });
    const view = selectRotationAdminView([IHOMF, readd], none);
    expect(view.active.map((r) => r.rotation_id)).toEqual([5006, 5001]);
  });

  it.each([
    ["case-insensitively by artist", "stereolab", [5001], [5005]],
    ["diacritic-insensitively", "nilufer", [5002], []],
    ["by album title", "halo", [5003], []],
    ["by shelf code", "SL 1/3", [5001], []],
    ["with terms matched independently across fields", "stereolab dots", [], [5005]],
  ])("searches %s", (_name, search, activeIds, killedIds) => {
    const view = selectRotationAdminView(ALL, { ...none, search });
    expect(view.active.map((r) => r.rotation_id)).toEqual(activeIds);
    expect(view.killed.map((r) => r.rotation_id)).toEqual(killedIds);
    expect(view.narrowed).toBe(true);
  });

  it("search narrows the section counts against unfiltered totals", () => {
    const view = selectRotationAdminView(ALL, { ...none, search: "stereolab" });
    expect(view.activeTotal).toBe(4);
    expect(view.killedTotal).toBe(1);
    expect(view.active).toHaveLength(1);
    expect(view.killed).toHaveLength(1);
    expect(view.searchedActiveCount).toBe(1);
    expect(view.binCounts.get(RotationBin.H)).toBe(1);
    expect(view.binCounts.get(RotationBin.M)).toBe(0);
  });

  it("a bin filter narrows both presentations and scopes the card counts to that bin", () => {
    const view = selectRotationAdminView(ALL, { ...none, bin: RotationBin.M });
    expect(view.active.map((r) => r.rotation_id)).toEqual([5004, 5003]);
    expect(view.killed.map((r) => r.rotation_id)).toEqual([5005]);
    // Counts are for the active rows a card chip would show; the uncarded
    // unlinked row counts under no card.
    expect(view.cardCounts.get(22)).toBe(1);
    expect(view.cardCounts.get(21)).toBeUndefined();
  });

  it("a card filter composes with the bin filter and hides uncarded rows", () => {
    const view = selectRotationAdminView(ALL, { ...none, bin: RotationBin.M, cardId: 22 });
    expect(view.active.map((r) => r.rotation_id)).toEqual([5003]);
    expect(view.killed).toEqual([]);
    expect(view.narrowed).toBe(true);
  });

  it("treats a row with no card key — a backend older than the card join — the same as an explicitly uncarded row", () => {
    const haloMissingCardKey: RotationListRow = { ...HALO };
    delete haloMissingCardKey.card;
    const rows = [IHOMF, NILUFER, haloMissingCardKey, CHUQUI, DOTS_KILLED];
    // Hidden by the card filter, exactly like an uncarded row.
    const filteredByCard = selectRotationAdminView(rows, { ...none, bin: RotationBin.M, cardId: 22 });
    expect(filteredByCard.active).toEqual([]);
    // Still present with no card filter selected.
    const filteredByBinOnly = selectRotationAdminView(rows, { ...none, bin: RotationBin.M });
    expect(filteredByBinOnly.active.map((r) => r.rotation_id)).toEqual([5004, 5003]);
  });

  it("search composes with bin and card filters", () => {
    const view = selectRotationAdminView(ALL, { search: "juana", bin: RotationBin.M, cardId: 22 });
    expect(view.active.map((r) => r.rotation_id)).toEqual([5003]);
    const missed = selectRotationAdminView(ALL, { search: "stereolab", bin: RotationBin.M, cardId: 22 });
    expect(missed.active).toEqual([]);
    expect(missed.killed).toEqual([]);
  });

  describe("sort", () => {
    const KILLED_OLD_ADD = createTestRotationListRow({
      rotation_id: 5006,
      id: 9005,
      album_title: "Mars Audiac Quintet",
      rotation_bin: RotationBin.H,
      rotation_add_date: "2026-07-01",
      rotation_kill_date: "2026-09-02",
    });
    const KILLED_NEW_ADD = createTestRotationListRow({
      rotation_id: 5007,
      id: 9006,
      album_title: "Emperor Tomato Ketchup",
      rotation_bin: RotationBin.H,
      rotation_add_date: "2026-09-04",
      rotation_kill_date: "2026-09-10",
    });
    const WITH_KILLED = [...ALL, KILLED_OLD_ADD, KILLED_NEW_ADD];
    const ids = (rows: RotationListRow[]) => rows.map((r) => r.rotation_id);

    it("an absent sort and an explicit newest sort both keep most recently added first", () => {
      expect(ids(selectRotationAdminView(ALL, none).active)).toEqual([5001, 5002, 5004, 5003]);
      expect(ids(selectRotationAdminView(ALL, { ...none, sort: "newest" }).active)).toEqual([
        5001, 5002, 5004, 5003,
      ]);
    });

    it("oldest-first orders the Active cohort by rotation_add_date ascending", () => {
      const view = selectRotationAdminView(ALL, { ...none, sort: "oldest" });
      expect(ids(view.active)).toEqual([5003, 5004, 5002, 5001]);
      expect(view.active.map((r) => r.rotation_add_date)).toEqual([
        "2026-08-25",
        "2026-08-30",
        "2026-09-03",
        "2026-09-05",
      ]);
    });

    it("breaks a same-day tie by rotation_id ascending — filing order — regardless of input order", () => {
      const filedSecond = createTestRotationListRow({
        rotation_id: 5011,
        id: 9007,
        artist_name: "Cat Power",
        album_title: "Moon Pix",
        rotation_add_date: "2026-09-10",
      });
      const filedFirst = createTestRotationListRow({
        rotation_id: 5010,
        id: 9008,
        artist_name: "Juana Molina",
        album_title: "DOGA",
        rotation_add_date: "2026-09-10",
      });
      const view = selectRotationAdminView([filedSecond, filedFirst], { ...none, sort: "oldest" });
      expect(ids(view.active)).toEqual([5010, 5011]);
    });

    it.each([
      ["newest", [5007, 5006, 5005]],
      ["oldest", [5007, 5006, 5005]],
    ] as const)("keeps the Killed cohort in most-recently-added order under %s", (sort, expected) => {
      const view = selectRotationAdminView(WITH_KILLED, { ...none, sort });
      expect(ids(view.killed)).toEqual(expected);
    });

    it("is not a filter: the narrowed flag and every count are the same under either sort", () => {
      const newest = selectRotationAdminView(WITH_KILLED, { ...none, sort: "newest" });
      const oldest = selectRotationAdminView(WITH_KILLED, { ...none, sort: "oldest" });
      expect(oldest.narrowed).toBe(false);
      expect(oldest.narrowed).toBe(newest.narrowed);
      expect(oldest.activeTotal).toBe(newest.activeTotal);
      expect(oldest.killedTotal).toBe(newest.killedTotal);
      expect(oldest.searchedActiveCount).toBe(newest.searchedActiveCount);
      expect(oldest.binCounts).toEqual(newest.binCounts);
    });

    it("composes with a bin filter, still ordering only the rows the filter shows", () => {
      const view = selectRotationAdminView(WITH_KILLED, { ...none, bin: RotationBin.M, sort: "oldest" });
      expect(ids(view.active)).toEqual([5003, 5004]);
      expect(view.narrowed).toBe(true);
    });
  });
});

describe("freeTextRotationMoveRequest", () => {
  const noDetail = { format_id: null, label_id: null };

  it("carries the row's snapshot trio into the target bin, with no card_id", () => {
    expect(freeTextRotationMoveRequest(unlinked(), RotationBin.L, noDetail)).toEqual({
      rotation_bin: RotationBin.L,
      artist_name: "Chuquimamani-Condori",
      album_title: "Edits",
      record_label: "self-released",
    });
  });

  it("carries the single-row read's pre-catalog FKs and the row's urls", () => {
    const request = freeTextRotationMoveRequest(
      unlinked({ urls: ["chuquimamani.bandcamp.com/album/edits"] }),
      RotationBin.L,
      { format_id: 7, label_id: 42 },
    );
    expect(request).toEqual({
      rotation_bin: RotationBin.L,
      artist_name: "Chuquimamani-Condori",
      album_title: "Edits",
      record_label: "self-released",
      format_id: 7,
      label_id: 42,
      urls: ["chuquimamani.bandcamp.com/album/edits"],
    });
  });

  it.each([
    ["null", null],
    ["blank", "   "],
  ])("omits the record_label key when the label is %s — never an explicit null", (_name, label) => {
    const request = freeTextRotationMoveRequest(
      unlinked({ record_label: label }),
      RotationBin.L,
      noDetail,
    );
    expect(request).toEqual({
      rotation_bin: RotationBin.L,
      artist_name: "Chuquimamani-Condori",
      album_title: "Edits",
    });
    expect(request).not.toHaveProperty("record_label");
  });

  it("omits format_id, label_id, and urls rather than sending null or empty — the endpoint picks with != null", () => {
    const request = freeTextRotationMoveRequest(unlinked({ urls: [] }), RotationBin.L, noDetail);
    expect(request).not.toHaveProperty("format_id");
    expect(request).not.toHaveProperty("label_id");
    expect(request).not.toHaveProperty("urls");
  });

  it("omits urls for a row with no urls key — a backend older than the card join omits the key, not just an empty array", () => {
    const rowMissingUrlsKey: RotationListRow = unlinked();
    delete rowMissingUrlsKey.urls;
    const request = freeTextRotationMoveRequest(rowMissingUrlsKey, RotationBin.L, noDetail);
    expect(request).not.toHaveProperty("urls");
  });

  it.each([
    ["a null artist", { artist_name: null }],
    ["a blank title", { album_title: "  " }],
  ])("refuses a row with %s — the endpoint requires both", (_name, overrides) => {
    expect(freeTextRotationMoveRequest(unlinked(overrides), RotationBin.L, noDetail)).toBeNull();
  });
});

describe("rotationMoveRetireIds", () => {
  const moved = createTestRotationListRow(); // rotation 5001, H, active

  it("retires only the moved row when the album is not already in the target bin", () => {
    const elsewhere = createTestRotationListRow({ rotation_id: 5008, rotation_bin: RotationBin.L });
    expect(rotationMoveRetireIds([moved, elsewhere], moved, RotationBin.M)).toEqual([5001]);
  });

  it("also retires the album's active rows already in the target bin — an in-bin duplicate is invisible to every consumer", () => {
    const targetDuplicate = createTestRotationListRow({ rotation_id: 5008, rotation_bin: RotationBin.M });
    const otherAlbum = createTestRotationListRow({ rotation_id: 5009, id: 9002, rotation_bin: RotationBin.M });
    expect(rotationMoveRetireIds([moved, targetDuplicate, otherAlbum], moved, RotationBin.M)).toEqual(
      [5001, 5008],
    );
  });

  it("leaves the album's killed target-bin rows alone", () => {
    const killedDuplicate = createTestRotationListRow({
      rotation_id: 5008,
      rotation_bin: RotationBin.M,
      rotation_kill_date: "2026-09-01",
    });
    expect(rotationMoveRetireIds([moved, killedDuplicate], moved, RotationBin.M)).toEqual([5001]);
  });

  it("matches unlinked duplicates by the lowercased (artist, title) pair — the list read's own collapse key", () => {
    const movedUnlinked = unlinked({ rotation_id: 5004, rotation_bin: RotationBin.M });
    const sameSnapshot = unlinked({
      rotation_id: 5008,
      rotation_bin: RotationBin.L,
      artist_name: "CHUQUIMAMANI-CONDORI",
      album_title: "edits",
    });
    const differentTitle = unlinked({
      rotation_id: 5009,
      rotation_bin: RotationBin.L,
      album_title: "DJ E",
    });
    expect(
      rotationMoveRetireIds(
        [movedUnlinked, sameSnapshot, differentTitle],
        movedUnlinked,
        RotationBin.L,
      ),
    ).toEqual([5004, 5008]);
  });

  it("never collapses the linked and unlinked arms into each other, however alike their titles", () => {
    const movedUnlinked = unlinked({ rotation_id: 5004, rotation_bin: RotationBin.M });
    const linkedTwin = createTestRotationListRow({
      rotation_id: 5008,
      rotation_bin: RotationBin.L,
      artist_name: "Chuquimamani-Condori",
      album_title: "Edits",
    });
    expect(rotationMoveRetireIds([movedUnlinked, linkedTwin], movedUnlinked, RotationBin.L)).toEqual(
      [5004],
    );
    const movedLinked = createTestRotationListRow({ rotation_id: 5001, rotation_bin: RotationBin.H });
    const unlinkedTwin = unlinked({
      rotation_id: 5009,
      rotation_bin: RotationBin.M,
      artist_name: "Stereolab",
      album_title: "Instant Holograms on Metal Film",
    });
    expect(rotationMoveRetireIds([movedLinked, unlinkedTwin], movedLinked, RotationBin.M)).toEqual([
      5001,
    ]);
  });
});

describe("canMoveRotationRow", () => {
  it.each([
    ["a catalogued row", createTestRotationListRow(), true],
    // A catalogued row moves by album_id; its display snapshot is irrelevant.
    ["a catalogued row with no titles", createTestRotationListRow({ artist_name: null, album_title: null }), true],
    ["an unlinked row with a full snapshot", unlinked(), true],
    ["an unlinked row missing its title", unlinked({ album_title: null }), false],
  ])("%s", (_name, input, expected) => {
    expect(canMoveRotationRow(input)).toBe(expected);
  });
});
