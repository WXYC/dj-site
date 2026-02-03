import { describe, it, expect } from "vitest";

/**
 * Creates a test suite for conversion functions with parameterized test cases.
 * Useful for testing pure functions that transform data from one format to another.
 *
 * @example
 * describeConversion("convertToSong", convertToSong, [
 *   {
 *     name: "should convert basic song response",
 *     input: { id: 1, track_title: "Test" },
 *     expected: { id: 1, track_title: "Test" },
 *   },
 *   {
 *     name: "should handle empty track title",
 *     input: { id: 1, track_title: undefined },
 *     expected: { id: 1, track_title: "" },
 *   },
 * ]);
 */
export function describeConversion<Input, Output>(
  name: string,
  fn: (input: Input) => Output,
  cases: Array<{ name: string; input: Input; expected: Output }>
) {
  describe(name, () => {
    it.each(cases)("$name", ({ input, expected }) => {
      expect(fn(input)).toEqual(expected);
    });
  });
}

/**
 * Creates a test suite for conversion functions that need custom assertions.
 * Useful when you need to check specific properties rather than exact equality.
 *
 * @example
 * describeConversionWithAssertions("convertToUser", convertToUser, [
 *   {
 *     name: "should set authority to SM for station-management group",
 *     input: mockToken,
 *     assertions: (result) => {
 *       expect(result.authority).toBe(Authorization.SM);
 *     },
 *   },
 * ]);
 */
export function describeConversionWithAssertions<Input, Output>(
  name: string,
  fn: (input: Input) => Output,
  cases: Array<{ name: string; input: Input; assertions: (result: Output) => void }>
) {
  describe(name, () => {
    it.each(cases)("$name", ({ input, assertions }) => {
      const result = fn(input);
      assertions(result);
    });
  });
}

/**
 * Helper for testing conversions with multiple inputs.
 * Useful for functions that take multiple parameters.
 *
 * @example
 * describeMultiArgConversion("convertAWSToAccountResult",
 *   (args) => convertAWSToAccountResult(args.user, args.smList, args.mdList),
 *   [
 *     {
 *       name: "should identify station manager",
 *       input: { user: mockUser, smList: ["testuser"], mdList: [] },
 *       expected: { authorization: Authorization.SM },
 *     },
 *   ]
 * );
 */
export function describeMultiArgConversion<Args extends object, Output>(
  name: string,
  fn: (args: Args) => Output,
  cases: Array<{ name: string; input: Args; expected: Partial<Output> }>
) {
  describe(name, () => {
    it.each(cases)("$name", ({ input, expected }) => {
      const result = fn(input);
      expect(result).toMatchObject(expected);
    });
  });
}
