import { describe, it, expect } from "vitest";
import {
  FLOWSHEET_OPTIMISTIC_DJ_PLACEHOLDER,
  FLOWSHEET_PAGE_SIZE,
  OFF_AIR_LABEL,
} from "@/lib/features/flowsheet/constants";

describe("flowsheet constants", () => {
  it("exports stable pagination and copy constants", () => {
    expect(FLOWSHEET_PAGE_SIZE).toBe(20);
    expect(OFF_AIR_LABEL).toBe("Off Air");
    expect(FLOWSHEET_OPTIMISTIC_DJ_PLACEHOLDER).toBeTruthy();
  });
});
