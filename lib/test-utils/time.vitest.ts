import { vi } from "vitest";
import { TEST_TIMESTAMPS } from "./time";

export * from "./time";

// Mock the current time for tests
export function mockCurrentTime(date: Date = TEST_TIMESTAMPS.NOW): void {
  vi.useFakeTimers();
  vi.setSystemTime(date);
}

// Restore real timers
export function restoreRealTime(): void {
  vi.useRealTimers();
}
