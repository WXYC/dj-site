import { ENTRY_TONES } from "@/lib/features/experiences/modern/tokens/roles";
import {
  FlowsheetBreakpointEntry,
  FlowsheetEntry,
  FlowsheetMessageEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetTalksetEntry,
} from "@/lib/features/flowsheet/types";
import {
  Headphones,
  Logout,
  Mic,
  Notifications,
  Timer,
} from "@mui/icons-material";
import type { ColorPaletteProp } from "@mui/joy";

export type MessageEntryPresentation = {
  Icon: typeof Headphones;
  // Container (Sheet/row) tone.
  color: ColorPaletteProp;
  // Headline text tone. Sourced from the same ENTRY_TONES role as the
  // container so the two can't contradict (the old end-show marker mixed a
  // success container with primary text).
  textColor: ColorPaletteProp;
  // DJ name for the show markers, message text otherwise.
  headline: string;
  // Tertiary suffix ("started the set" / "ended the set"), markers only.
  caption?: string;
  // Show markers carry their day/time; other messages don't.
  time?: { day: string; time: string; isToday?: boolean };
  // Show markers can't be edited or removed.
  editable: boolean;
};

// The single source of the message-row type switch (icon, tones, copy),
// shared by the desktop table renderer (Entry → MessageEntry) and the
// mobile card renderer (MobileEntry) so the two can't drift. Tones come
// from the semantic role map (Layer B), not hardcoded palette names.
export function getMessageEntryPresentation(
  entry: FlowsheetEntry
): MessageEntryPresentation {
  if (isFlowsheetStartShowEntry(entry)) {
    return {
      Icon: Headphones,
      color: ENTRY_TONES.startShow.color,
      textColor: ENTRY_TONES.startShow.color,
      headline: entry.dj_name,
      caption: "started the set",
      time: { day: entry.day, time: entry.time, isToday: entry.isToday },
      editable: false,
    };
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return {
      Icon: Logout,
      color: ENTRY_TONES.endShow.color,
      textColor: ENTRY_TONES.endShow.color,
      headline: entry.dj_name,
      caption: "ended the set",
      time: { day: entry.day, time: entry.time, isToday: entry.isToday },
      editable: false,
    };
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return {
      Icon: Mic,
      color: ENTRY_TONES.talkset.color,
      textColor: ENTRY_TONES.talkset.color,
      headline: (entry as FlowsheetMessageEntry).message,
      editable: true,
    };
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return {
      Icon: Timer,
      color: ENTRY_TONES.breakpoint.color,
      textColor: ENTRY_TONES.breakpoint.color,
      headline: (entry as FlowsheetBreakpointEntry).message,
      editable: true,
    };
  }

  return {
    Icon: Notifications,
    color: ENTRY_TONES.generic.color,
    textColor: ENTRY_TONES.generic.color,
    // Callers only reach here for message-shaped entries (they route song
    // entries to SongEntry before consulting the presentation), but the
    // guards above don't narrow the union enough for TS to know that.
    headline: (entry as unknown as FlowsheetMessageEntry).message,
    editable: true,
  };
}
