import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getClosestHour, parseTimeStringToDate } from "../closesthour";

describe("closesthour utilities", () => {
  describe("getClosestHour", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should round down when minutes are 30 or less", () => {
      vi.setSystemTime(new Date("2024-06-15T14:30:00"));
      const result = getClosestHour();
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it("should round down when minutes are 15", () => {
      vi.setSystemTime(new Date("2024-06-15T14:15:00"));
      const result = getClosestHour();
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(0);
    });

    it("should round up when minutes are greater than 30", () => {
      vi.setSystemTime(new Date("2024-06-15T14:31:00"));
      const result = getClosestHour();
      expect(result.getHours()).toBe(15);
      expect(result.getMinutes()).toBe(0);
    });

    it("should round up when minutes are 45", () => {
      vi.setSystemTime(new Date("2024-06-15T14:45:00"));
      const result = getClosestHour();
      expect(result.getHours()).toBe(15);
      expect(result.getMinutes()).toBe(0);
    });

    it("should keep the same hour when minutes are 0", () => {
      vi.setSystemTime(new Date("2024-06-15T14:00:00"));
      const result = getClosestHour();
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(0);
    });

    it("should handle hour rollover at 23:31", () => {
      vi.setSystemTime(new Date("2024-06-15T23:31:00"));
      const result = getClosestHour();
      // This will rollover to next day 00:00
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it("should clear seconds and milliseconds", () => {
      vi.setSystemTime(new Date("2024-06-15T14:20:45.123"));
      const result = getClosestHour();
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe("parseTimeStringToDate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should parse 14:30 correctly", () => {
      const result = parseTimeStringToDate("14:30");
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it("should parse 00:00 correctly", () => {
      const result = parseTimeStringToDate("00:00");
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it("should parse 23:59 correctly", () => {
      const result = parseTimeStringToDate("23:59");
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });

    it("should parse single-digit hour", () => {
      const result = parseTimeStringToDate("9:15");
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(15);
    });

    it("should preserve the current date", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00"));
      const result = parseTimeStringToDate("14:30");
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(5); // June is month 5 (0-indexed)
      expect(result.getDate()).toBe(15);
    });
  });
});
