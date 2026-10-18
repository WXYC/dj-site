import { describe, expect, it } from "vitest";
import { bandcampUrlFrom } from "@/lib/features/reviews/bandcampLink";

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
  ])("reads %j as %j", (text, expected) => {
    expect(bandcampUrlFrom(text)).toBe(expected);
  });
});
