import type { FlowsheetPlayCounts } from "./types";

/** Shown when the three arms all come back at zero. */
export const RELEASE_HAS_NO_PLAYS_MESSAGE = "This release has no plays on record.";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * The delete confirmation's play-impact message, built from the three disjoint
 * counts `GET /library/:id/flowsheet-play-counts` returns.
 *
 * **No sentence ever totals all three arms, and no stated total is ever
 * partial.** Each sentence carries a count and enumerates exactly what that
 * count covers, so a reader adding up the parts always lands on the number
 * above them. An earlier draft announced `direct + rotation_linked` as the
 * headline and then appended the legacy arm as a third clause to the same
 * sentence: with 41/6/2 it read "47 ... reference this release — 41 directly,
 * 6 through its rotation entry, and 2 archived without a link", inviting the
 * reader to sum 49 against a stated 47. The disambiguation existed only in
 * this comment, which is the wrong place for it — the librarian reads the
 * sentence, not the source.
 *
 * So the arms are split by the consequence they actually carry, which is also
 * why the counts must not be summed in the first place:
 *
 * - `direct` and `rotation_linked` both reach this release through a link
 *   column and both LOSE that link when it goes. They share a sentence, and
 *   its total is honestly theirs.
 * - `legacy_linked` plays have no link to lose — they name the release only
 *   by a bare `legacy_release_id`. Deleting the release removes the only row
 *   that id could ever have resolved to, so they are STRANDED rather than
 *   unlinked. Permanent, and a different fact, so it gets its own sentence.
 *
 * Either sentence is omitted when its own arms are zero, so the rare
 * legacy-only shape reads as one true statement rather than a linked-arm
 * sentence about nothing.
 */
export function formatReleaseDeletePlayImpact(counts: FlowsheetPlayCounts): string {
  const { direct, rotation_linked: rotationLinked, legacy_linked: legacyLinked } = counts;

  if (direct + rotationLinked + legacyLinked === 0) {
    return RELEASE_HAS_NO_PLAYS_MESSAGE;
  }

  const linked = direct + rotationLinked;
  const sentences: string[] = [];

  if (linked > 0) {
    sentences.push(
      `${linked} archived ${pluralize(linked, "play is", "plays are")} linked to this release — ` +
        `${direct} directly, ${rotationLinked} through its rotation entry. ` +
        `${pluralize(linked, "It keeps its", "They keep their")} artist, album and label text ` +
        `and ${pluralize(linked, "loses its", "lose their")} link to this card.`,
    );
  }

  if (legacyLinked > 0) {
    sentences.push(
      `${legacyLinked}${linked > 0 ? " more" : ""} archived ` +
        `${pluralize(legacyLinked, "play was", "plays were")} filed without a link and ` +
        `will never join another release.`,
    );
  }

  return sentences.join(" ");
}
