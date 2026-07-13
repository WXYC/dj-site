import type { FlowsheetSearchProperty } from "@/lib/features/flowsheet/types";

/**
 * The four semantic fields the smart-entry composer parses text into. This is
 * the subset of `FlowsheetSearchProperty` the parser owns — it deliberately
 * excludes `track_position`, which is a structural artifact of picking a track
 * off a linked release, never something the DJ types as free text.
 */
export type SmartField = "song" | "artist" | "album" | "label";

/** Compile-time guarantee that SmartField stays a subset of the query keys. */
const _smartFieldIsSearchProperty: Record<SmartField, FlowsheetSearchProperty> =
  {
    song: "song",
    artist: "artist",
    album: "album",
    label: "label",
  };
void _smartFieldIsSearchProperty;

/**
 * Where a span's field assignment came from. The parser only ever emits
 * `"detected"` (passively recognized from a trigger word or leading position).
 * The stateful hook promotes a span to `"locked"` when the DJ accepts ghost
 * text or otherwise commits the field as a hard search constraint.
 */
export type SpanSource = "detected" | "locked";

/**
 * A recognized field value within the raw input, addressed by character
 * offsets so the composer's mirror layer can highlight exactly the value text
 * (trigger words excluded) inline.
 */
export type FieldSpan = {
  field: SmartField;
  /** Value start offset into raw (inclusive), trigger word excluded. */
  start: number;
  /** Value end offset into raw (exclusive). */
  end: number;
  /** Trigger word start offset, when this span was introduced by a trigger. */
  triggerStart?: number;
  /** Trigger word end offset (exclusive). */
  triggerEnd?: number;
  source: SpanSource;
};

/**
 * A trigger word that has claimed a field but has no value text yet (e.g. the
 * caret sits right after "by "). The composer dims the trigger word and treats
 * its field as the active one awaiting input.
 */
export type PendingTrigger = {
  field: SmartField;
  /** Trigger word start offset. */
  start: number;
  /** Trigger word end offset (exclusive). */
  end: number;
};

export type ParseResult = {
  /** Value spans, ordered by `start`. */
  spans: FieldSpan[];
  /** Trimmed field values keyed by field; absent fields are simply omitted. */
  fields: Partial<Record<SmartField, string>>;
  /** Fields in the order the user introduced them — drives sentence ordering. */
  fieldOrder: SmartField[];
  pendingTrigger?: PendingTrigger;
};

export type ParseOptions = {
  /**
   * Start offsets (into raw) of trigger words the user has escaped to literal
   * text. A suppressed trigger is parsed as ordinary value text.
   */
  suppressedTriggers?: number[];
};
