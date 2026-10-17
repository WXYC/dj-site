import { describe, it, expect } from "vitest";
import type { IntakeItem } from "@wxyc/shared";
import { recordStage, type ReviewStage } from "@/lib/features/reviews/holder";
import { intakeItem } from "@/tests/fakes/reviews";

describe("recordStage", () => {
  it.each<[string, IntakeItem["effective_state"], boolean, ReviewStage]>([
    ["a filed record", "filed", false, "filed"],
    ["a finalized record", "finalized", false, "filed"],
    ["a filed record that is in the waiting read", "filed", true, "filed"],
    ["a reviewed record", "reviewed", false, "reviewed"],
    ["a reviewed record that is also in the waiting read", "reviewed", true, "reviewed"],
    ["a checked out record with a waiting review", "checked_out", true, "waiting"],
    ["a requested record with a waiting review", "requested", true, "waiting"],
    ["a pool record with a waiting review", "pool", true, "waiting"],
    ["a requested record", "requested", false, "requested"],
    ["a checked out record", "checked_out", false, "being_reviewed"],
    ["a pool record", "pool", false, "review_shelf"],
  ])("puts %s in its stage", (_label, effective_state, isWaiting, expected) => {
    const item = intakeItem({ id: 7, effective_state });
    expect(recordStage(item, new Set(isWaiting ? [7] : [99]))).toBe(expected);
  });
});
