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
      "47 archived plays reference this release — 41 directly, 6 through its rotation entry. " +
        "They keep their artist, album and label text and lose their link to this card.",
    );
  });

  // The resolved copy for this screen: the headline count is the sum of the
  // two arms that actually reference the release through a link column (41 +
  // 6 = 47), never all three -- the legacy-linked arm is named in its own
  // clause with its own consequence, and is not folded into that total.
  it("gives the legacy-linked arm its own clause, worded differently, when it is non-zero", () => {
    expect(
      formatReleaseDeletePlayImpact({ direct: 41, rotation_linked: 6, legacy_linked: 2 }),
    ).toBe(
      "47 archived plays reference this release — 41 directly, 6 through its rotation entry, " +
        "and 2 archived without a link, which will never join another release. " +
        "They keep their artist, album and label text and lose their link to this card.",
    );
  });

  it("never sums the legacy-linked arm into the headline count", () => {
    const message = formatReleaseDeletePlayImpact({
      direct: 41,
      rotation_linked: 6,
      legacy_linked: 2,
    });

    expect(message.startsWith("47 archived plays")).toBe(true);
    expect(message).not.toContain("49 archived plays");
  });

  it("uses the singular for a headline count of exactly one", () => {
    expect(
      formatReleaseDeletePlayImpact({ direct: 1, rotation_linked: 0, legacy_linked: 0 }),
    ).toBe(
      "1 archived play references this release — 1 directly, 0 through its rotation entry. " +
        "They keep their artist, album and label text and lose their link to this card.",
    );
  });

  it("uses the plural for a headline count of zero", () => {
    // Real but rare: every direct/rotation-linked play was already
    // re-pointed elsewhere, and only legacy-linked plays remain. "0" still
    // takes the plural in English ("0 archived plays"), and the closing
    // sentence about losing a link stays -- vacuously true of the empty
    // direct/rotation set rather than false.
    expect(
      formatReleaseDeletePlayImpact({ direct: 0, rotation_linked: 0, legacy_linked: 5 }),
    ).toBe(
      "0 archived plays reference this release — 0 directly, 0 through its rotation entry, " +
        "and 5 archived without a link, which will never join another release. " +
        "They keep their artist, album and label text and lose their link to this card.",
    );
  });

  it("does not pluralize the no-plays message off any single arm", () => {
    // Regression guard: `total === 0` must read all three arms, not just
    // `direct` -- a release with only legacy-linked plays is not a release
    // with none.
    const message = formatReleaseDeletePlayImpact({
      direct: 0,
      rotation_linked: 0,
      legacy_linked: 1,
    });

    expect(message).not.toBe(RELEASE_HAS_NO_PLAYS_MESSAGE);
  });
});
