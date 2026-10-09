import { describe, it, expect } from "vitest";
import { fakeFccNoteEndpoints, type FakeFccNoteOptions } from "@/tests/fakes/reviews/fccNote";
import { fccNote } from "@/tests/fakes/reviews";
import { readIds } from "./fakeReads";

describe("fakeFccNoteEndpoints GET /fcc-notes", () => {
  const OPTIONS: FakeFccNoteOptions = {
    fccNotesForRelease: { "5": [fccNote({ id: 1 })] },
    fccNotesForItem: { "7": [fccNote({ id: 2 }), fccNote({ id: 3 })] },
  };

  it.each<[string, string, number[]]>([
    ["album_id answers fccNotesForRelease", "?album_id=5", [1]],
    ["intake_item_id answers fccNotesForItem", "?intake_item_id=7", [2, 3]],
    ["an album_id with no row answers an empty list", "?album_id=99", []],
    ["an intake_item_id with no row answers an empty list", "?intake_item_id=99", []],
    ["a query naming neither answers an empty list", "?status=reported", []],
    ["no query at all answers an empty list", "", []],
  ])("%s", async (_name, search, expectedIds) => {
    fakeFccNoteEndpoints(OPTIONS);

    expect(await readIds("/fcc-notes", search)).toEqual(expectedIds);
  });

  it("answers an empty list by default", async () => {
    fakeFccNoteEndpoints();

    expect(await readIds("/fcc-notes", "?album_id=5")).toEqual([]);
  });
});
