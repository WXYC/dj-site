import { describe, expect, it } from "vitest";
import { bandcampUrlFrom } from "@/lib/features/reviews/bandcampLink";

// Each "é" becomes "%C3%A9" in the parsed link, so the text stays short while the stored form grows.
const SHORT_TEXT_LONG_HREF = (extra: number) => `https://bandcamp.com/${"é".repeat(80)}${"a".repeat(extra)}`;

describe("bandcampUrlFrom", () => {
  it.each([
    ["https://juanamolina.bandcamp.com/album/doga", "https://juanamolina.bandcamp.com/album/doga"],
    ["  https://bandcamp.com/x  ", "https://bandcamp.com/x"],
    ["", null],
    ["   ", null],
    ["http://juanamolina.bandcamp.com/album/doga", "refused"],
    ["https://example.com/bandcamp.com", "refused"],
    ["https://bandcamp.com.evil.example/x", "refused"],
    ["https://user@juanamolina.bandcamp.com", "refused"],
    ["https://bandcamp.com\\@evil.example/x", "refused"],
    ["https://juanamolina.bandcamp.com/album/do ga", "refused"],
    ["https://juanamolina.bandcamp.com/album/do\u0007ga", "refused"],
    ["bandcamp", "refused"],
    [`https://bandcamp.com/${"a".repeat(512)}`, "refused"],
    [`https://bandcamp.com/${"a".repeat(491)}`, `https://bandcamp.com/${"a".repeat(491)}`],
    [`https://bandcamp.com/${"a".repeat(492)}`, "refused"],
    [SHORT_TEXT_LONG_HREF(11), SHORT_TEXT_LONG_HREF(11)],
    [SHORT_TEXT_LONG_HREF(12), "refused"],
    ["https://evilbandcamp.com/x", "refused"],
    ["https://:pw@juanamolina.bandcamp.com", "refused"],
    ["https://Juanamolina.BANDCAMP.com/x", "https://Juanamolina.BANDCAMP.com/x"],
    ["https://bandcamp.com", "https://bandcamp.com"],
  ])("reads %j as %j", (text, expected) => {
    expect(bandcampUrlFrom(text)).toBe(expected);
  });
});
