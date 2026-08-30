/**
 * The one blank-name filter behind every DJ-name-list renderer, plus the
 * join mechanics built on top of it.
 *
 * A caller takes both its count and its rendered list from here, so the two
 * cannot disagree. A verb chosen from an unfiltered count standing beside a
 * name drawn from a filtered list is what renders "dj sue are on air" for a
 * show whose second DJ has a blank handle.
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

/** Filter blank names, then join what survives as prose. */
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
