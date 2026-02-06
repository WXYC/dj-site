import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getClosestHour, parseTimeStringToDate } from "./closesthour";

describe("getClosestHour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should round down when minutes are 30 or less", () => {
    vi.setSystemTime(new Date("2024-06-15T14:25:00"));
    const result = getClosestHour();
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(0);
  });

  it("should round up when minutes are more than 30", () => {
    vi.setSystemTime(new Date("2024-06-15T14:35:00"));
    const result = getClosestHour();
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(0);
  });

  it("should stay at current hour when exactly at 30 minutes", () => {
    vi.setSystemTime(new Date("2024-06-15T14:30:00"));
    const result = getClosestHour();
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(0);
  });

  it("should set seconds and milliseconds to 0", () => {
    vi.setSystemTime(new Date("2024-06-15T14:25:45.123"));
    const result = getClosestHour();
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("should handle midnight rollover", () => {
    vi.setSystemTime(new Date("2024-06-15T23:45:00"));
    const result = getClosestHour();
    expect(result.getHours()).toBe(0);
    expect(result.getDate()).toBe(16);
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

  it("should parse time string correctly", () => {
    const result = parseTimeStringToDate("14:30");
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it("should set seconds and milliseconds to 0", () => {
    const result = parseTimeStringToDate("10:15");
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("should parse midnight correctly", () => {
    const result = parseTimeStringToDate("00:00");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("should parse end of day correctly", () => {
    const result = parseTimeStringToDate("23:59");
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
  });
});
