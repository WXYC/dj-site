import type { FlowsheetPlayCounts } from "./types";

/** Shown when the three arms all come back at zero. */
export const RELEASE_HAS_NO_PLAYS_MESSAGE = "This release has no plays on record.";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * The delete confirmation's play-impact sentence, built from the three
 * disjoint counts `GET /library/:id/flowsheet-play-counts` returns.
 *
 * The headline count is `direct + rotation_linked` only, never all three:
 * those are the two arms that actually reference this release through a link
 * column, and both lose that link when the release goes. `legacy_linked`
 * plays carry no link to lose — they name the release only by a bare
 * `legacy_release_id` — so summing them into the headline would claim a
 * link exists where there is none. They get their own clause instead,
 * appended only when non-zero, naming the consequence that is actually
 * theirs: stranded rather than unlinked, since deleting the release removes
 * the only row their `legacy_release_id` could ever have resolved to.
 *
 * The closing sentence ("They keep their artist, album and label text and
 * lose their link to this card") describes the direct and rotation-linked
 * arms only. It still renders even when those two arms are themselves zero
 * and only the legacy arm is non-zero — a real but rare shape — because it
 * is vacuously true of an empty set rather than false, and a conditional
 * fourth message for that shape is not worth the surface area.
 */
export function formatReleaseDeletePlayImpact(counts: FlowsheetPlayCounts): string {
  const { direct, rotation_linked: rotationLinked, legacy_linked: legacyLinked } = counts;
  const total = direct + rotationLinked + legacyLinked;

  if (total === 0) {
    return RELEASE_HAS_NO_PLAYS_MESSAGE;
  }

  const linked = direct + rotationLinked;
  const legacyClause =
    legacyLinked > 0
      ? `, and ${legacyLinked} archived without a link, which will never join another release`
      : "";

  return (
    `${linked} archived ${pluralize(linked, "play", "plays")} ` +
    `${pluralize(linked, "references", "reference")} this release — ` +
    `${direct} directly, ${rotationLinked} through its rotation entry${legacyClause}. ` +
    `They keep their artist, album and label text and lose their link to this card.`
  );
}
