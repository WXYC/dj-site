import { describe, it, expect } from "vitest";
import { describeSlot, oneTapName, withStartAs } from "@/lib/features/specialty/copy";

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

describe("oneTapName", () => {
  const named = (name: string, short_name: string) =>
    ({ name, short_name }) as Parameters<typeof oneTapName>[0];

  it.each([
    ["New Science Experience", "NSE", "New Science Experience"],
    ["Backyard BBQ", "BBQ", "Backyard BBQ"],
    ["Friday Night Story Hour with the Whole Crew", "Story Hour", "Story Hour"],
  ])("%s reads %s on a button", (name, short_name, expected) => {
    expect(oneTapName(named(name, short_name))).toBe(expected);
  });
});

describe("withStartAs", () => {
  it.each([
    ["Join them as a co-host, or end their show and start your own.", "New Science Experience", "Join them as a co-host, or end their show and start your own as New Science Experience."],
    ["You have to end their show before you can start your own.", "HyperLocal", "You have to end their show before you can start your own as HyperLocal."],
    ["Join them as a co-host, or end their show and start your own.", undefined, "Join them as a co-host, or end their show and start your own."],
  ])("%s + %s", (sentence, program, expected) => {
    expect(withStartAs(sentence, program)).toBe(expected);
  });
});
