import { vi } from "vitest";

// Fixed timestamps for consistent testing
export const TEST_TIMESTAMPS = {
  // A fixed "now" for tests: 2024-06-15 14:30:00 UTC
  NOW: new Date("2024-06-15T14:30:00.000Z"),
  // One hour ago
  ONE_HOUR_AGO: new Date("2024-06-15T13:30:00.000Z"),
  // One day ago
  ONE_DAY_AGO: new Date("2024-06-14T14:30:00.000Z"),
  // One week ago
  ONE_WEEK_AGO: new Date("2024-06-08T14:30:00.000Z"),
} as const;

// Format a date as ISO string for API responses
export function toISOString(date: Date): string {
  return date.toISOString();
}

// Format a date as YYYY-MM-DD for display
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Mock the current time for tests
export function mockCurrentTime(date: Date = TEST_TIMESTAMPS.NOW): void {
  vi.useFakeTimers();
  vi.setSystemTime(date);
}

// Restore real timers
export function restoreRealTime(): void {
  vi.useRealTimers();
}

// Create a date offset from TEST_TIMESTAMPS.NOW
export function offsetFromNow(offsetMs: number): Date {
  return new Date(TEST_TIMESTAMPS.NOW.getTime() + offsetMs);
}

// Time offset constants
export const TIME_OFFSETS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;
