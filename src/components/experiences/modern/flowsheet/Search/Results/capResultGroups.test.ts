import { describe, expect, it } from "vitest";
import { capResultGroups } from "./capResultGroups";

describe("capResultGroups", () => {
  it("caps each group at base quota and redistributes leftover", () => {
    const groups = [
      [1, 2, 3, 4],
      [1],
      [1, 2, 3],
      [1, 2],
    ];
    const capped = capResultGroups(groups, 10, 3);
    expect(capped[0]).toHaveLength(4);
    expect(capped[1]).toHaveLength(1);
    expect(capped[2]).toHaveLength(3);
    expect(capped[3]).toHaveLength(2);
    expect(capped.flat().length).toBe(10);
  });

  it("respects narrow total of 6", () => {
    const groups = [[1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3]];
    const capped = capResultGroups(groups, 6, 2);
    expect(capped.flat().length).toBe(6);
  });
});
