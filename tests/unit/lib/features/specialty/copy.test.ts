import { describe, it, expect } from "vitest";
import { describeSlot } from "@/lib/features/specialty/copy";

describe("describeSlot", () => {
  it.each([
    [6, "12:00", "Sunday at noon"],
    [6, "16:00", "Sunday at 4:00 PM"],
    [3, "21:00", "Thursday at 9:00 PM"],
    [4, "22:30", "Friday at 10:30 PM"],
    [0, "09:05", "Monday at 9:05 AM"],
    [1, "00:00", "Tuesday at midnight"],
  ])("day %i at %s reads %s", (day, start_time, expected) => {
    expect(
      describeSlot({ day, start_time, duration_minutes: 120, cadence: "weekly" })
    ).toBe(expected);
  });
});
