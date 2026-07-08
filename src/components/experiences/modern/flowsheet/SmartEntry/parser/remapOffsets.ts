/**
 * A single contiguous text edit: `removed` characters at `[start, start +
 * removed)` were replaced by `inserted` characters. A controlled input only
 * ever produces one of these per change (even a paste-over-selection), so
 * diffing old vs new from both ends recovers it exactly.
 */
export type Splice = {
  start: number;
  removed: number;
  inserted: number;
};

/** Recover the single contiguous splice between `oldStr` and `newStr`. */
export function diffSplice(oldStr: string, newStr: string): Splice {
  const minLen = Math.min(oldStr.length, newStr.length);
  let start = 0;
  while (start < minLen && oldStr[start] === newStr[start]) start++;

  let oldEnd = oldStr.length;
  let newEnd = newStr.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldStr[oldEnd - 1] === newStr[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }

  return { start, removed: oldEnd - start, inserted: newEnd - start };
}

/** The non-whitespace token beginning at `pos` in `str` (may be ""). */
function tokenAt(str: string, pos: number): string {
  let end = pos;
  while (end < str.length && !/\s/.test(str[end])) end++;
  return str.slice(pos, end);
}

/**
 * Remap suppressed-trigger start offsets across a text edit.
 *
 * Each suppressed offset points at a trigger word the DJ escaped to literal
 * text. After an edit:
 *   - a word entirely before the edit keeps its offset;
 *   - a word entirely after the edit shifts by the length delta;
 *   - a word the edit overlaps is dropped.
 *
 * The positional map is then validated: the remapped offset is kept only if it
 * still holds the *same* trigger word (case-insensitively). This catches
 * boundary edits — e.g. inserting a letter right after "on" to make "onn" —
 * where the offset math alone would wrongly keep the suppression. Editing the
 * escaped word itself is the deliberate "re-invoke parsing" gesture, so its
 * suppression drops and the trigger becomes active again.
 */
export function remapSuppressedTriggers(
  oldRaw: string,
  newRaw: string,
  suppressed: readonly number[]
): number[] {
  if (suppressed.length === 0) return [];
  const { start, removed, inserted } = diffSplice(oldRaw, newRaw);
  const delta = inserted - removed;
  const editEnd = start + removed;

  const out: number[] = [];
  for (const pos of suppressed) {
    const originalWord = tokenAt(oldRaw, pos);
    const wordEnd = pos + originalWord.length;

    let newPos: number;
    if (wordEnd <= start) {
      newPos = pos; // word entirely before the edit
    } else if (pos >= editEnd) {
      newPos = pos + delta; // word entirely after the edit
    } else {
      continue; // edit overlaps the word → drop
    }

    // Keep only if the same trigger word still sits at the remapped offset.
    if (tokenAt(newRaw, newPos).toLowerCase() === originalWord.toLowerCase()) {
      out.push(newPos);
    }
  }
  return out;
}
