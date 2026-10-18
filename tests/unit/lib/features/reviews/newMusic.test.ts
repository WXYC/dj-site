import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { intakeItem } from "@/tests/fakes/reviews";
import { filedByRecency, NEW_MUSIC_STAGES, oldestLoggedFirst } from "@/lib/features/reviews/newMusic";

describe("NEW_MUSIC_STAGES", () => {
  it("lists the stages in the order a record moves through them", () => {
    expect(NEW_MUSIC_STAGES).toEqual(["review_shelf", "requested", "being_reviewed", "waiting", "reviewed", "filed"]);
  });
});

describe("oldestLoggedFirst", () => {
  it("sorts a copy by when the record was added, then by id, and leaves the input alone", () => {
    const rows = [
      intakeItem({ id: 3, logged_at: "2026-09-03T12:00:00Z" }),
      intakeItem({ id: 2, logged_at: "2026-09-01T12:00:00Z" }),
      intakeItem({ id: 1, logged_at: "2026-09-03T12:00:00Z" }),
    ];

    expect(oldestLoggedFirst(rows).map((i) => i.id)).toEqual([2, 1, 3]);
    expect(rows.map((i) => i.id)).toEqual([3, 2, 1]);
  });
});

describe("filedByRecency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const filedAt = (id: number, filed_at: string | null) => intakeItem({ id, effective_state: "filed", filed_at });

  it.each([
    ["29 days ago", "2026-09-18T12:00:00Z", "recent"],
    ["exactly 30 days ago", "2026-09-17T12:00:00Z", "recent"],
    ["31 days ago", "2026-09-16T12:00:00Z", "older"],
    ["no filing time", null, "older"],
  ])("puts a record filed %s with the %s ones", (_when, at, where) => {
    const { recent, older } = filedByRecency([filedAt(1, at)], Date.now());

    expect((where === "recent" ? recent : older).map((i) => i.id)).toEqual([1]);
    expect((where === "recent" ? older : recent)).toEqual([]);
  });

  it("sorts each part newest first, a record with no filing time last", () => {
    const { recent, older } = filedByRecency(
      [
        filedAt(1, "2026-10-01T12:00:00Z"),
        filedAt(2, null),
        filedAt(3, "2026-10-10T12:00:00Z"),
        filedAt(4, "2026-07-01T12:00:00Z"),
        filedAt(5, "2026-08-01T12:00:00Z"),
      ],
      Date.now(),
    );

    expect(recent.map((i) => i.id)).toEqual([3, 1]);
    expect(older.map((i) => i.id)).toEqual([5, 4, 2]);
  });
});
