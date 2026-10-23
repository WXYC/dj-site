import { ENTRY_TONES } from "@/lib/features/experiences/modern/tokens/roles";
import { getMarkerText } from "@/lib/features/flowsheet/marker-text";
import {
  FlowsheetEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSpotlightEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetTalksetEntry,
} from "@/lib/features/flowsheet/types";
import {
  Album,
  Headphones,
  Logout,
  MenuBook,
  Mic,
  MusicNote,
  Notifications,
  Person,
  RecordVoiceOver,
  Timer,
} from "@mui/icons-material";
import type { ColorPaletteProp } from "@mui/joy";
import type { SpotlightRole } from "@wxyc/shared";

// Keyed by the contract's role union, so a role added upstream fails `tsc`
// here until it has an icon.
const WHOS_ON_ICONS: Record<SpotlightRole, typeof Headphones> = {
  performer: MusicNote,
  reader: MenuBook,
  dj: Album,
  guest: Person,
  host: RecordVoiceOver,
};

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

// The message-row icon and tone switch, shared by the desktop table renderer
// (Entry → MessageEntry) and the mobile card renderer (MobileEntry) so the two
// can't drift. The copy comes from getMarkerText, a separate switch that must
// classify a row the same way, or a row's text and icon name different kinds.
// Tones come from the semantic role map (Layer B), not hardcoded palette names.
export function getMessageEntryPresentation(
  entry: FlowsheetEntry
): MessageEntryPresentation {
  const { headline, caption } = getMarkerText(entry);

  if (isFlowsheetStartShowEntry(entry)) {
    return {
      Icon: Headphones,
      color: ENTRY_TONES.startShow.color,
      textColor: ENTRY_TONES.startShow.color,
      headline,
      caption,
      time: { day: entry.day, time: entry.time, isToday: entry.isToday },
      editable: false,
    };
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return {
      Icon: Logout,
      color: ENTRY_TONES.endShow.color,
      textColor: ENTRY_TONES.endShow.color,
      headline,
      caption,
      time: { day: entry.day, time: entry.time, isToday: entry.isToday },
      editable: false,
    };
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return {
      Icon: Mic,
      color: ENTRY_TONES.talkset.color,
      textColor: ENTRY_TONES.talkset.color,
      headline,
      editable: true,
    };
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return {
      Icon: Timer,
      color: ENTRY_TONES.breakpoint.color,
      textColor: ENTRY_TONES.breakpoint.color,
      headline,
      editable: true,
    };
  }

  if (isFlowsheetSpotlightEntry(entry)) {
    return {
      // A role this build does not know has no icon of its own.
      Icon: WHOS_ON_ICONS[entry.spotlight_role] ?? Person,
      color: ENTRY_TONES.whosOn.color,
      textColor: ENTRY_TONES.whosOn.color,
      headline,
      caption,
      editable: true,
    };
  }

  return {
    Icon: Notifications,
    color: ENTRY_TONES.generic.color,
    textColor: ENTRY_TONES.generic.color,
    headline,
    editable: true,
  };
}
