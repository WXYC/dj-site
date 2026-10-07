import { describe, it, expect } from "vitest";
import { isRotationImportRefused } from "@/lib/features/rotation/importOutcome";

describe("isRotationImportRefused", () => {
  it.each([
    [{ status: 409, data: { reason: "rotation_not_eligible" } }, true],
    [{ status: 409, data: { reason: "review_required" } }, true],
    [{ status: 409, data: { reason: "artist_name_conflict" } }, false],
    [{ status: 409, data: {} }, false],
    [{ status: 400, data: { reason: "rotation_not_eligible" } }, false],
    [{ status: "FETCH_ERROR" }, false],
    [new Error("boom"), false],
    [undefined, false],
  ])("classifies %j as %s", (err, expected) => {
    expect(isRotationImportRefused(err)).toBe(expected);
  });
});
