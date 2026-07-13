import type {
  FieldSpan,
  ParseOptions,
  ParseResult,
  PendingTrigger,
  SmartField,
} from "./types";

/**
 * Trigger words → the field the text after them fills. One canonical word per
 * field: `by` the artist, `on` the album, `via` the label. Leading text (before
 * the first trigger) is always the song, so the song needs no trigger of its
 * own.
 */
const TRIGGERS: Readonly<Record<string, SmartField>> = {
  by: "artist",
  on: "album",
  via: "label",
};

/**
 * Matches a trigger word that is a standalone token — preceded by start-of-
 * string or whitespace and *followed by whitespace*. The trailing-whitespace
 * requirement is deliberate: it stops "on" from being recognized while the DJ
 * is mid-typing "only", and stops a just-typed trailing "by" (no space yet)
 * from flickering into a trigger before the DJ commits the word.
 */
const TRIGGER_RE = /(?<=^|\s)(by|on|via)(?=\s)/gi;

type Candidate = {
  start: number;
  end: number;
  field: SmartField;
};

/** All standalone trigger-word start offsets in `text` (ignores suppression). */
export function findTriggerOffsets(text: string): number[] {
  return [...text.matchAll(TRIGGER_RE)].map((m) => m.index ?? 0);
}

const isWhitespace = (ch: string): boolean => /\s/.test(ch);

/** Trim leading/trailing whitespace from a raw slice, returning value offsets. */
function trimmedSpan(
  raw: string,
  start: number,
  end: number
): { start: number; end: number } | null {
  let s = start;
  let e = end;
  while (s < e && isWhitespace(raw[s])) s++;
  while (e > s && isWhitespace(raw[e - 1])) e--;
  return s < e ? { start: s, end: e } : null;
}

/** Find trigger-word candidates in `raw`, minus suppressed offsets. */
function findCandidates(
  raw: string,
  suppressed: ReadonlySet<number>
): Candidate[] {
  const out: Candidate[] = [];
  for (const match of raw.matchAll(TRIGGER_RE)) {
    const start = match.index ?? 0;
    if (suppressed.has(start)) continue;
    const word = match[1].toLowerCase();
    out.push({ start, end: start + match[1].length, field: TRIGGERS[word] });
  }
  return out;
}

/**
 * Parse the composer's raw text into recognized field spans + values using the
 * trigger-word grammar: `Vitamin C by Can on Ege Bamyasi via United Artists`.
 * Partial input is supported at every stage.
 *
 * Leading text (before the first effective trigger) is the song. First
 * assignment wins: a trigger for an already-claimed field is demoted to literal
 * text and merges into the preceding field's value. Suppressed triggers are
 * literal.
 *
 * Pure and synchronous — no React, no Redux. `spans`/offsets address `raw`
 * directly so the mirror layer can highlight inline.
 */
export function parseSmartEntry(
  raw: string,
  options: ParseOptions = {}
): ParseResult {
  const suppressed = new Set(options.suppressedTriggers ?? []);
  const candidates = findCandidates(raw, suppressed);

  const claimed = new Set<SmartField>();
  const spans: FieldSpan[] = [];
  const fieldOrder: SmartField[] = [];
  let pendingTrigger: PendingTrigger | undefined;

  // Leading text spans from the start to the first candidate trigger.
  const firstCandStart = candidates.length ? candidates[0].start : raw.length;
  const leading = trimmedSpan(raw, 0, firstCandStart);
  if (leading) {
    claimed.add("song");
    fieldOrder.push("song");
    spans.push({ ...leading, field: "song", source: "detected" });
  }

  // First-wins: keep only triggers that claim a not-yet-claimed field.
  const effective = candidates.filter((c) => {
    if (claimed.has(c.field)) return false;
    claimed.add(c.field);
    return true;
  });

  for (let i = 0; i < effective.length; i++) {
    const trig = effective[i];
    const valueEnd =
      i + 1 < effective.length ? effective[i + 1].start : raw.length;
    const value = trimmedSpan(raw, trig.end, valueEnd);
    if (value) {
      fieldOrder.push(trig.field);
      spans.push({
        ...value,
        field: trig.field,
        triggerStart: trig.start,
        triggerEnd: trig.end,
        source: "detected",
      });
    } else if (i === effective.length - 1) {
      // Trailing trigger with no value yet → the field is awaiting input.
      pendingTrigger = { field: trig.field, start: trig.start, end: trig.end };
    }
  }

  const fields: Partial<Record<SmartField, string>> = {};
  for (const span of spans) {
    fields[span.field] = raw.slice(span.start, span.end);
  }

  return { spans, fields, fieldOrder, pendingTrigger };
}
