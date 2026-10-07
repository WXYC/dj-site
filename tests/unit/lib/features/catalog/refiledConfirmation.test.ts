import { describe, it, expect } from "vitest";
import { CODE_NUMBER_MAX } from "@/lib/features/catalog/adminCreateArtistValidation";
import { parseRefiledParams } from "@/lib/features/catalog/refiledConfirmation";

describe("parseRefiledParams", () => {
  it.each([
    { refiled: "1", from: "0", n: "0", expected: { from: 0, releases: 0 } },
    { refiled: "1", from: "1", n: "2", expected: { from: 1, releases: 2 } },
    { refiled: "1", from: " 3", n: "4 ", expected: { from: 3, releases: 4 } },
    { refiled: "1", from: String(CODE_NUMBER_MAX), n: "1", expected: { from: CODE_NUMBER_MAX, releases: 1 } },
    { refiled: "1", from: "-1", n: "1", expected: undefined },
    { refiled: "1", from: "1.5", n: "1", expected: undefined },
    { refiled: "1", from: "3a", n: "1", expected: undefined },
    { refiled: "1", from: "03", n: "1", expected: undefined },
    { refiled: "1", from: "", n: "1", expected: undefined },
    { refiled: "1", from: "1", n: "", expected: undefined },
    { refiled: "1", from: "1", n: "-1", expected: undefined },
    { refiled: "1", from: String(CODE_NUMBER_MAX + 1), n: "1", expected: undefined },
    { refiled: "1", from: "1", n: String(CODE_NUMBER_MAX + 1), expected: undefined },
    { refiled: "1", from: undefined, n: "1", expected: undefined },
    { refiled: "1", from: "1", n: undefined, expected: undefined },
    { refiled: "true", from: "1", n: "1", expected: undefined },
    { refiled: "0", from: "1", n: "1", expected: undefined },
    { refiled: undefined, from: "1", n: "1", expected: undefined },
  ])("refiled=$refiled from=$from n=$n", ({ refiled, from, n, expected }) => {
    expect(parseRefiledParams(refiled, from, n)).toEqual(expected);
  });
});
