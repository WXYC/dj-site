import { describe, it, expect } from "vitest";
import {
  formatReleaseDeletePlayImpact,
  RELEASE_HAS_NO_PLAYS_MESSAGE,
  RELEASE_PLAY_COUNTS_UNREADABLE_MESSAGE,
} from "@/lib/features/catalog/releaseDeletePlayImpact";
import type { FlowsheetPlayCounts } from "@/lib/features/catalog/types";

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
        "2 more archived plays were filed without a link and name this release only by its old catalog number, which nothing will resolve once the card is gone.",
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
      "5 archived plays were filed without a link and name this release only by its old catalog number, which nothing will resolve once the card is gone.",
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
    ).toBe("1 archived play was filed without a link and names this release only by its old catalog number, which nothing will resolve once the card is gone.");
  });

  it("does not read the no-plays case off any single arm", () => {
    // Regression guard: the zero check must read all three arms, not just
    // `direct` — a release with only legacy-linked plays is not a release
    // with none.
    expect(
      formatReleaseDeletePlayImpact({ direct: 0, rotation_linked: 0, legacy_linked: 1 }),
    ).not.toBe(RELEASE_HAS_NO_PLAYS_MESSAGE);
  });

  // The absolute was softened deliberately. The delete snapshots the row
  // before removing it, so a restore under the original `legacy_release_id`
  // is exactly what the linkage job matches on — "never" would be a claim
  // about the system rather than about the delete, and it errs in the
  // direction that stops a librarian pressing a button he is entitled to
  // press. The sentence has to stay honest about the stranding without
  // promising it is forever.
  it("says nothing will resolve the old number, not that the plays can never be re-attached", () => {
    const message = formatReleaseDeletePlayImpact({
      direct: 0,
      rotation_linked: 0,
      legacy_linked: 5,
    });

    expect(message).toContain("nothing will resolve once the card is gone");
    expect(message).not.toContain("never");
  });
});

describe("formatReleaseDeletePlayImpact on a body it cannot count", () => {
  // `FlowsheetPlayCounts` is hand-written because the endpoint is absent from
  // the published contract, so nothing gates the backend renaming an arm, and
  // `surfaceNonJsonAsError` only rejects a body that is not JSON. The cast is
  // the point of the test: it reproduces exactly what a well-formed reply with
  // the wrong keys does once TypeScript is out of the picture.
  const uncountable = (body: unknown) =>
    formatReleaseDeletePlayImpact(body as FlowsheetPlayCounts);

  // The empty string is the dangerous return, not a wrong sentence: the
  // confirmation screen renders `playImpactMessage ? <row> : null`, so "" is
  // NO impact row at all. An irreversible delete would then be confirmed over
  // 47 archived plays in total silence — the one outcome the screen exists to
  // rule out, produced by default the moment an arm goes missing.
  it.each([
    { label: "an arm missing entirely", body: { direct: 41, rotation_linked: 6 } },
    { label: "an arm renamed", body: { direct: 41, rotation_linked: 6, legacyLinked: 2 } },
    { label: "an arm sent as a string", body: { direct: "41", rotation_linked: 6, legacy_linked: 2 } },
    { label: "an arm null", body: { direct: 41, rotation_linked: null, legacy_linked: 2 } },
    { label: "an arm NaN", body: { direct: Number.NaN, rotation_linked: 6, legacy_linked: 2 } },
    { label: "an empty object", body: {} },
  ])("never returns the empty string for $label", ({ body }) => {
    expect(uncountable(body)).not.toBe("");
  });

  it.each([
    { label: "an arm missing entirely", body: { direct: 41, rotation_linked: 6 } },
    { label: "an arm renamed", body: { direct: 41, rotation_linked: 6, legacyLinked: 2 } },
    { label: "an empty object", body: {} },
  ])("admits it could not count rather than guessing, for $label", ({ body }) => {
    expect(uncountable(body)).toBe(RELEASE_PLAY_COUNTS_UNREADABLE_MESSAGE);
  });

  // The two failure shapes are one fact from where the librarian sits — the
  // screen does not know — so they must not read as two different problems.
  // The screen renders this same constant for a rejected read.
  it("says it could not check rather than that the release has no plays", () => {
    expect(uncountable({ direct: 41, rotation_linked: 6 })).not.toBe(
      RELEASE_HAS_NO_PLAYS_MESSAGE,
    );
  });

  // NaN arithmetic is what makes the hole silent: `41 + 6 + undefined === 0`
  // is false, so the zero check passes, and then every `> 0` test fails.
  it("does not let NaN arithmetic print a count", () => {
    expect(uncountable({ direct: 41, rotation_linked: 6 })).not.toContain("NaN");
    expect(uncountable({ direct: 41, rotation_linked: 6 })).not.toContain("41");
  });
});
