import { describe, it, expect } from "vitest";
import {
  discogsPrefillErrorMessage,
  discogsReleaseUrl,
  withDefinitiveDiscogsUrl,
} from "@/lib/features/catalog/discogsPrefill";

const GENERIC = "Couldn't autopopulate from that link. Enter the release details manually.";

describe("discogsReleaseUrl", () => {
  it("builds the canonical release link from an id", () => {
    expect(discogsReleaseUrl(24216789)).toBe("https://www.discogs.com/release/24216789");
  });
});

describe("withDefinitiveDiscogsUrl", () => {
  it("records the canonical link first when the list is empty", () => {
    expect(withDefinitiveDiscogsUrl([], 24216789)).toEqual([
      "https://www.discogs.com/release/24216789",
    ]);
  });

  it("keeps non-Discogs links, in order, after the definitive one", () => {
    expect(
      withDefinitiveDiscogsUrl(
        ["juanamolina.bandcamp.com/album/doga", "sonamos.com/doga"],
        24216789,
      ),
    ).toEqual([
      "https://www.discogs.com/release/24216789",
      "juanamolina.bandcamp.com/album/doga",
      "sonamos.com/doga",
    ]);
  });

  it("replaces a prior Discogs release link so a re-autopopulate corrects rather than accumulates", () => {
    expect(
      withDefinitiveDiscogsUrl(
        ["https://www.discogs.com/release/111", "sonamos.com/doga"],
        24216789,
      ),
    ).toEqual(["https://www.discogs.com/release/24216789", "sonamos.com/doga"]);
  });

  it("drops a scheme-less Discogs release link too", () => {
    expect(withDefinitiveDiscogsUrl(["www.discogs.com/release/111"], 222)).toEqual([
      "https://www.discogs.com/release/222",
    ]);
  });

  it("keeps a Discogs master link — it is a reference, not the resolved release", () => {
    expect(
      withDefinitiveDiscogsUrl(["https://www.discogs.com/master/999"], 24216789),
    ).toEqual([
      "https://www.discogs.com/release/24216789",
      "https://www.discogs.com/master/999",
    ]);
  });
});

describe("discogsPrefillErrorMessage", () => {
  it("shows the endpoint's named 4xx message verbatim (operator-facing)", () => {
    expect(
      discogsPrefillErrorMessage({
        discogsPrefillError: {
          status: 400,
          data: { message: "Not a Discogs release URL", code: "not_release_url" },
        },
      }),
    ).toBe("Not a Discogs release URL");
  });

  it("shows the 404 message for a link Discogs has no record of", () => {
    expect(
      discogsPrefillErrorMessage({
        discogsPrefillError: {
          status: 404,
          data: { message: "Discogs has no release for that link", code: "release_not_found" },
        },
      }),
    ).toBe("Discogs has no release for that link");
  });

  it("falls back to the generic message on a hard upstream failure so no LML detail leaks", () => {
    expect(
      discogsPrefillErrorMessage({
        discogsPrefillError: { status: 502, data: { message: "LML upstream exploded internally" } },
      }),
    ).toBe(GENERIC);
  });

  it("falls back to the generic message on a network error (no numeric status)", () => {
    expect(
      discogsPrefillErrorMessage({ discogsPrefillError: { status: "FETCH_ERROR", error: "boom" } }),
    ).toBe(GENERIC);
  });

  it("reads a bare (un-nested) error object as well", () => {
    expect(
      discogsPrefillErrorMessage({ status: 400, data: { message: "Not a Discogs URL" } }),
    ).toBe("Not a Discogs URL");
  });

  it("falls back to the generic message for a non-object error", () => {
    expect(discogsPrefillErrorMessage(undefined)).toBe(GENERIC);
    expect(discogsPrefillErrorMessage("nope")).toBe(GENERIC);
  });
});
