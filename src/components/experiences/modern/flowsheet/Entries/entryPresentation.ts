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
  // Headline text tone (the end-show marker deliberately contrasts its
  // container).
  textColor: ColorPaletteProp;
  // DJ name for the show markers, message text otherwise.
  headline: string;
  // Tertiary suffix ("started the set" / "ended the set"), markers only.
  caption?: string;
  // Show markers carry their day/time; other messages don't.
  time?: { day: string; time: string };
  // Show markers can't be edited or removed.
  editable: boolean;
};

// The single source of the message-row type switch (icon, tones, copy),
// shared by the desktop table renderer (Entry → MessageEntry) and the
// mobile card renderer (MobileEntry) so the two can't drift.
export function getMessageEntryPresentation(
  entry: FlowsheetEntry
): MessageEntryPresentation {
  if (isFlowsheetStartShowEntry(entry)) {
    return {
      Icon: Headphones,
      color: "success",
      textColor: "success",
      headline: entry.dj_name,
      caption: "started the set",
      time: { day: entry.day, time: entry.time },
      editable: false,
    };
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return {
      Icon: Logout,
      color: "success",
      textColor: "primary",
      headline: entry.dj_name,
      caption: "ended the set",
      time: { day: entry.day, time: entry.time },
      editable: false,
    };
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return {
      Icon: Mic,
      color: "danger",
      textColor: "danger",
      headline: (entry as FlowsheetMessageEntry).message,
      editable: true,
    };
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return {
      Icon: Timer,
      color: "warning",
      textColor: "warning",
      headline: (entry as FlowsheetBreakpointEntry).message,
      editable: true,
    };
  }

  return {
    Icon: Notifications,
    color: "warning",
    textColor: "warning",
    // Callers only reach here for message-shaped entries (they route song
    // entries to SongEntry before consulting the presentation), but the
    // guards above don't narrow the union enough for TS to know that.
    headline: (entry as unknown as FlowsheetMessageEntry).message,
    editable: true,
  };
}
