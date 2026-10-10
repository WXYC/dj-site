import { describe, it, expect } from "vitest";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { fakeFccNoteEndpoints, type FakeFccNoteOptions } from "@/tests/fakes/reviews/fccNote";
import { fccNote } from "@/tests/fakes/reviews";
import { readIds } from "./fakeReads";

describe("fakeFccNoteEndpoints GET /fcc-notes", () => {
  const OPTIONS: FakeFccNoteOptions = {
    fccNotesForRelease: { "5": [fccNote({ id: 1 })] },
    fccNotesForItem: { "7": [fccNote({ id: 2 }), fccNote({ id: 3 })] },
    fccNotesToConfirm: [fccNote({ id: 4 }), fccNote({ id: 5 })],
  };

  it.each<[string, string, number[]]>([
    ["album_id answers fccNotesForRelease", "?album_id=5", [1]],
    ["intake_item_id answers fccNotesForItem", "?intake_item_id=7", [2, 3]],
    ["an album_id with no row answers an empty list", "?album_id=99", []],
    ["an intake_item_id with no row answers an empty list", "?intake_item_id=99", []],
    ["status=reported answers fccNotesToConfirm", "?status=reported", [4, 5]],
    ["a query the route does not accept answers an empty list", "?status=confirmed", []],
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

describe("fakeFccNoteEndpoints writes", () => {
  const OPTIONS: FakeFccNoteOptions = {
    fccNotesForItem: { "7": [fccNote({ id: 2 })] },
    fccNotesToConfirm: [fccNote({ id: 4 }), fccNote({ id: 5 })],
  };
  const send = (method: string, path: string) => fetch(`${TEST_BACKEND_URL}${path}`, { method });

  it("a confirm answers the note as confirmed and takes it off the waiting list", async () => {
    fakeFccNoteEndpoints(OPTIONS);

    const response = await send("POST", "/fcc-notes/4/confirm");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 4, status: "confirmed" });
    expect(await readIds("/fcc-notes", "?status=reported")).toEqual([5]);
  });

  it("a delete answers 204 and drops the note from every read", async () => {
    fakeFccNoteEndpoints(OPTIONS);

    expect((await send("DELETE", "/fcc-notes/2")).status).toBe(204);
    expect(await readIds("/fcc-notes", "?intake_item_id=7")).toEqual([]);
  });

  it.each([
    ["confirm", "POST", "/fcc-notes/99/confirm"],
    ["delete", "DELETE", "/fcc-notes/99"],
  ])("a %s of an id no list names answers 404", async (_name, method, path) => {
    fakeFccNoteEndpoints(OPTIONS);

    expect((await send(method, path)).status).toBe(404);
  });
});
