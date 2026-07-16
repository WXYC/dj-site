import type { ParseResult, SmartField } from "./parser/types";

/**
 * The field the composer is actively editing when the caret sits at the end of
 * the input — the field ghost text is offered for. A trailing trigger awaiting
 * a value wins; otherwise it's the last recognized span's field; empty input
 * defaults to the song (the always-leading field).
 */
export function activeFieldAtEnd(parse: ParseResult): SmartField {
  if (parse.pendingTrigger) return parse.pendingTrigger.field;
  if (parse.spans.length > 0) {
    return parse.spans[parse.spans.length - 1].field;
  }
  return "song";
}
