import { vi } from "vitest";
import {
  TEST_TIMESTAMPS,
  TIME_OFFSETS,
  formatDate,
  offsetFromNow,
} from "@wxyc/shared";

// Re-export shared time utilities
export { TEST_TIMESTAMPS, TIME_OFFSETS, formatDate, offsetFromNow };

// Backwards compatibility alias
export function toDateString(date: Date): string {
  return formatDate(date, "yyyy-MM-dd");
}

// Vitest-specific timer mocking
export function mockCurrentTime(date: Date = TEST_TIMESTAMPS.NOW): void {
  vi.useFakeTimers();
  vi.setSystemTime(date);
}

export function restoreRealTime(): void {
  vi.useRealTimers();
}
