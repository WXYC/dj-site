import { describe, it, expect } from "vitest";
import {
  discogsPrefillErrorMessage,
  discogsReleaseIdFrom,
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

describe("discogsReleaseIdFrom", () => {
  it.each<[string, string, number | null]>([
    // Bare numbers
    ["a bare number", "8434", 8434],
    ["a bare number with surrounding spaces", "  8434  ", 8434],
    ["a bare number with a tab and a newline", "\t8434\n", 8434],
    ["a bare number with leading zeros", "008434", 8434],
    ["the largest int4", "2147483647", 2147483647],
    ["a link with surrounding spaces", "  https://www.discogs.com/release/8434  ", 8434],
    // Release links
    ["https with www and a slug", "https://www.discogs.com/release/8434-Autechre-Confield", 8434],
    ["http", "http://www.discogs.com/release/8434", 8434],
    ["scheme-less, no www", "discogs.com/release/8434", 8434],
    ["scheme-less www with a trailing slash", "www.discogs.com/release/8434/", 8434],
    ["a language subdomain", "https://de.discogs.com/release/8434-Autechre-Confield", 8434],
    ["a locale path", "https://www.discogs.com/de/release/8434-Autechre-Confield", 8434],
    ["a query string and a fragment", "https://www.discogs.com/release/8434-Autechre-Confield?ev=rr#images", 8434],
    ["the marketplace shape", "https://www.discogs.com/sell/release/8434", 8434],
    ["an upper-case host", "https://WWW.DISCOGS.COM/release/8434", 8434],
    // Masters are never release ids
    ["a master link", "https://www.discogs.com/master/8434-Confield", null],
    ["an old master view link", "https://www.discogs.com/master/view/8434", null],
    ["a Discogs master code", "m8434", null],
    ["a Discogs release code", "r8434", null],
    ["a bracketed release code", "[r8434]", null],
    // Look-alike hosts
    ["another host", "https://example.com/release/8434", null],
    ["discogs.com as a prefix of another host", "https://discogs.com.evil.com/release/8434", null],
    ["a host ending in discogs.com without a dot", "https://notdiscogs.com/release/8434", null],
    ["discogs.com as userinfo", "https://discogs.com@evil.com/release/8434", null],
    ["discogs.com in another host's path", "https://evil.com/discogs.com/release/8434", null],
    // Ids the backend refuses
    ["zero", "0", null],
    ["zeros", "000", null],
    ["a release link to zero", "https://www.discogs.com/release/0", null],
    ["one past int4", "2147483648", null],
    ["a release link one past int4", "https://www.discogs.com/release/2147483648", null],
    ["an unsafe integer", "9007199254740993", null],
    ["a number too long to be finite", "9".repeat(400), null],
    // Other text
    ["a negative number", "-8434", null],
    ["a decimal", "8434.5", null],
    ["digits with a space inside", "84 34", null],
    ["letters", "abc", null],
    ["letters among digits", "84a34", null],
    ["empty", "", null],
    ["only spaces", "   ", null],
  ])("reads %s (%j) as %j", (_shape, raw, expected) => {
    expect(discogsReleaseIdFrom(raw)).toBe(expected);
  });
});
