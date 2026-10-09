import { describe, it, expect } from "vitest";
import type { IntakeItem, IntakeSlip } from "@wxyc/shared";
import { fakeIntakeEndpoints, type FakeIntakeOptions } from "@/tests/fakes/reviews/intake";
import { intakeItem } from "@/tests/fakes/reviews";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

const inState = (id: number, state: IntakeItem["effective_state"], overrides: Partial<IntakeItem> = {}) =>
  intakeItem({ id, state, effective_state: state, ...overrides });

const readIds = async (search: string) => {
  const rows = (await (await fetch(`${TEST_BACKEND_URL}/intake${search}`)).json()) as IntakeItem[];
  return rows.map((row) => row.id);
};

describe("fakeIntakeEndpoints GET /intake", () => {
  // Rows are passed under whichever option, but a row's lane is its own
  // effective_state, so `open` here holds a filed row on purpose.
  const EVERY_STATE: FakeIntakeOptions = {
    open: [inState(1, "pool"), inState(3, "filed", { logged_at: "2026-09-03T12:00:00Z" })],
    reviewed: [inState(2, "reviewed", { logged_at: "2026-09-02T12:00:00Z" })],
    filed: [inState(4, "filed", { logged_at: "2026-09-04T12:00:00Z" })],
    awaiting: [inState(9, "reviewed")],
  };

  it.each<[string, FakeIntakeOptions, string, number[]]>([
    ["no filter reads the union of every state, newest first, without the awaiting rows", EVERY_STATE, "", [4, 3, 2, 1]],
    ["state=pool keeps only the pool rows", EVERY_STATE, "?state=pool", [1]],
    ["state=reviewed keeps only the reviewed rows", EVERY_STATE, "?state=reviewed", [2]],
    ["state=filed keeps the filed rows whichever option held them", EVERY_STATE, "?state=filed", [4, 3]],
    ["awaiting_acceptance=true reads only the awaiting rows", EVERY_STATE, "?awaiting_acceptance=true", [9]],
    [
      "an item passed under two options appears once",
      { open: [inState(5, "reviewed")], reviewed: [inState(5, "reviewed")], filed: [inState(5, "reviewed")] },
      "",
      [5],
    ],
    [
      "an item passed under two options appears once under a state filter",
      { open: [inState(5, "reviewed")], reviewed: [inState(5, "reviewed"), inState(6, "reviewed")] },
      "?state=reviewed",
      [6, 5],
    ],
    [
      "distinct logged_at values come back newest first, whatever the ids",
      {
        open: [
          inState(1, "pool", { logged_at: "2026-09-03T12:00:00Z" }),
          inState(2, "pool", { logged_at: "2026-09-01T12:00:00Z" }),
          inState(3, "pool", { logged_at: "2026-09-02T12:00:00Z" }),
        ],
      },
      "",
      [1, 3, 2],
    ],
    [
      "equal logged_at values break the tie by id, highest first",
      { open: [inState(1, "pool"), inState(3, "pool"), inState(2, "pool")] },
      "",
      [3, 2, 1],
    ],
  ])("%s", async (_name, options, search, expectedIds) => {
    fakeIntakeEndpoints(options);

    expect(await readIds(search)).toEqual(expectedIds);
  });
});

describe("fakeIntakeEndpoints POST /intake/:id/print", () => {
  const slip = {
    artist_name: "Stereolab",
    album_title: "Aluminum Tunes",
    record_label: null,
    buzzwords: null,
    artist_blurb: null,
    review: "Warm.",
    author: "DJ Me",
    submitted_at: "2026-10-07T16:00:00Z",
    recommended_tracks: null,
    fcc: null,
    revision_id: 3,
    fcc_notes: [],
  } as IntakeSlip;

  it("answers the item's slip", async () => {
    fakeIntakeEndpoints({ slips: { 7: slip } });

    const response = await fetch(`${TEST_BACKEND_URL}/intake/7/print`, { method: "POST" });

    expect(await response.json()).toEqual(slip);
  });

  it("answers 409 not_reviewed for an item with no slip", async () => {
    fakeIntakeEndpoints({ slips: { 7: slip } });

    const response = await fetch(`${TEST_BACKEND_URL}/intake/8/print`, { method: "POST" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ reason: "not_reviewed" });
  });
});
