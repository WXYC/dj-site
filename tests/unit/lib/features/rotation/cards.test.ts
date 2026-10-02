import { describe, it, expect } from "vitest";
import {
  canDeleteRotationCard,
  groupRotationCardsByBin,
  rotationCardDeleteConflictMessage,
  rotationCardDeleteConflictReason,
  rotationRowsToMoveOntoCard,
} from "@/lib/features/rotation/cards";
import type { RotationCardWithCount, RotationListRow } from "@/lib/features/rotation/types";
import { RotationBin } from "@/lib/features/rotation/types";

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

  function row(overrides: Partial<RotationListRow> = {}): RotationListRow {
    return {
      id: 1,
      code_letters: null,
      code_artist_number: null,
      code_number: null,
      artist_name: "Stereolab",
      alphabetical_name: "Stereolab",
      album_title: "Instant Holograms on Metal Film",
      record_label: "Duophonic",
      label_id: null,
      genre_name: "Rock",
      format_name: "CD",
      rotation_id: 5001,
      add_date: "2026-09-01",
      rotation_add_date: "2026-09-01",
      rotation_bin: RotationBin.H,
      rotation_kill_date: null,
      plays: null,
      legacy_release_id: null,
      card: null,
      ...overrides,
    };
  }

  it("excludes ticked rows already on the card", () => {
    const onTheCard = row({ rotation_id: 5001, card: HEAVY_CARD_2 });
    const elsewhere = row({ rotation_id: 5002, card: null });

    expect(
      rotationRowsToMoveOntoCard([onTheCard, elsewhere], HEAVY_CARD_2, [5001, 5002]),
    ).toEqual([5002]);
  });

  it("returns ticked rows filed on a different card in the same bin", () => {
    const otherCardInBin = { id: 31, bin: RotationBin.H, number: 1, name: null };
    const onOtherCard = row({ rotation_id: 5002, card: otherCardInBin });

    expect(rotationRowsToMoveOntoCard([onOtherCard], HEAVY_CARD_2, [5002])).toEqual([5002]);
  });

  it("never returns a ticked row from another bin", () => {
    const mediumRow = row({ rotation_id: 6001, rotation_bin: RotationBin.M, card: null });

    expect(rotationRowsToMoveOntoCard([mediumRow], HEAVY_CARD_2, [6001])).toEqual([]);
  });

  it("returns nothing for an empty tick set", () => {
    expect(rotationRowsToMoveOntoCard([row({ rotation_id: 5001 })], HEAVY_CARD_2, [])).toEqual(
      [],
    );
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
