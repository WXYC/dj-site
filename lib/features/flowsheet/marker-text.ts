import {
  FlowsheetBreakpointEntry,
  FlowsheetEntry,
  FlowsheetMessageEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSpotlightEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetTalksetEntry,
} from "@/lib/features/flowsheet/types";
import { whosOnRoleText } from "@/lib/features/flowsheet/whos-on-copy";

export type MarkerText = {
  // DJ name for the show markers, message text otherwise.
  headline: string;
  // Tertiary suffix ("started the set" / "ended the set" / "live in the
  // studio"), markers only.
  caption?: string;
};

// The single source of the message-row text switch, shared by the row
// renderers (via getMessageEntryPresentation) and the classic schedule
// drill-in (via messageEntryLabel) so the two can't drift. Modern picks the
// row's icon and tones with its own switch in getMessageEntryPresentation,
// which must classify a row the same way, or a row's text and icon name
// different kinds.
export function getMarkerText(entry: FlowsheetEntry): MarkerText {
  if (isFlowsheetStartShowEntry(entry)) {
    return { headline: entry.dj_name, caption: "started the set" };
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return { headline: entry.dj_name, caption: "ended the set" };
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return { headline: (entry as FlowsheetMessageEntry).message };
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return { headline: (entry as FlowsheetBreakpointEntry).message };
  }

  // A role this build does not know keeps the server's message as the headline.
  if (isFlowsheetSpotlightEntry(entry)) {
    const caption = whosOnRoleText(entry.spotlight_role);
    return caption === undefined
      ? { headline: entry.message }
      : { headline: entry.spotlight_name, caption };
  }

  // Callers only reach here for message-shaped entries (they route song
  // entries away before consulting the text switch), but the guards above
  // don't narrow the union enough for TS to know that.
  return { headline: (entry as unknown as FlowsheetMessageEntry).message };
}

/**
 * A message row's copy as one line, e.g. "DJ Chowder started the set".
 *
 * For surfaces that render the marker as text rather than as a row — the
 * classic schedule drill-in — so they read the same switch as the row
 * renderers instead of keeping a third copy of it.
 */
export function messageEntryLabel(entry: FlowsheetEntry): string {
  const { headline, caption } = getMarkerText(entry);
  return caption ? `${headline} ${caption}` : headline;
}
