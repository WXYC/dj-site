import { describe, it, expect, vi, afterEach } from "vitest";
import type { StationHourBreakpoint } from "@/src/utilities/stationTime";
import {
  STATION_TIME_ZONE,
  breakpointGuardRejectionMessage,
  closestStationHour,
  formatStationClockTime,
  formatStationDateTime,
  formatStationHourLabel,
  formatLongCalendarDate,
  formatStationLongDate,
  formatStationTimestampLabel,
  isStationHourBreakpointPresent,
  stationBreakpointMessage,
  startOfStationHour,
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

  describe("startOfStationHour", () => {
    it("floors a modern instant to the containing station hour", () => {
      // 2026-09-18T15:01:53Z is 11:01:53 EDT -> floors to 11:00 AM EDT.
      expect(startOfStationHour(Date.parse("2026-09-18T15:01:53Z"))).toBe(
        Date.parse("2026-09-18T15:00:00Z"),
      );
    });

    // The whole reason a shared implementation exists rather than
    // `ms - (ms % MS_PER_HOUR)`: `%` keeps the sign of the dividend, so that
    // form CEILS a pre-1970 instant instead of flooring it. Unreachable by
    // any real flowsheet row -- WXYC signed on in 1977 -- but pinned because
    // it is the fact that decided which implementation survived.
    it("floors a pre-1970 instant correctly instead of ceiling it", () => {
      expect(startOfStationHour(-100)).toBe(Date.parse("1969-12-31T23:00:00Z"));
    });

    it("floors a pre-1970 instant that is not near a UTC hour boundary", () => {
      // 1969-07-20T20:17:40Z is 4:17:40 PM EDT -> floors to 4:00 PM EDT. The
      // epoch form (`ms - (ms % MS_PER_HOUR)`) instead ceils this to 9PM UTC.
      expect(startOfStationHour(Date.parse("1969-07-20T20:17:40Z"))).toBe(
        Date.parse("1969-07-20T20:00:00Z"),
      );
    });
  });

  describe("closestStationHour and startOfStationHour stay internally consistent", () => {
    // closestStationHour derives its minutes-into-hour from
    // startOfStationHour's own floor rather than recomputing it a second,
    // independent way, so the two can never disagree about which hour is
    // "current" for a given instant -- pinned here by checking the rounded
    // result is always either the floor itself or exactly one hour later.
    it.each([
      "2026-07-17T03:15:00Z",
      "2026-07-17T03:30:00Z", // exactly :30 -> rounds down
      "2026-07-17T03:31:00Z", // strictly past :30 -> rounds up
      "2026-03-08T06:59:00Z", // just before spring-forward
      "2026-03-08T07:01:00Z", // just after spring-forward
      "2026-11-01T05:30:00Z", // first 1 AM EDT repeat, fall-back
      "2026-11-01T06:30:00Z", // second 1 AM EST repeat
    ])("rounds %s to its own floor or the next one", (iso) => {
      const ms = Date.parse(iso);
      const floor = startOfStationHour(ms);
      const rounded = closestStationHour(new Date(ms)).getTime();
      expect([floor, floor + 3_600_000]).toContain(rounded);
    });

    it("rounds down at exactly :30 and up strictly past it", () => {
      const exactlyThirty = closestStationHour(new Date("2026-07-17T03:30:00Z"));
      const pastThirty = closestStationHour(new Date("2026-07-17T03:31:00Z"));
      expect(exactlyThirty.getTime()).toBe(startOfStationHour(Date.parse("2026-07-17T03:30:00Z")));
      expect(pastThirty.getTime()).toBe(
        startOfStationHour(Date.parse("2026-07-17T03:31:00Z")) + 3_600_000,
      );
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
    const eveningEastern = new Date("2026-07-17T03:30:00Z"); // 23:30 EDT, station hour "11:00 PM"

    // A row that never got a radio_hour: an archive row logged before the
    // server stamped one, or the client-only optimistic row inserted before
    // the server has responded.
    const byMessageOnly = (message: string): StationHourBreakpoint => ({
      message,
    });

    it("blocks a duplicate of the current station hour by message when radio_hour is absent", () => {
      expect(
        isStationHourBreakpointPresent(
          [byMessageOnly("11:00 PM Breakpoint")],
          eveningEastern
        )
      ).toBe(true);
    });

    it("allows a different station hour", () => {
      expect(
        isStationHourBreakpointPresent(
          [byMessageOnly("10:00 PM Breakpoint")],
          eveningEastern
        )
      ).toBe(false);
    });

    it("allows the next station hour even though the client clock has only advanced normally", () => {
      const nextHour = new Date("2026-07-17T04:30:00Z"); // 00:30 EDT next day
      const existing = [byMessageOnly("11:00 PM Breakpoint")];
      // The 11 PM hour is already marked...
      expect(isStationHourBreakpointPresent(existing, eveningEastern)).toBe(true);
      // ...but the next station hour keys differently and is not blocked.
      expect(stationBreakpointMessage(nextHour)).toBe("12:00 AM Breakpoint");
      expect(isStationHourBreakpointPresent(existing, nextHour)).toBe(false);
    });

    it("treats an empty flowsheet as unmarked", () => {
      expect(isStationHourBreakpointPresent([], eveningEastern)).toBe(false);
    });

    it("keys on radio_hour rather than the message when radio_hour disagrees with it", () => {
      // The classic clock-skew scenario: the row's own text names 7 PM, but
      // the server-stamped radio_hour is the true instant, 11 PM.
      const row: StationHourBreakpoint = {
        message: "7:00 PM Breakpoint",
        radio_hour: eveningEastern.toISOString(),
      };
      expect(isStationHourBreakpointPresent([row], eveningEastern)).toBe(true);
    });

    it("does not fall back to a matching message when radio_hour names a different hour", () => {
      const row: StationHourBreakpoint = {
        message: "11:00 PM Breakpoint", // would match on label alone...
        radio_hour: "2026-07-17T02:30:00Z", // ...but radio_hour says 10 PM
      };
      expect(isStationHourBreakpointPresent([row], eveningEastern)).toBe(false);
    });

    it.each([
      ["null (a legacy row)", null],
      ["undefined (the optimistic pre-submit row)", undefined],
      // Not a value the server can emit, but a row whose instant is
      // unreadable must degrade to the label rather than stop suppressing
      // duplicates entirely -- the same reason the instant is floored.
      ["an unparseable string", "not-a-timestamp"],
    ])(
      "falls back to the message when radio_hour is %s",
      (_label, radio_hour) => {
        const row: StationHourBreakpoint = {
          message: "11:00 PM Breakpoint",
          radio_hour,
        };
        expect(isStationHourBreakpointPresent([row], eveningEastern)).toBe(true);
      }
    );

    it("does not block on an unparseable radio_hour whose message names another hour", () => {
      const row: StationHourBreakpoint = {
        message: "10:00 PM Breakpoint",
        radio_hour: "not-a-timestamp",
      };
      expect(isStationHourBreakpointPresent([row], eveningEastern)).toBe(false);
    });

    it("allows two breakpoints an absolute hour apart across the fall-back repeat of 1 AM", () => {
      // Both repeats of the 1 AM wall-clock hour share a label but are a real
      // hour apart -- radio_hour, an instant, tells them apart where the old
      // message-keyed guard could not.
      const firstOneAM = new Date("2026-11-01T05:00:00Z"); // 1:00 AM EDT
      const secondOneAM = new Date("2026-11-01T06:00:00Z"); // 1:00 AM EST (the repeat)
      expect(formatStationHourLabel(firstOneAM)).toBe("1:00 AM");
      expect(formatStationHourLabel(secondOneAM)).toBe("1:00 AM");

      const firstBreakpoint: StationHourBreakpoint = {
        message: stationBreakpointMessage(firstOneAM),
        radio_hour: firstOneAM.toISOString(),
      };
      expect(
        isStationHourBreakpointPresent([firstBreakpoint], firstOneAM)
      ).toBe(true);
      // The second 1 AM is a distinct instant, not a duplicate of the first.
      expect(
        isStationHourBreakpointPresent([firstBreakpoint], secondOneAM)
      ).toBe(false);
    });

    // Accepted residual, recorded rather than fixed. Both the guard's target
    // and the persisted message come from the browser clock; only radio_hour
    // comes from the server's. A browser skewed far enough to straddle :30
    // therefore aims at an hour the server never stamped, and the row the
    // server did stamp keys to the next one. The guard is optimistic by
    // construction -- making it authoritative would mean trusting the label
    // over the instant again, which is what re-keying set out to stop, and
    // would reinstate the DST collapse above. The server's watermark is the
    // invariant that actually closes this.
    it("misses a row the server stamped an hour ahead when the browser clock straddles :30", () => {
      // Browser reads 7:28 PM; the request lands at server 7:31 PM, which
      // rounds up. The row says "7:00 PM Breakpoint" next to an 8 PM instant.
      const browserAtSecondClick = new Date("2026-07-16T23:29:00Z"); // 7:29 PM EDT
      const serverStamped: StationHourBreakpoint = {
        message: "7:00 PM Breakpoint",
        radio_hour: "2026-07-17T00:00:00.000Z", // 8:00 PM EDT
      };

      expect(
        isStationHourBreakpointPresent([serverStamped], browserAtSecondClick)
      ).toBe(false);

      // The row is not invisible, only misaligned by the skew: it blocks the
      // hour it actually claims.
      expect(
        isStationHourBreakpointPresent(
          [serverStamped],
          new Date("2026-07-17T00:29:00Z") // 8:29 PM EDT
        )
      ).toBe(true);
    });

    it("floors a radio_hour to its containing station hour defensively, without rounding", () => {
      // The server always stamps an exact top-of-hour, so this row is not one
      // it would actually produce -- the point is that a hypothetical few
      // seconds of drift still matches the hour it falls inside, rather than
      // silently never matching.
      const row: StationHourBreakpoint = {
        message: "irrelevant once radio_hour is present",
        radio_hour: "2026-07-17T03:00:07Z", // 11 PM EDT, 7s past the hour
      };
      expect(isStationHourBreakpointPresent([row], eveningEastern)).toBe(true);
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

describe("breakpointGuardRejectionMessage", () => {
  it("names the hour rather than just the rule", () => {
    expect(breakpointGuardRejectionMessage("7:00 PM")).toBe(
      "7:00 PM already has a breakpoint"
    );
  });

  it("takes the label as given, doing no rounding or re-resolution of its own", () => {
    // Taking a resolved label rather than a Date is what lets a caller pass
    // the one clock read its guard check also used; a second read here could
    // round to a different hour than the check looked at.
    expect(breakpointGuardRejectionMessage("12:00 AM")).toBe(
      "12:00 AM already has a breakpoint"
    );
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

describe("formatLongCalendarDate — the same form for a date-only column", () => {
  it.each([
    { iso: "2026-09-12", expected: "Saturday, September 12, 2026" },
    { iso: "2026-01-01", expected: "Thursday, January 1, 2026" },
    // Both sides of a DST transition: the offset moves, the calendar day
    // named by the column does not.
    { iso: "2026-03-08", expected: "Sunday, March 8, 2026" },
    { iso: "2026-11-01", expected: "Sunday, November 1, 2026" },
  ])("names the calendar day $iso stands for", ({ iso, expected }) => {
    expect(formatLongCalendarDate(iso)).toBe(expected);
  });

  // A `date` column that is NULL is a day that does not exist, and the JSPs
  // render a blank rather than a placeholder for one.
  it.each([null, undefined, ""])("renders %s as an empty string", (absent) => {
    expect(formatLongCalendarDate(absent)).toBe("");
  });
});

describe("formatStationTimestampLabel", () => {
  it("renders an abbreviated station-local date and time with the zone label", () => {
    expect(formatStationTimestampLabel("2024-06-15T19:04:05.000Z")).toBe(
      "Jun 15, 2024, 3:04 PM EDT",
    );
  });

  // The zone label is not decoration: without it a roster timestamp is
  // indistinguishable from the reader's own clock, and the station's is the
  // one an admin reconciles against station logs.
  it("names the standard-time abbreviation outside daylight saving", () => {
    expect(formatStationTimestampLabel("2024-01-15T19:04:05.000Z")).toBe(
      "Jan 15, 2024, 2:04 PM EST",
    );
  });

  it("uses the station's calendar day, not UTC's", () => {
    expect(formatStationTimestampLabel("2024-06-16T00:30:00.000Z")).toBe(
      "Jun 15, 2024, 8:30 PM EDT",
    );
  });

  it("returns null for a missing timestamp", () => {
    expect(formatStationTimestampLabel(null)).toBeNull();
    expect(formatStationTimestampLabel(undefined)).toBeNull();
  });

  // better-auth can hand back an unparseable value; a roster panel must not
  // render "Invalid Date" where an admin expects a date.
  it("returns null for an unparseable timestamp", () => {
    expect(formatStationTimestampLabel("not a date")).toBeNull();
  });
});

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
