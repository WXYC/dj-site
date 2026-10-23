import type { SpecialtyShowRef } from "@wxyc/shared";

/**
 * The title rule for a tagged set: the program's `name` is the title, and
 * `show_name` is a subtitle only when it differs from the program name. An
 * empty `show_name` counts as absent, and an untagged set has no subtitle.
 */
export function specialtySubtitle(
  specialty: Pick<SpecialtyShowRef, "name"> | null | undefined,
  showName: string | null | undefined
): string | null {
  const title = showName || null;
  return specialty && title !== specialty.name ? title : null;
}
