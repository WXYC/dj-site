import { describe, it, expect } from "vitest";
import {
  canDeleteRotationCard,
  groupRotationCardsByBin,
  groupRotationRowsByCardId,
  narrowCardAssignmentRows,
  rotationCardDeleteConflictMessage,
  rotationCardDeleteConflictReason,
  rotationCardName,
  rotationRecordLabel,
  rotationRowsToMoveOntoCard,
} from "@/lib/features/rotation/cards";
import type { RotationCardWithCount, RotationListRow } from "@/lib/features/rotation/types";
import { RotationBin } from "@/lib/features/rotation/types";
import { createTestRotationListRow } from "@/tests/fixtures/fixtures";

function card(overrides: Partial<RotationCardWithCount> = {}): RotationCardWithCount {
  return { id: 31, bin: RotationBin.H, number: 1, name: "Late Aug", active_count: 0, ...overrides };
}

describe("groupRotationCardsByBin", () => {
  it("groups per bin and orders each bin's cards by number", () => {
    const grouped = groupRotationCardsByBin([
      card({ id: 32, bin: RotationBin.H, number: 2 }),
      card({ id: 21, bin: RotationBin.M, number: 1 }),
      card({ id: 31, bin: RotationBin.H, number: 1 }),
    ]);

    expect(grouped.get(RotationBin.H)?.map((entry) => entry.id)).toEqual([31, 32]);
    expect(grouped.get(RotationBin.M)?.map((entry) => entry.id)).toEqual([21]);
    expect(grouped.get(RotationBin.S)).toBeUndefined();
  });
});

describe("canDeleteRotationCard", () => {
  const binCards = [
    card({ id: 31, number: 1, active_count: 3 }),
    card({ id: 32, number: 2, active_count: 0 }),
  ];

  it("allows only the bin's highest-numbered card when it holds no active rows", () => {
    expect(canDeleteRotationCard(binCards[1], binCards)).toBe(true);
  });

  it("refuses a card below the bin's highest number even when empty", () => {
    const lowerEmpty = card({ id: 31, number: 1, active_count: 0 });
    expect(canDeleteRotationCard(lowerEmpty, [lowerEmpty, binCards[1]])).toBe(false);
  });

  it("refuses the highest-numbered card while active rows are filed on it", () => {
    const highestOccupied = card({ id: 32, number: 2, active_count: 1 });
    expect(canDeleteRotationCard(highestOccupied, [binCards[0], highestOccupied])).toBe(false);
  });

  it("refuses a bin's only card even when empty — a bin never runs out of cards", () => {
    const onlyCard = card({ id: 31, number: 1, active_count: 0 });
    expect(canDeleteRotationCard(onlyCard, [onlyCard])).toBe(false);
  });
});

describe("rotationRowsToMoveOntoCard", () => {
  const HEAVY_CARD_2 = { id: 32, bin: RotationBin.H, number: 2, name: null };

  it("excludes ticked rows already on the card", () => {
    const onTheCard = createTestRotationListRow({ rotation_id: 5001, card: HEAVY_CARD_2 });
    const elsewhere = createTestRotationListRow({ rotation_id: 5002, card: null });

    expect(
      rotationRowsToMoveOntoCard([onTheCard, elsewhere], HEAVY_CARD_2, [5001, 5002]),
    ).toEqual([5002]);
  });

  it("returns ticked rows filed on a different card in the same bin", () => {
    const otherCardInBin = { id: 31, bin: RotationBin.H, number: 1, name: null };
    const onOtherCard = createTestRotationListRow({ rotation_id: 5002, card: otherCardInBin });

    expect(rotationRowsToMoveOntoCard([onOtherCard], HEAVY_CARD_2, [5002])).toEqual([5002]);
  });

  it("never returns a ticked row from another bin", () => {
    const mediumRow = createTestRotationListRow({
      rotation_id: 6001,
      rotation_bin: RotationBin.M,
      card: null,
    });

    expect(rotationRowsToMoveOntoCard([mediumRow], HEAVY_CARD_2, [6001])).toEqual([]);
  });

  it("returns nothing for an empty tick set", () => {
    expect(
      rotationRowsToMoveOntoCard([createTestRotationListRow({ rotation_id: 5001 })], HEAVY_CARD_2, []),
    ).toEqual([]);
  });
});

describe("narrowCardAssignmentRows", () => {
  const CARD_1 = { id: 11, bin: RotationBin.H, number: 1, name: null };
  const CARD_2 = { id: 12, bin: RotationBin.H, number: 2, name: null };
  const CARD_3 = { id: 13, bin: RotationBin.H, number: 3, name: "September" };
  const none = { search: "", stillOnFirstCardOnly: false };
  const ids = (rows: RotationListRow[]) => rows.map((row) => row.rotation_id);

  const ON_CARD_1 = createTestRotationListRow({
    rotation_id: 901,
    artist_name: "Juana Molina",
    album_title: "DOGA",
    card: CARD_1,
  });
  const NILUFER_HERE = createTestRotationListRow({
    rotation_id: 902,
    artist_name: "Nilüfer Yanya",
    album_title: "PAINLESS",
    card: CARD_3,
  });
  const UNCARDED = createTestRotationListRow({
    rotation_id: 903,
    artist_name: "Stereolab",
    album_title: "Dots and Loops",
    card: null,
  });
  // Factory defaults (artist "Stereolab", title "Instant Holograms on Metal
  // Film"): a two-word query must match when its words fall in different
  // fields, artist and title together.
  const STEREOLAB_HOLOGRAMS_HERE = createTestRotationListRow({
    rotation_id: 904,
    card: CARD_3,
  });
  const LUKASZ_HERE = createTestRotationListRow({
    rotation_id: 905,
    artist_name: "Łukasz",
    album_title: "Sample Record",
    card: CARD_3,
  });
  const ROWS = [ON_CARD_1, NILUFER_HERE, UNCARDED, STEREOLAB_HOLOGRAMS_HERE];

  it("splits a bin's rows into here and elsewhere with neither filter active", () => {
    const { here, elsewhere } = narrowCardAssignmentRows(ROWS, CARD_3, none);
    expect(ids(here)).toEqual([902, 904]);
    expect(ids(elsewhere)).toEqual([903, 901]);
  });

  it("keeps only elsewhere rows on the bin's card 1 when the toggle is on, leaving here untouched", () => {
    const { here, elsewhere } = narrowCardAssignmentRows(ROWS, CARD_3, {
      ...none,
      stillOnFirstCardOnly: true,
    });
    expect(ids(elsewhere)).toEqual([901]);
    expect(ids(here)).toEqual([902, 904]);
  });

  it.each([
    ["an artist query", "molina", [901]],
    ["a title query", "dots", [903]],
    ["a two-word query across artist and title", "stereolab holograms", [904]],
    ["a diacritic-insensitive query", "nilufer", [902]],
    ["a query for a letter NFD cannot decompose", "lukasz", [905]],
  ] as const)("narrows through the shared matcher: %s", (_label, search, expected) => {
    const { here, elsewhere } = narrowCardAssignmentRows([...ROWS, LUKASZ_HERE], CARD_3, { ...none, search });
    expect(ids([...here, ...elsewhere])).toEqual([...expected]);
  });

  it("narrows here as well as elsewhere", () => {
    const { here, elsewhere } = narrowCardAssignmentRows(ROWS, CARD_3, {
      ...none,
      search: "nilufer",
    });
    expect(ids(here)).toEqual([902]);
    expect(elsewhere).toEqual([]);
  });

  it("composes the toggle and search", () => {
    const { elsewhere } = narrowCardAssignmentRows(ROWS, CARD_3, {
      search: "nilufer",
      stillOnFirstCardOnly: true,
    });
    expect(elsewhere).toEqual([]);
  });

  it("ignores the 'still on card 1' toggle when the open card is card 1 itself", () => {
    // The panel hides this checkbox on card 1, so a row on another card must
    // still show up elsewhere even if the toggle were somehow still on.
    const onCard2 = createTestRotationListRow({ rotation_id: 1201, card: CARD_2 });
    const { elsewhere } = narrowCardAssignmentRows([onCard2], CARD_1, {
      ...none,
      stillOnFirstCardOnly: true,
    });
    expect(ids(elsewhere)).toEqual([1201]);
  });

  it("orders here by artist, through base-sensitivity collation (case and accents ignored)", () => {
    const wednesday = createTestRotationListRow({
      rotation_id: 1001,
      artist_name: "Wednesday",
      album_title: "Rat Saw God",
      card: CARD_3,
    });
    // Stylized lowercase in real use -- a naive case-sensitive compare would
    // sort it after "Wednesday", not before.
    const deerhoof = createTestRotationListRow({
      rotation_id: 1002,
      artist_name: "deerhoof",
      album_title: "Miracle-Level",
      card: CARD_3,
    });
    // Base-sensitivity collation compares "ş" as its base letter "s", so
    // "Aşıq Altay" sorts ahead of "Autechre" on their second letter (s before
    // u). Compared by raw code unit instead, the accented ş (U+015F) outranks
    // every plain ASCII letter and would put Autechre first.
    const asiqAltay = createTestRotationListRow({
      rotation_id: 1003,
      artist_name: "Aşıq Altay",
      album_title: "Dolu Kaval",
      card: CARD_3,
    });
    const autechre = createTestRotationListRow({
      rotation_id: 1004,
      artist_name: "Autechre",
      album_title: "Elseq 1-5",
      card: CARD_3,
    });
    const { here } = narrowCardAssignmentRows(
      [wednesday, deerhoof, NILUFER_HERE, asiqAltay, autechre],
      CARD_3,
      none,
    );
    expect(ids(here)).toEqual([1003, 1004, 1002, 902, 1001]);
  });

  it("orders a letter with no NFD decomposition by collation, not code point", () => {
    // Folding strips only combining marks, so "Ł" keeps a code point above
    // every ASCII letter and a fold-then-compare sort would put it after "Z".
    const littleSimz = createTestRotationListRow({
      rotation_id: 1200,
      artist_name: "Little Simz",
      album_title: "Sometimes I Might Be Introvert",
      card: CARD_3,
    });
    const lukasz = createTestRotationListRow({
      rotation_id: 1201,
      artist_name: "Łukasz",
      album_title: "Sample Record",
      card: CARD_3,
    });
    const lungfish = createTestRotationListRow({
      rotation_id: 1202,
      artist_name: "Lungfish",
      album_title: "Hall of Ideas",
      card: CARD_3,
    });
    const { here } = narrowCardAssignmentRows([lungfish, lukasz, littleSimz], CARD_3, none);
    expect(ids(here)).toEqual([1200, 1201, 1202]);
  });

  it("breaks an artist tie on the collated album title", () => {
    // The later-numbered row holds the alphabetically earlier title, so a
    // tiebreak that fell through to `rotation_id` instead of the title would
    // land these in the opposite order.
    const soundDust = createTestRotationListRow({
      rotation_id: 1100,
      artist_name: "Stereolab",
      album_title: "Sound-Dust",
      card: CARD_3,
    });
    const dotsAndLoops = createTestRotationListRow({
      rotation_id: 1101,
      artist_name: "Stereolab",
      album_title: "Dots and Loops",
      card: CARD_3,
    });
    const { here } = narrowCardAssignmentRows([soundDust, dotsAndLoops], CARD_3, none);
    expect(ids(here)).toEqual([1101, 1100]);
  });

  it("orders elsewhere by card number then artist, a card-less row first", () => {
    const card1Hermanos = createTestRotationListRow({
      rotation_id: 905,
      artist_name: "Hermanos Gutiérrez",
      album_title: "El Bueno y el Malo",
      card: CARD_1,
    });
    const card2Arthur = createTestRotationListRow({
      rotation_id: 906,
      artist_name: "Arthur Russell",
      album_title: "Picture of Bunny Rabbit",
      card: CARD_2,
    });
    const { elsewhere } = narrowCardAssignmentRows(
      [card2Arthur, ON_CARD_1, UNCARDED, card1Hermanos],
      CARD_3,
      none,
    );
    expect(ids(elsewhere)).toEqual([903, 905, 901, 906]);
  });

  it("orders elsewhere by collation, not code point, when card numbers tie", () => {
    // All three share a card number, so the artist tiebreak alone decides --
    // "Łukasz" has no NFD decomposition, so a fold-then-code-unit compare
    // would place it after "Z" instead of between these two.
    const littleSimz = createTestRotationListRow({
      rotation_id: 1210,
      artist_name: "Little Simz",
      album_title: "Sometimes I Might Be Introvert",
      card: CARD_1,
    });
    const lukasz = createTestRotationListRow({
      rotation_id: 1211,
      artist_name: "Łukasz",
      album_title: "Sample Record",
      card: CARD_1,
    });
    const lungfish = createTestRotationListRow({
      rotation_id: 1212,
      artist_name: "Lungfish",
      album_title: "Hall of Ideas",
      card: CARD_1,
    });
    const { elsewhere } = narrowCardAssignmentRows([lungfish, lukasz, littleSimz], CARD_3, none);
    expect(ids(elsewhere)).toEqual([1210, 1211, 1212]);
  });
});

describe("rotationRecordLabel", () => {
  it("names a record as artist and title, with placeholders for a missing side", () => {
    expect(
      rotationRecordLabel(
        createTestRotationListRow({ artist_name: "Juana Molina", album_title: "DOGA" }),
      ),
    ).toBe("Juana Molina — DOGA");
    expect(
      rotationRecordLabel(createTestRotationListRow({ artist_name: null, album_title: null })),
    ).toBe("Unknown artist — Untitled");
  });
});

describe("groupRotationRowsByCardId", () => {
  const HEAVY_1 = { id: 31, bin: RotationBin.H, number: 1, name: null };
  const HEAVY_2 = { id: 32, bin: RotationBin.H, number: 2, name: null };

  it("groups each card's rows by card id, in artist order, and leaves card-less rows out", () => {
    const rows = groupRotationRowsByCardId([
      createTestRotationListRow({ rotation_id: 1, artist_name: "Stereolab", card: HEAVY_1 }),
      createTestRotationListRow({ rotation_id: 2, artist_name: "Autechre", card: HEAVY_1 }),
      createTestRotationListRow({ rotation_id: 3, artist_name: "Juana Molina", card: HEAVY_2 }),
      createTestRotationListRow({ rotation_id: 4, artist_name: "Wednesday", card: null }),
    ]);
    expect([...rows.keys()].sort()).toEqual([31, 32]);
    expect(rows.get(31)?.map((row) => row.rotation_id)).toEqual([2, 1]);
    expect(rows.get(32)?.map((row) => row.rotation_id)).toEqual([3]);
  });
});

describe("rotationCardDeleteConflictReason", () => {
  const wrapped409 = (reason: string) => ({
    rotationWriteError: { status: 409, data: { message: "Cannot delete", reason } },
  });

  it.each(["card_not_highest_in_bin", "card_has_active_rotations"] as const)(
    "reads %s off a wrapped delete 409",
    (reason) => {
      expect(rotationCardDeleteConflictReason(wrapped409(reason))).toBe(reason);
    },
  );

  it("returns null for a reason outside the closed set", () => {
    expect(rotationCardDeleteConflictReason(wrapped409("rotation_card_bin_mismatch"))).toBeNull();
  });

  it.each([
    ["an unwrapped rejection", { status: 409, data: { reason: "card_has_active_rotations" } }],
    ["a wrapped rejection with no body", { rotationWriteError: { status: 500 } }],
    ["a non-object", undefined],
  ])("returns null for %s", (_label, err) => {
    expect(rotationCardDeleteConflictReason(err)).toBeNull();
  });
});

describe("rotationCardDeleteConflictMessage", () => {
  it("names the refusing half of the guard for each reason", () => {
    expect(rotationCardDeleteConflictMessage("card_not_highest_in_bin")).toMatch(
      /last in its bin/,
    );
    expect(rotationCardDeleteConflictMessage("card_has_active_rotations")).toMatch(
      /active rotation releases/,
    );
  });
});

describe("rotationCardName", () => {
  it.each([
    [RotationBin.H, 3, "Heavy 3"],
    [RotationBin.M, 1, "Medium 1"],
    [RotationBin.L, 2, "Light 2"],
    [RotationBin.S, 4, "Singles 4"],
  ])("names a %s card %i %j", (bin, number, expected) => {
    expect(rotationCardName(bin, number)).toBe(expected);
  });
});
