import { describe, it, expect } from "vitest";
import { compilationTrackCreditKey } from "@/lib/features/catalog/compilationTrackCredits";

describe("compilationTrackCreditKey", () => {
  it("distinguishes an artist/title split that a plain-joined string would collide on", () => {
    const splitOne = compilationTrackCreditKey({
      artist_name: "Cat",
      track_title: "Power Ballad",
    });
    const splitTwo = compilationTrackCreditKey({
      artist_name: "Cat Power",
      track_title: "Ballad",
    });

    expect(splitOne).not.toBe(splitTwo);
  });

  it("trims both fields before keying, matching the server's dedupe on submission", () => {
    const untrimmed = compilationTrackCreditKey({
      artist_name: "  Jessica Pratt  ",
      track_title: "  Back, Baby  ",
    });
    const trimmed = compilationTrackCreditKey({
      artist_name: "Jessica Pratt",
      track_title: "Back, Baby",
    });

    expect(untrimmed).toBe(trimmed);
  });

  it("treats a null and a missing track_title identically", () => {
    const withNull = compilationTrackCreditKey({
      artist_name: "Chuquimamani-Condori",
      track_title: null,
    });
    const withUndefined = compilationTrackCreditKey({
      artist_name: "Chuquimamani-Condori",
    });

    expect(withNull).toBe(withUndefined);
  });

  it("distinguishes two credits for the same artist with different titles", () => {
    const a = compilationTrackCreditKey({
      artist_name: "Stereolab",
      track_title: "Metronomic Underground",
    });
    const b = compilationTrackCreditKey({
      artist_name: "Stereolab",
      track_title: "Tone Burst",
    });

    expect(a).not.toBe(b);
  });
});
