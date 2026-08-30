import type { FlowsheetRangeEntry } from "@wxyc/shared";

/**
 * Display line for an entry the schedule panel does not render as a track.
 *
 * `show_start` and `show_end` carry no `message` at all — they name the DJ in
 * `dj_name` — so a `message ?? entry_type` fallback prints the wire token
 * "show_start" into the panel, and every drill-in opens and closes with one.
 * The wording follows the flowsheet's own markers so a DJ reading a show here
 * and in the flowsheet sees a single vocabulary.
 */
export function describeNonTrackEntry(entry: FlowsheetRangeEntry): string {
  const who = entry.dj_name?.trim();
  const message = entry.message?.trim();

  switch (entry.entry_type) {
    case "show_start":
      return who ? `${who} started the set` : "Start of set";
    case "show_end":
      return who ? `${who} ended the set` : "End of set";
    case "dj_join":
      return who ? `${who} joined the set` : "A DJ joined the set";
    case "dj_leave":
      return who ? `${who} left the set` : "A DJ left the set";
    case "talkset":
      return message || "Talkset";
    case "breakpoint":
      return message || "Breakpoint";
    default:
      // A message row with nothing in it renders as its timestamp alone, which
      // is at least true. Naming the type here is how the tokens got out.
      return message ?? "";
  }
}
