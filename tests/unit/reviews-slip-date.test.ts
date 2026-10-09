import { describe, it, expect } from "vitest";
import { formatSlipDate } from "@/src/components/experiences/modern/reviews/slipDate";

describe("formatSlipDate", () => {
  it.each([
    ["a date passes through", "2026-10-07", "2026-10-07"],
    ["a date-time is read in station time", "2026-10-07T16:00:00Z", "2026-10-07"],
    ["a date-time just after midnight UTC is still the evening before in station time", "2026-10-08T01:30:00Z", "2026-10-07"],
  ])("%s", (_name, value, expected) => {
    expect(formatSlipDate(value)).toBe(expected);
  });
});
