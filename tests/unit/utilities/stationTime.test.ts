import { describe, it, expect, vi, afterEach } from "vitest";
import {
  STATION_TIME_ZONE,
  closestStationHour,
  formatStationClockTime,
  formatStationDateTime,
  formatStationHourLabel,
  formatStationLongDate,
  isStationHourBreakpointPresent,
  stationBreakpointMessage,
  startOfStationWeek,
  addStationWeeks,
  stationWeekWindow,
  stationDaysOfWeek,
  formatStationWeekParam,
  parseStationWeekParam,
} from "@/src/utilities/stationTime";

// The utility derives everything from an explicit IANA zone, so its output is
// independent of the process/client zone. The instants below are chosen so the
// station (Eastern) hour differs from what a Central or UTC client would read,
// and the assertions are always the Eastern value.
describe("stationTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the station's IANA zone", () => {
    expect(STATION_TIME_ZONE).toBe("America/New_York");
  });

  describe("closest hour rounding", () => {
    it("rounds down when the station clock is at or before :30", () => {
      // 03:30Z in summer is 23:30 EDT.
      expect(formatStationHourLabel(new Date("2026-07-17T03:30:00Z"))).toBe(
        "11:00 PM"
      );
    });

    it("rounds up once strictly past :30", () => {
      // 03:31Z in summer is 23:31 EDT -> next station hour, crossing midnight.
      expect(formatStationHourLabel(new Date("2026-07-17T03:31:00Z"))).toBe(
        "12:00 AM"
      );
    });

    it("returns a top-of-hour instant", () => {
      const rounded = closestStationHour(new Date("2026-07-17T03:15:00Z"));
      expect(rounded.getTime() % 3_600_000).toBe(0);
    });
  });

  describe("station hour is independent of the client zone", () => {
    it("labels the Eastern hour when a Central client would read an hour earlier", () => {
      // 03:30Z: 23:30 Eastern, but 22:30 Central. The label is the Eastern hour.
      const now = new Date("2026-07-17T03:30:00Z");
      expect(formatStationHourLabel(now)).toBe("11:00 PM");
      expect(stationBreakpointMessage(now)).toBe("11:00 PM Breakpoint");
    });
  });

  describe("daylight saving is carried by the zone, not hardcoded", () => {
    it("maps the same Eastern wall-clock hour from EST and EDT instants", () => {
      // Winter: 04:00Z is 23:00 EST (offset -5).
      const winter = new Date("2026-01-16T04:00:00Z");
      // Summer: 03:00Z is 23:00 EDT (offset -4).
      const summer = new Date("2026-07-16T03:00:00Z");
      expect(formatStationHourLabel(winter)).toBe("11:00 PM");
      expect(formatStationHourLabel(summer)).toBe("11:00 PM");
    });
  });

  describe("one-breakpoint-per-station-hour guard", () => {
    const eveningEastern = new Date("2026-07-17T03:30:00Z"); // 23:30 EDT

    it("blocks a duplicate of the current station hour", () => {
      expect(
        isStationHourBreakpointPresent(["11:00 PM Breakpoint"], eveningEastern)
      ).toBe(true);
    });

    it("allows a different station hour", () => {
      expect(
        isStationHourBreakpointPresent(["10:00 PM Breakpoint"], eveningEastern)
      ).toBe(false);
    });

    it("allows the next station hour even though the client clock has only advanced normally", () => {
      const nextHour = new Date("2026-07-17T04:30:00Z"); // 00:30 EDT next day
      const existing = ["11:00 PM Breakpoint"];
      // The 11 PM hour is already marked...
      expect(isStationHourBreakpointPresent(existing, eveningEastern)).toBe(true);
      // ...but the next station hour keys differently and is not blocked.
      expect(stationBreakpointMessage(nextHour)).toBe("12:00 AM Breakpoint");
      expect(isStationHourBreakpointPresent(existing, nextHour)).toBe(false);
    });

    it("treats an empty flowsheet as unmarked", () => {
      expect(isStationHourBreakpointPresent([], eveningEastern)).toBe(false);
    });
  });

  describe("station-time display formatting", () => {
    it("renders a backend timestamp in station wall-clock shapes", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T03:15:30Z"));
      const { day, time, isToday } = formatStationDateTime(
        "2026-07-17T03:15:30Z"
      );
      // 03:15:30Z is 23:15:30 EDT on 7/16.
      expect(day).toBe("7/16/2026");
      expect(time).toBe("11:15:30 PM");
      expect(isToday).toBe(true);
    });

    it("marks a different station day as not today", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-18T12:00:00Z"));
      const { isToday } = formatStationDateTime("2026-07-16T03:15:30Z");
      expect(isToday).toBe(false);
    });

    it("renders an instant as the station's wall clock, without seconds", () => {
      // 03:15:30Z is 23:15:30 EDT the previous day.
      expect(formatStationClockTime("2026-07-17T03:15:30Z")).toBe("11:15 PM");
    });

    it.each([
      ["a missing timestamp", undefined],
      ["a null timestamp", null],
      ["an unparseable timestamp", "not a date"],
    ])("renders %s as an empty label rather than Invalid Date", (_label, value) => {
      expect(formatStationClockTime(value as string | null | undefined)).toBe("");
    });
  });
});

describe("formatStationLongDate — DateTimeManager.DATE_FULL", () => {
  it("renders the station-local weekday, month, day, and year", () => {
    expect(formatStationLongDate("2024-06-15T19:04:05.000Z")).toBe(
      "Saturday, June 15, 2024",
    );
  });

  // 00:30 UTC on the 16th is 20:30 EDT on the 15th — the station's date, not
  // the browser's or UTC's.
  it("uses the station's calendar day, not UTC's", () => {
    expect(formatStationLongDate("2024-06-16T00:30:00.000Z")).toBe(
      "Saturday, June 15, 2024",
    );
  });
})

// Week boundaries exist as functions rather than arithmetic because a week is
// not always 7 * 86_400_000 ms. Adding that constant across a DST transition
// lands at 23:00 or 01:00, not Sunday midnight, and the resulting window is
// then measured against an endpoint that rejects anything over 8 days.
describe("station week boundaries", () => {
  const iso = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: STATION_TIME_ZONE,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);

  const DAY = 86_400_000;

  describe("startOfStationWeek", () => {
    it.each([
      ["Sunday itself", "2026-08-23T12:00:00Z"],
      ["Monday", "2026-08-24T12:00:00Z"],
      ["Wednesday", "2026-08-26T12:00:00Z"],
      ["Saturday", "2026-08-29T12:00:00Z"],
    ])("resolves %s to the same Sunday midnight ET", (_label, instant) => {
      expect(iso(startOfStationWeek(new Date(instant)))).toBe(
        "Sun, 08/23/2026, 00:00",
      );
    });

    it("uses the station's Sunday, not the caller's", () => {
      // 03:00Z Sunday is still 23:00 Saturday ET, so the station week is the
      // earlier one. A UTC-based implementation returns the later Sunday.
      expect(iso(startOfStationWeek(new Date("2026-08-23T03:00:00Z")))).toBe(
        "Sun, 08/16/2026, 00:00",
      );
    });
  });

  describe("addStationWeeks", () => {
    it.each([-2, -1, 1, 2, 5])("lands on Sunday midnight ET for n=%i", (n) => {
      const result = addStationWeeks(
        startOfStationWeek(new Date("2026-08-26T12:00:00Z")),
        n,
      );
      expect(iso(result)).toMatch(/^Sun, .*, 00:00$/);
    });

    it("stays on midnight across the spring-forward transition", () => {
      // 2026-03-08 is the spring transition; that week is 7d - 1h.
      const week = startOfStationWeek(new Date("2026-03-04T12:00:00Z"));
      expect(iso(addStationWeeks(week, 1))).toBe("Sun, 03/08/2026, 00:00");
    });

    it("stays on midnight across the fall-back transition", () => {
      const week = startOfStationWeek(new Date("2026-10-28T12:00:00Z"));
      expect(iso(addStationWeeks(week, 1))).toBe("Sun, 11/01/2026, 00:00");
    });
  });

  describe("stationWeekWindow", () => {
    it("is exactly seven days on an ordinary week", () => {
      const { startMs, endMs } = stationWeekWindow(
        startOfStationWeek(new Date("2026-08-26T12:00:00Z")),
      );
      expect(endMs - startMs).toBe(7 * DAY);
    });

    it.each([
      ["spring forward", "2026-03-08T12:00:00Z", 7 * DAY - 3_600_000],
      ["fall back", "2026-11-01T12:00:00Z", 7 * DAY + 3_600_000],
    ])("is %s-adjusted", (_label, instant, expected) => {
      const { startMs, endMs } = stationWeekWindow(
        startOfStationWeek(new Date(instant)),
      );
      expect(endMs - startMs).toBe(expected);
    });

    it.each([
      ["spring forward", "2026-03-08T12:00:00Z"],
      ["fall back", "2026-11-01T12:00:00Z"],
      ["ordinary", "2026-08-26T12:00:00Z"],
    ])("stays inside the endpoint's 8-day cap on a %s week", (_l, instant) => {
      const { startMs, endMs } = stationWeekWindow(
        startOfStationWeek(new Date(instant)),
      );
      expect(endMs - startMs).toBeLessThan(8 * DAY);
      expect(endMs).toBeGreaterThan(startMs);
    });
  });

  describe("stationDaysOfWeek", () => {
    it("returns seven ET midnights", () => {
      const days = stationDaysOfWeek(
        startOfStationWeek(new Date("2026-08-26T12:00:00Z")),
      );
      expect(days).toHaveLength(7);
      expect(days.map((d) => iso(d).slice(0, 3))).toEqual([
        "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
      ]);
      expect(days.every((d) => iso(d).endsWith("00:00"))).toBe(true);
    });

    it.each([
      ["spring forward", "2026-03-08T12:00:00Z", 23],
      ["fall back", "2026-11-01T12:00:00Z", 25],
    ])(
      "gives the %s Sunday a %i-hour day",
      (_label, instant, expectedHours) => {
        const week = startOfStationWeek(new Date(instant));
        const days = stationDaysOfWeek(week);
        const { endMs } = stationWeekWindow(week);
        const bounds = [...days.map((d) => d.getTime()), endMs];
        const lengths = bounds
          .slice(1)
          .map((b, i) => (b - bounds[i]) / 3_600_000);
        expect(lengths[0]).toBe(expectedHours);
        expect(lengths.filter((h) => h === 24)).toHaveLength(6);
      },
    );
  });

  describe("week URL parameter", () => {
    it("round-trips through the YYYY-MM-DD form", () => {
      const week = startOfStationWeek(new Date("2026-08-26T12:00:00Z"));
      const param = formatStationWeekParam(week);
      expect(param).toBe("2026-08-23");
      expect(parseStationWeekParam(param)?.getTime()).toBe(week.getTime());
    });

    it("names the station's date, not the caller's", () => {
      // 03:00Z Sunday is 23:00 Saturday ET; the week label is the prior Sunday.
      expect(
        formatStationWeekParam(
          startOfStationWeek(new Date("2026-08-23T03:00:00Z")),
        ),
      ).toBe("2026-08-16");
    });

    it.each(["", "nonsense", "2026-13-01", "08/23/2026", "2026-08-23T00:00Z"])(
      "rejects %s rather than resolving to an arbitrary week",
      (bad) => {
        expect(parseStationWeekParam(bad)).toBeNull();
      },
    );

    it("normalizes a mid-week date to that week's Sunday", () => {
      expect(
        formatStationWeekParam(parseStationWeekParam("2026-08-26")!),
      ).toBe("2026-08-23");
    });
  });
});
