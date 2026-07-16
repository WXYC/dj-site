import type { SmartField } from "./parser/types";

export type SentencePart = {
  field: SmartField;
  value: string;
  /** Leading connector word ("by", "on", "via", "off"), or null when omitted. */
  connector: string | null;
};

/** Default field order when the user gave no ordering hint. */
const DEFAULT_ORDER: readonly SmartField[] = ["song", "artist", "album", "label"];

const CONNECTOR: Record<SmartField, string> = {
  song: "off",
  artist: "by",
  album: "on",
  label: "via",
};

/**
 * The leading part drops its connector only when it leads with the "primary
 * noun" (album or song) — "Dots and Loops by Stereolab" reads naturally, but an
 * artist- or label-led sentence keeps its connector ("by Stereolab on …").
 */
const OMIT_LEADING_CONNECTOR: ReadonlySet<SmartField> = new Set<SmartField>([
  "album",
  "song",
]);

/**
 * Arrange a result's field values into an ordered, connector-annotated sentence
 * that follows the order the user typed their query (album-first if they led
 * with the album). Absent/empty values are skipped. Pure — the caller layers
 * inline match-highlighting on each part's value.
 */
export function buildResultSentence(
  values: Partial<Record<SmartField, string>>,
  fieldOrder: SmartField[]
): SentencePart[] {
  const present = (field: SmartField) => (values[field] ?? "").trim() !== "";

  // User-introduced order first, then any remaining present fields in default
  // order, de-duplicated.
  const order: SmartField[] = [];
  const push = (field: SmartField) => {
    if (present(field) && !order.includes(field)) order.push(field);
  };
  fieldOrder.forEach(push);
  DEFAULT_ORDER.forEach(push);

  return order.map((field, i) => ({
    field,
    value: values[field] as string,
    connector:
      i === 0 && OMIT_LEADING_CONNECTOR.has(field) ? null : CONNECTOR[field],
  }));
}
