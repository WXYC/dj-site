import { describe, it, expect } from "vitest";
import { fakeLibraryLookupEndpoints, type FakeLibraryOptions } from "@/tests/fakes/reviews/library";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

const RELEASES = [
  { id: 5, album_title: "DOGA", artist_name: "Juana Molina" },
  { id: 6, album_title: "Edits", artist_name: "Chuquimamani-Condori" },
];

describe("fakeLibraryLookupEndpoints", () => {
  it.each<[string, string, number, unknown]>([
    ["a release hit answers the raw row", "?album_id=5", 200, RELEASES[0]],
    ["another release answers its own row", "?album_id=6", 200, RELEASES[1]],
    ["a release miss answers 404", "?album_id=99", 404, { message: "not found" }],
    ["no album_id answers 404", "", 404, { message: "not found" }],
  ])("GET /library/info: %s", async (_name, search, status, body) => {
    fakeLibraryLookupEndpoints({ releases: RELEASES });

    const response = await fetch(`${TEST_BACKEND_URL}/library/info${search}`);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
  });

  it.each<[string, FakeLibraryOptions | undefined, unknown]>([
    ["defaults to one cd format", undefined, [{ id: 1, format_name: "cd" }]],
    ["answers the formats it was given", { formats: [{ id: 2, format_name: "vinyl" }] }, [{ id: 2, format_name: "vinyl" }]],
  ])("GET /library/formats %s", async (_name, options, expected) => {
    fakeLibraryLookupEndpoints(options);

    expect(await (await fetch(`${TEST_BACKEND_URL}/library/formats`)).json()).toEqual(expected);
  });
});
