export type TriggerInsertion = {
  /** The raw text with the trigger word spliced in. */
  raw: string;
  /** Where to place the caret afterwards — just past the inserted word + space,
   *  ready for the DJ to type the field value. */
  caret: number;
};

/**
 * Splice a trigger word (`by` / `from` / `via`) into the composer text at the
 * caret/selection, surrounding it with exactly the whitespace the parser needs
 * to recognize it as a standalone trigger (preceded and followed by a space).
 *
 * - A leading space is added only when the preceding character isn't already
 *   whitespace (and we aren't at the very start).
 * - Exactly one trailing space is guaranteed, collapsing any whitespace that
 *   already led the following text so we never leave a double gap.
 * - Any selected range is replaced.
 *
 * Pure — the caller applies `raw` (through the controlled textarea) and then
 * restores the returned caret.
 */
export function insertTriggerWord(
  raw: string,
  selStart: number,
  selEnd: number,
  word: string
): TriggerInsertion {
  const before = raw.slice(0, selStart);
  const after = raw.slice(selEnd);

  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const head = needsLeadingSpace ? `${before} ` : before;
  const core = `${word} `;
  // Drop leading whitespace on the following text — our own trailing space in
  // `core` already separates the trigger from the value.
  const tail = after.replace(/^\s+/, "");

  return {
    raw: head + core + tail,
    caret: head.length + core.length,
  };
}
