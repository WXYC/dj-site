import { describe, it, expect } from "vitest";
import {
  formatReleaseDeletePlayImpact,
  RELEASE_HAS_NO_PLAYS_MESSAGE,
} from "@/lib/features/catalog/releaseDeletePlayImpact";

describe("formatReleaseDeletePlayImpact", () => {
  it("states plainly that a release has no plays when all three arms are zero", () => {
    expect(
      formatReleaseDeletePlayImpact({ direct: 0, rotation_linked: 0, legacy_linked: 0 }),
    ).toBe(RELEASE_HAS_NO_PLAYS_MESSAGE);
  });

  it("names direct and rotation-linked plays when the legacy arm is empty", () => {
    expect(
      formatReleaseDeletePlayImpact({ direct: 41, rotation_linked: 6, legacy_linked: 0 }),
    ).toBe(
      "47 archived plays are linked to this release — 41 directly, 6 through its rotation entry. " +
        "They keep their artist, album and label text and lose their link to this card.",
    );
  });

  it("gives the legacy-linked arm its own sentence, with its own count and consequence", () => {
    expect(
      formatReleaseDeletePlayImpact({ direct: 41, rotation_linked: 6, legacy_linked: 2 }),
    ).toBe(
      "47 archived plays are linked to this release — 41 directly, 6 through its rotation entry. " +
        "They keep their artist, album and label text and lose their link to this card. " +
        "2 more archived plays were filed without a link and will never join another release.",
    );
  });

  // The defect this pins: an earlier draft stated 41 + 6 = 47 as a headline and
  // then appended the legacy arm as a third clause of the SAME sentence, so a
  // reader adding up the parts got 49 against a stated 47. Every count in the
  // message must be honestly totalled by the arms enumerated beneath it.
  it("never states a total the arms beneath it do not add up to", () => {
    const message = formatReleaseDeletePlayImpact({
      direct: 41,
      rotation_linked: 6,
      legacy_linked: 2,
    });

    // 47 belongs to the linked sentence and is enumerated there in full.
    expect(message).toContain("47 archived plays are linked to this release — 41 directly, 6");
    // The legacy arm never joins that total, in either direction.
    expect(message).not.toContain("49");
    expect(message).not.toContain("47 archived plays are linked to this release — 41 directly, 6 through its rotation entry, and 2");
    // And 2 is stated as its own count, not as a share of 47.
    expect(message).toContain("2 more archived plays were filed without a link");
  });

  it("uses the singular throughout when exactly one play is linked", () => {
    expect(
      formatReleaseDeletePlayImpact({ direct: 1, rotation_linked: 0, legacy_linked: 0 }),
    ).toBe(
      "1 archived play is linked to this release — 1 directly, 0 through its rotation entry. " +
        "It keeps its artist, album and label text and loses its link to this card.",
    );
  });

  it("omits the linked sentence entirely when only legacy-linked plays remain", () => {
    // Real but rare: every direct and rotation-linked play was already
    // re-pointed elsewhere. The old wording emitted "0 archived plays ... 0
    // directly, 0 through its rotation entry. They keep their ..." — a
    // sentence about nothing, followed by a promise about an empty set. One
    // true statement is better than two vacuous ones.
    expect(
      formatReleaseDeletePlayImpact({ direct: 0, rotation_linked: 0, legacy_linked: 5 }),
    ).toBe(
      "5 archived plays were filed without a link and will never join another release.",
    );
  });

  it("drops the \"more\" qualifier when there is no linked sentence for it to refer back to", () => {
    const legacyOnly = formatReleaseDeletePlayImpact({
      direct: 0,
      rotation_linked: 0,
      legacy_linked: 5,
    });
    const both = formatReleaseDeletePlayImpact({
      direct: 3,
      rotation_linked: 0,
      legacy_linked: 5,
    });

    expect(legacyOnly).not.toContain("more");
    expect(both).toContain("5 more archived plays");
  });

  it("uses the singular for a lone legacy-linked play", () => {
    expect(
      formatReleaseDeletePlayImpact({ direct: 0, rotation_linked: 0, legacy_linked: 1 }),
    ).toBe("1 archived play was filed without a link and will never join another release.");
  });

  it("does not read the no-plays case off any single arm", () => {
    // Regression guard: the zero check must read all three arms, not just
    // `direct` — a release with only legacy-linked plays is not a release
    // with none.
    expect(
      formatReleaseDeletePlayImpact({ direct: 0, rotation_linked: 0, legacy_linked: 1 }),
    ).not.toBe(RELEASE_HAS_NO_PLAYS_MESSAGE);
  });
});
