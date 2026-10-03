import { describe, it, expect } from "vitest";
import { daysInBin, daysPastWindow, isPastWindow, ROTATION_WINDOW_DAYS } from "@/lib/features/rotation/age";
import { RotationBin } from "@/lib/features/rotation/types";
import { createTestRotationListRow } from "@/tests/fixtures/fixtures";
import { stubProcessTimeZone } from "@/tests/helpers/time.vitest";

// Every row carries an `add_date` different from its `rotation_add_date` --
// the shared factory's default would let a `daysInBin` reading the wrong
// column pass against a row that happens to share the two.
const OTHER_ADD_DATE = "2020-01-01 00:00:00+00";

describe("ROTATION_WINDOW_DAYS", () => {
  it("is 60 days for every bin", () => {
    expect(ROTATION_WINDOW_DAYS).toEqual({
      [RotationBin.H]: 60,
      [RotationBin.M]: 60,
      [RotationBin.L]: 60,
      [RotationBin.S]: 60,
    });
  });
});

describe("daysInBin / daysPastWindow / isPastWindow", () => {
  it.each([
    [
      "added today",
      "2026-09-10",
      new Date("2026-09-10T12:00:00Z"),
      0,
    ],
    [
      "exactly at the window",
      "2026-07-12",
      new Date("2026-09-10T12:00:00Z"),
      60,
    ],
    [
      "one day past the window",
      "2026-07-11",
      new Date("2026-09-10T12:00:00Z"),
      61,
    ],
    [
      "future-dated add",
      "2026-09-11",
      new Date("2026-09-10T12:00:00Z"),
      -1,
    ],
    [
      "Eastern-evening instant where the UTC day has already rolled over",
      "2026-09-11",
      new Date("2026-09-10T23:30:00-04:00"),
      0,
    ],
  ])("%s", (_name, rotationAddDate, now, expectedDays) => {
    const row = createTestRotationListRow({
      add_date: OTHER_ADD_DATE,
      rotation_add_date: rotationAddDate,
    });

    expect(daysInBin(row, now)).toBe(expectedDays);
    expect(daysPastWindow(row, 60, now)).toBe(expectedDays - 60);
    expect(isPastWindow(row, 60, now)).toBe(expectedDays - 60 > 0);
  });

  it("holds the implementation to Date.UTC across a moved zone's spring transition", () => {
    stubProcessTimeZone("America/New_York");
    const row = createTestRotationListRow({
      add_date: OTHER_ADD_DATE,
      rotation_add_date: "2026-03-01",
    });

    expect(daysInBin(row, new Date("2026-03-10T12:00:00Z"))).toBe(9);

    // 23:00 EDT on 03-09 is already 2026-03-10 in UTC; a "today" built from
    // the viewer's local day would read 2026-03-09 here and the row would
    // come back -1 instead of 0.
    const sameDayRow = createTestRotationListRow({
      add_date: OTHER_ADD_DATE,
      rotation_add_date: "2026-03-10",
    });

    expect(daysInBin(sameDayRow, new Date("2026-03-10T03:00:00Z"))).toBe(0);
  });
});
