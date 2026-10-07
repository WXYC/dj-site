import { describe, it, expect, afterEach } from "vitest";

import { Authorization } from "@/lib/features/admin/types";
import { canSeeReviews, reviewsAudience } from "@/lib/features/reviews/flags";

const ENV_KEY = "NEXT_PUBLIC_REVIEWS_ENABLED";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("reviewsAudience", () => {
  it.each([
    [undefined, "off"],
    ["", "off"],
    ["false", "off"],
    ["Staff", "off"],
    ["TRUE", "off"],
    ["0", "off"],
    ["everyone", "off"],
    ["staff", "staff"],
    ["true", "everyone"],
    ["1", "everyone"],
  ])("reads %j as %s (only exact 'staff', 'true' and '1' turn anything on)", (value, expected) => {
    if (value === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = value;
    expect(reviewsAudience()).toBe(expected);
  });
});

describe("canSeeReviews", () => {
  it.each([
    ["off", Authorization.DJ, false],
    ["off", Authorization.MD, false],
    ["off", Authorization.SM, false],
    ["staff", Authorization.DJ, false],
    ["staff", Authorization.MD, true],
    ["staff", Authorization.SM, true],
    ["true", Authorization.DJ, true],
    ["true", Authorization.MD, true],
    ["true", Authorization.SM, true],
  ])("under %s, authorization %s sees reviews: %s", (value, authorization, expected) => {
    process.env[ENV_KEY] = value;
    expect(canSeeReviews(authorization)).toBe(expected);
  });

  it("shows nothing to a signed-out account under any audience", () => {
    for (const value of ["staff", "true"]) {
      process.env[ENV_KEY] = value;
      expect(canSeeReviews(Authorization.NO)).toBe(false);
    }
  });
});
