/**
 * The one blank-name filter behind every DJ-name-list renderer, plus the
 * join mechanics built on top of it.
 *
 * Before this module, three call sites spelled "drop blank/whitespace names"
 * independently: `formatDjNames`'s own inline `.trim().filter(...)`,
 * `describeOpenShow`'s copy of the same expression (needed because the
 * "is"/"are" verb has to agree with the rendered list), and the joinShow
 * optimistic patch in `api.ts` (`.filter((d) => d.dj_name)`, a *different*
 * spelling — untrimmed truthiness, over DJ objects rather than strings).
 * `formatOnAirSummary` did not filter at all, trusting whichever caller
 * happened to pre-filter for it.
 *
 * The divergence between the first two once produced the sentence "dj sue
 * are on air": the verb came from an unfiltered count while the name came
 * from a filtered list, so a blank second co-host inflated the count without
 * appearing in the sentence. Routing every caller through the same
 * `nonBlankNames` makes that class of bug structurally impossible — a count
 * and a rendered list taken from this module can no longer disagree, because
 * they were never two lists to begin with.
 */

/** Trim and drop blank/whitespace-only names. The one blank-name filter. */
export function nonBlankNames(names: readonly string[]): string[] {
  return names.map((name) => name.trim()).filter((name) => name.length > 0);
}

/**
 * How a name list reads as prose. The two things callers are meant to
 * differ on — everything else (the blank-name filter, the 0/1/2+ branching)
 * is shared.
 */
export type NameListStyle = {
  /** Rendered when there are no non-blank names at all. */
  readonly whenEmpty: string;
  /**
   * Word placed before the final name once there are 2+ names, e.g. "and" →
   * "a, b and c". Omit for a plain comma join with no conjunction ("a, b").
   */
  readonly conjunction?: string;
};

/**
 * Filter blank names, then join what survives as prose.
 *
 * The shared implementation behind `formatDjNames` (the go-live handoff
 * prompt: "Someone" when empty, "and" before the last name — verb agreement
 * upstream depends on this filtering, not just the rendered text) and
 * `formatOnAirSummary` (the on-air banner: `OFF_AIR_LABEL` when empty, a
 * plain comma join, no conjunction).
 */
export function formatNameList(
  names: readonly string[],
  style: NameListStyle
): string {
  const cleaned = nonBlankNames(names);
  if (cleaned.length === 0) return style.whenEmpty;
  if (cleaned.length === 1) return cleaned[0];
  if (!style.conjunction) return cleaned.join(", ");
  return `${cleaned.slice(0, -1).join(", ")} ${style.conjunction} ${cleaned[cleaned.length - 1]}`;
}
