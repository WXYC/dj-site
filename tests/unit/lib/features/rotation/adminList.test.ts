import { describe, it, expect } from "vitest";
import {
  rotationRowCode,
  rotationRowPresentation,
  selectRotationAdminView,
} from "@/lib/features/rotation/adminList";
import { RotationBin, type RotationListRow } from "@/lib/features/rotation/types";

function row(overrides: Partial<RotationListRow> = {}): RotationListRow {
  return {
    id: 9001,
    code_letters: "SL",
    code_artist_number: 1,
    code_number: 3,
    artist_name: "Stereolab",
    alphabetical_name: "Stereolab",
    album_title: "Instant Holograms on Metal Film",
    record_label: "Duophonic",
    label_id: null,
    genre_name: "Rock",
    format_name: "CD",
    rotation_id: 5001,
    add_date: "2026-09-05",
    rotation_add_date: "2026-09-05",
    rotation_bin: RotationBin.H,
    rotation_kill_date: null,
    plays: null,
    legacy_release_id: null,
    ...overrides,
  };
}

const unlinked = (overrides: Partial<RotationListRow> = {}): RotationListRow =>
  row({
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
    ["all parts present", row(), "Rock SL 1/3"],
    ["no genre name", row({ genre_name: null }), "SL 1/3"],
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
    expect(rotationRowPresentation(row({ rotation_kill_date: killDate }))).toBe(expected);
  });
});

describe("selectRotationAdminView", () => {
  const IHOMF = row(); // H, added 09-05, active
  const NILUFER = row({
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
  const HALO = row({
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
  const DOTS_KILLED = row({
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
    const readd = row({ rotation_id: 5006, rotation_bin: RotationBin.L, rotation_add_date: "2026-09-06" });
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

  it("search composes with bin and card filters", () => {
    const view = selectRotationAdminView(ALL, { search: "juana", bin: RotationBin.M, cardId: 22 });
    expect(view.active.map((r) => r.rotation_id)).toEqual([5003]);
    const missed = selectRotationAdminView(ALL, { search: "stereolab", bin: RotationBin.M, cardId: 22 });
    expect(missed.active).toEqual([]);
    expect(missed.killed).toEqual([]);
  });
});
