import { describe, it, expect, vi, afterEach } from "vitest";
import {
  STATION_TIME_ZONE,
  closestStationHour,
  formatStationDateTime,
  formatStationHourLabel,
  isStationHourBreakpointPresent,
  stationBreakpointMessage,
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
  });
});
