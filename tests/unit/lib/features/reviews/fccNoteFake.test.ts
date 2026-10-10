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

  it.each<[string, string, number[]]>([
    ["a record's list is oldest first, then by id", "?intake_item_id=8", [7, 8, 6]],
    ["status=reported with a subject keeps only the reported notes", "?intake_item_id=8&status=reported", [7, 8]],
    ["status=confirmed with a subject keeps only the confirmed notes", "?intake_item_id=8&status=confirmed", [6]],
    ["the waiting list is oldest first, then by id", "?status=reported", [7, 8]],
  ])("%s", async (_name, search, expectedIds) => {
    const at = (reported_at: string) => ({ reported_at });
    const late = fccNote({ id: 8, ...at("2026-10-02T16:00:00Z") });
    const early = fccNote({ id: 7, ...at("2026-10-02T16:00:00Z") });
    const confirmedOne = fccNote({ id: 6, status: "confirmed", ...at("2026-10-03T16:00:00Z") });
    fakeFccNoteEndpoints({ fccNotesForItem: { "8": [confirmedOne, late, early] }, fccNotesToConfirm: [late, early] });

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
    expect(await response.json()).toMatchObject({ id: 4, status: "confirmed", confirmed_by: expect.any(String), confirmed_at: expect.any(String) });
    expect(await readIds("/fcc-notes", "?status=reported")).toEqual([5]);
  });

  it("a confirmed note is read back stamped with who and when", async () => {
    fakeFccNoteEndpoints(OPTIONS);
    await send("POST", "/fcc-notes/2/confirm");

    const reread = await (await fetch(`${TEST_BACKEND_URL}/fcc-notes?intake_item_id=7&status=confirmed`)).json();

    expect(reread).toMatchObject([{ id: 2, status: "confirmed", confirmed_by: expect.any(String), confirmed_at: expect.any(String) }]);
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
