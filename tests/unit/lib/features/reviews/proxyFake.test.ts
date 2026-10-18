import { describe, it, expect } from "vitest";
import { fakeProxyEndpoints, type FakeProxyOptions } from "@/tests/fakes/reviews/proxy";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

describe("fakeProxyEndpoints", () => {
  it.each<[string, FakeProxyOptions | undefined, unknown]>([
    ["answers no cover by default", undefined, { artworkUrl: null }],
    ["answers the cover it was given", { artworkUrl: "https://img.example/doga.jpg" }, { artworkUrl: "https://img.example/doga.jpg" }],
  ])("GET /proxy/metadata/album %s", async (_name, options, expected) => {
    fakeProxyEndpoints(options);

    const response = await fetch(`${TEST_BACKEND_URL}/proxy/metadata/album?artistName=Juana%20Molina&releaseTitle=DOGA`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expected);
  });
});
