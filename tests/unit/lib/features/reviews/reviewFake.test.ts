import { describe, it, expect } from "vitest";
import { fakeReviewEndpoints, type FakeReviewOptions } from "@/tests/fakes/reviews/review";
import { review } from "@/tests/fakes/reviews";
import { readIds } from "./fakeReads";

describe("fakeReviewEndpoints GET /reviews", () => {
  const OPTIONS: FakeReviewOptions = {
    mine: [review({ id: 1 })],
    forRelease: { "5": [review({ id: 2 })] },
    forItem: { "7": [review({ id: 3 }), review({ id: 4 })] },
  };

  it.each<[string, string, number[]]>([
    ["album_id answers forRelease", "?album_id=5", [2]],
    ["intake_item_id answers forItem", "?intake_item_id=7", [3, 4]],
    ["mine=true answers mine", "?mine=true", [1]],
    ["an album_id with no row answers an empty list", "?album_id=99", []],
    ["an intake_item_id with no row answers an empty list", "?intake_item_id=99", []],
    ["a query matching none of them answers an empty list, not mine", "?status=draft", []],
    ["no query at all answers an empty list, not mine", "", []],
  ])("%s", async (_name, search, expectedIds) => {
    fakeReviewEndpoints(OPTIONS);

    expect(await readIds("/reviews", search)).toEqual(expectedIds);
  });
});
