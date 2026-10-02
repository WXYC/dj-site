import { describe, it, expect } from "vitest";
import { fakeRotationAdminEndpoints, type FakeRotationAdminRow } from "@/tests/fakes/rotation";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

function row(overrides: Partial<FakeRotationAdminRow> = {}): FakeRotationAdminRow {
  return {
    id: 1,
    rotation_id: 5001,
    rotation_bin: "H",
    rotation_kill_date: null,
    card: { id: 31, bin: "H", number: 1, name: null },
    ...overrides,
  };
}

describe("fakeRotationAdminEndpoints", () => {
  it("derives a card's active_count from its own active rows, not a fixed default", async () => {
    const card = { id: 31, bin: "H", number: 1, name: null };
    fakeRotationAdminEndpoints(
      [
        row({ rotation_id: 5001, card }),
        row({ rotation_id: 5002, card, rotation_kill_date: "2026-09-01" }),
        row({ rotation_id: 5003, card: { id: 32, bin: "H", number: 2, name: null } }),
      ],
      [card, { id: 32, bin: "H", number: 2, name: null }],
    );

    const cards = (await (
      await fetch(`${TEST_BACKEND_URL}/library/rotation/cards`)
    ).json()) as { id: number; active_count: number }[];

    expect(cards.find((candidate) => candidate.id === 31)?.active_count).toBe(1);
    expect(cards.find((candidate) => candidate.id === 32)?.active_count).toBe(1);
  });

  it("follows a card move: the count leaves the old card and lands on the new one", async () => {
    const card31 = { id: 31, bin: "H", number: 1, name: null };
    const card32 = { id: 32, bin: "H", number: 2, name: null };
    fakeRotationAdminEndpoints([row({ rotation_id: 5001, card: card31 })], [card31, card32]);

    await fetch(`${TEST_BACKEND_URL}/library/rotation/5001`, {
      method: "PATCH",
      body: JSON.stringify({ card_id: 32 }),
    });
    const cards = (await (
      await fetch(`${TEST_BACKEND_URL}/library/rotation/cards`)
    ).json()) as { id: number; active_count: number }[];

    expect(cards.find((candidate) => candidate.id === 31)?.active_count).toBe(0);
    expect(cards.find((candidate) => candidate.id === 32)?.active_count).toBe(1);
  });

  // The server's facets overlap rather than partition: `active` is "no kill
  // date, or one that hasn't arrived" and `killed` is "has a kill date", so a
  // kill scheduled for a later day is in both, and one dated today is only
  // in `killed`.
  const TODAY = "2026-09-15";
  const FACET_ROWS = [
    row({ rotation_id: 5001, rotation_kill_date: null }),
    row({ rotation_id: 5002, rotation_kill_date: "2026-09-01" }),
    row({ rotation_id: 5003, rotation_kill_date: TODAY }),
    row({ rotation_id: 5004, rotation_kill_date: "2026-09-16" }),
  ];

  it.each([
    ["active", [5001, 5004]],
    ["killed", [5002, 5003, 5004]],
    ["all", [5001, 5002, 5003, 5004]],
  ])("filters the list GET by status=%s", async (status, expectedIds) => {
    fakeRotationAdminEndpoints(FACET_ROWS, [], { today: TODAY });

    const rows = (await (
      await fetch(`${TEST_BACKEND_URL}/library/rotation?status=${status}`)
    ).json()) as { rotation_id: number }[];

    expect(rows.map((candidate) => candidate.rotation_id)).toEqual(expectedIds);
  });

  it("counts a future-dated kill in active_count, and a kill dated today out of it", async () => {
    fakeRotationAdminEndpoints(FACET_ROWS, [{ id: 31, bin: "H", number: 1, name: null }], {
      today: TODAY,
    });

    const cards = (await (
      await fetch(`${TEST_BACKEND_URL}/library/rotation/cards`)
    ).json()) as { id: number; active_count: number }[];

    expect(cards).toEqual([expect.objectContaining({ id: 31, active_count: 2 })]);
  });

  it("defaults today to the day the spec runs on", async () => {
    const utcDay = (offsetDays: number) =>
      new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
    fakeRotationAdminEndpoints(
      [
        row({ rotation_id: 5001, rotation_kill_date: utcDay(-2) }),
        row({ rotation_id: 5002, rotation_kill_date: utcDay(2) }),
      ],
      [],
    );

    const rows = (await (
      await fetch(`${TEST_BACKEND_URL}/library/rotation?status=active`)
    ).json()) as { rotation_id: number }[];

    expect(rows.map((candidate) => candidate.rotation_id)).toEqual([5002]);
  });
});
