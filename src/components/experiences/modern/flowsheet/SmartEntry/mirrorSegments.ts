import type { FieldSpan, PendingTrigger, SmartField } from "./parser/types";

export type MirrorSegmentKind = "plain" | "trigger" | "token";

export type MirrorSegment = {
  text: string;
  kind: MirrorSegmentKind;
  /** Present for `token` segments — which field the highlighted value is. */
  field?: SmartField;
  /** Present for `token` segments — whether the value is a locked constraint. */
  locked?: boolean;
};

type Mark = {
  start: number;
  end: number;
  kind: "trigger" | "token";
  field?: SmartField;
  locked?: boolean;
};

/**
 * Decompose `raw` into a gap-free, non-overlapping sequence of segments the
 * mirror layer renders behind the transparent textarea: plain text, dimmed
 * trigger words, and highlighted field-value tokens. Concatenating every
 * segment's text reproduces `raw` exactly — the invariant that keeps the mirror
 * glyph-aligned with the textarea caret.
 */
export function buildMirrorSegments(
  raw: string,
  spans: FieldSpan[],
  pendingTrigger?: PendingTrigger
): MirrorSegment[] {
  const marks: Mark[] = [];
  for (const span of spans) {
    if (span.triggerStart !== undefined && span.triggerEnd !== undefined) {
      marks.push({
        start: span.triggerStart,
        end: span.triggerEnd,
        kind: "trigger",
      });
    }
    marks.push({
      start: span.start,
      end: span.end,
      kind: "token",
      field: span.field,
      locked: span.source === "locked",
    });
  }
  if (pendingTrigger) {
    marks.push({
      start: pendingTrigger.start,
      end: pendingTrigger.end,
      kind: "trigger",
    });
  }

  marks.sort((a, b) => a.start - b.start);

  const segments: MirrorSegment[] = [];
  let cursor = 0;
  const pushPlain = (text: string) => {
    if (text.length > 0) segments.push({ text, kind: "plain" });
  };

  for (const mark of marks) {
    if (mark.start < cursor) continue; // defensive: skip any overlap
    pushPlain(raw.slice(cursor, mark.start));
    segments.push({
      text: raw.slice(mark.start, mark.end),
      kind: mark.kind,
      field: mark.field,
      locked: mark.locked,
    });
    cursor = mark.end;
  }
  pushPlain(raw.slice(cursor));

  return segments;
}
