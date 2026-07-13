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

/**
 * Swap the trigger word occupying `[start, end)` for `word`, leaving the
 * surrounding text (and the trailing space the parser needs) intact. Used to
 * cycle a trailing trigger — `Song by ` → `Song on `. Caret lands at the end of
 * the line, ready for the field value.
 */
export function replaceTriggerWord(
  raw: string,
  start: number,
  end: number,
  word: string
): TriggerInsertion {
  const out = raw.slice(0, start) + word + raw.slice(end);
  return { raw: out, caret: out.length };
}

/**
 * Remove the trailing trigger word at `[start, end)` along with the single
 * space that introduced it — `Song via ` → `Song`. Caret lands where the
 * trigger began (the end of the previous field).
 */
export function removeTrailingTrigger(
  raw: string,
  start: number,
  end: number
): TriggerInsertion {
  // Absorb the one leading space that separated the trigger from the value
  // before it, so we don't leave a dangling gap.
  const cut = start > 0 && /\s/.test(raw[start - 1]) ? start - 1 : start;
  const after = raw.slice(end).replace(/^\s+/, "");
  const head = raw.slice(0, cut);
  return {
    raw: head + (after ? ` ${after}` : ""),
    caret: head.length,
  };
}
