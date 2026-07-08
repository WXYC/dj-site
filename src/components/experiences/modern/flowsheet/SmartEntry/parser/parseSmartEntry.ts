import type {
  FieldSpan,
  ParseOptions,
  ParseResult,
  PendingTrigger,
  SmartField,
} from "./types";

/**
 * Trigger words → the field the text after them fills. `off` marks a track
 * title (rarely needed — leading text is the song by default); `by` the artist;
 * `on`/`in`/`from` the album; `via`/`with` the label.
 */
const TRIGGERS: Readonly<Record<string, SmartField>> = {
  off: "song",
  by: "artist",
  on: "album",
  in: "album",
  from: "album",
  via: "label",
  with: "label",
};

/** Default field order for semicolon-separated segments. */
const DEFAULT_ORDER: readonly SmartField[] = ["song", "artist", "album", "label"];

/**
 * Matches a trigger word that is a standalone token — preceded by start-of-
 * string or whitespace and *followed by whitespace*. The trailing-whitespace
 * requirement is deliberate: it stops "on" from being recognized while the DJ
 * is mid-typing "only", and stops a just-typed trailing "by" (no space yet)
 * from flickering into a trigger before the DJ commits the word.
 */
const TRIGGER_RE = /(?<=^|\s)(off|by|on|in|from|via|with)(?=\s)/gi;

type Candidate = {
  start: number;
  end: number;
  field: SmartField;
};

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

/** Find trigger-word candidates within [rangeStart, rangeEnd), minus suppressed. */
function findCandidates(
  raw: string,
  rangeStart: number,
  rangeEnd: number,
  suppressed: ReadonlySet<number>
): Candidate[] {
  const slice = raw.slice(rangeStart, rangeEnd);
  const out: Candidate[] = [];
  for (const match of slice.matchAll(TRIGGER_RE)) {
    const start = rangeStart + (match.index ?? 0);
    if (suppressed.has(start)) continue;
    const word = match[1].toLowerCase();
    out.push({ start, end: start + match[1].length, field: TRIGGERS[word] });
  }
  return out;
}

type RangeParse = {
  spans: FieldSpan[];
  fieldOrder: SmartField[];
  claimed: Set<SmartField>;
  pendingTrigger?: PendingTrigger;
};

/**
 * Parse trigger-word grammar within [rangeStart, rangeEnd) of raw. Leading text
 * (before the first effective trigger) is the song. First assignment wins: a
 * trigger for an already-claimed field is demoted to literal text and merges
 * into the preceding field's value. Suppressed triggers are literal.
 *
 * `alreadyClaimed` lets a caller (semicolon mode) pre-claim fields so the first
 * segment's leading text doesn't re-fill an occupied field.
 */
function parseRange(
  raw: string,
  rangeStart: number,
  rangeEnd: number,
  suppressed: ReadonlySet<number>,
  alreadyClaimed: ReadonlySet<SmartField>
): RangeParse {
  const candidates = findCandidates(raw, rangeStart, rangeEnd, suppressed);
  const claimed = new Set<SmartField>(alreadyClaimed);
  const spans: FieldSpan[] = [];
  const fieldOrder: SmartField[] = [];
  let pendingTrigger: PendingTrigger | undefined;

  // Leading text spans from the range start to the first candidate trigger.
  const firstCandStart = candidates.length ? candidates[0].start : rangeEnd;
  const leading = trimmedSpan(raw, rangeStart, firstCandStart);
  if (leading && !claimed.has("song")) {
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
      i + 1 < effective.length ? effective[i + 1].start : rangeEnd;
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

  return { spans, fieldOrder, claimed, pendingTrigger };
}

/** Split raw into [start, end) segment ranges on ";" (delimiters excluded). */
function splitSemicolonRanges(raw: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (let i = 0; i <= raw.length; i++) {
    if (i === raw.length || raw[i] === ";") {
      ranges.push({ start, end: i });
      start = i + 1;
    }
  }
  return ranges;
}

function toFields(spans: FieldSpan[], raw: string): Partial<Record<SmartField, string>> {
  const fields: Partial<Record<SmartField, string>> = {};
  for (const span of spans) {
    fields[span.field] = raw.slice(span.start, span.end);
  }
  return fields;
}

/**
 * Parse the composer's raw text into recognized field spans + values.
 *
 * Two equivalent input styles, both supporting partial input:
 *   - Trigger words: `Vitamin C by Can on Ege Bamyasi via United Artists`
 *   - Semicolon default order: `Track; Artist; Album; Label`
 *
 * In semicolon mode the first segment is parsed with the full trigger grammar,
 * and each subsequent segment fills the next unclaimed field in default order
 * (song → artist → album → label); trigger words in later segments are literal.
 *
 * Pure and synchronous — no React, no Redux. `spans`/offsets address `raw`
 * directly so the mirror layer can highlight inline.
 */
export function parseSmartEntry(
  raw: string,
  options: ParseOptions = {}
): ParseResult {
  const suppressed = new Set(options.suppressedTriggers ?? []);

  if (!raw.includes(";")) {
    const parsed = parseRange(raw, 0, raw.length, suppressed, new Set());
    return {
      mode: "trigger",
      spans: parsed.spans,
      fields: toFields(parsed.spans, raw),
      fieldOrder: parsed.fieldOrder,
      pendingTrigger: parsed.pendingTrigger,
    };
  }

  const ranges = splitSemicolonRanges(raw);
  const [first, ...rest] = ranges;

  // Segment 0: full trigger grammar.
  const seg0 = parseRange(raw, first.start, first.end, suppressed, new Set());
  const spans = [...seg0.spans];
  const fieldOrder = [...seg0.fieldOrder];
  const claimed = seg0.claimed;

  // Remaining segments: fill the next unclaimed default-order field.
  let orderIdx = 0;
  const nextUnclaimed = (): SmartField | undefined => {
    while (orderIdx < DEFAULT_ORDER.length) {
      const field = DEFAULT_ORDER[orderIdx++];
      if (!claimed.has(field)) return field;
    }
    return undefined;
  };

  for (const range of rest) {
    const value = trimmedSpan(raw, range.start, range.end);
    if (!value) continue; // empty segment (e.g. trailing ";") — skip, keep order
    const field = nextUnclaimed();
    if (!field) break; // all four fields filled; extra segments ignored
    claimed.add(field);
    fieldOrder.push(field);
    spans.push({ ...value, field, source: "detected" });
  }

  spans.sort((a, b) => a.start - b.start);

  return {
    mode: "semicolon",
    spans,
    fields: toFields(spans, raw),
    fieldOrder,
    pendingTrigger: seg0.pendingTrigger,
  };
}
