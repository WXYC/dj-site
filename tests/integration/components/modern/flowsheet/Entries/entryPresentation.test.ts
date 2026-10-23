import { describe, it, expect } from "vitest";
import { getMessageEntryPresentation } from "@/src/components/experiences/modern/flowsheet/Entries/entryPresentation";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import { ENTRY_TONES } from "@/lib/features/experiences/modern/tokens/roles";
import { getMarkerText } from "@/lib/features/flowsheet/marker-text";
import {
  createTestV2TalksetEntry,
  createTestV2MessageEntry,
  createTestV2SpotlightEntry,
} from "@/tests/fixtures/fixtures";
import {
  Album,
  MenuBook,
  Mic,
  MusicNote,
  Notifications,
  Person,
  RecordVoiceOver,
} from "@mui/icons-material";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";

describe("getMessageEntryPresentation classifies by entry_type, not message text", () => {
  it("gives a talkset whose text does not say Talkset the talkset presentation", () => {
    const entry: FlowsheetEntry = {
      id: 1,
      play_order: 1,
      show_id: 1,
      entry_type: "talkset",
      message: "TALKSET",
    };
    const presentation = getMessageEntryPresentation(entry);

    expect(presentation.Icon).toBe(Mic);
    expect(presentation.color).toBe("danger");
  });

  it("gives a message-typed entry reading Talkset the generic message presentation", () => {
    const entry = convertV2Entry(createTestV2MessageEntry({ message: "Talkset" }));
    const presentation = getMessageEntryPresentation(entry);

    expect(presentation.Icon).toBe(Notifications);
    expect(presentation.color).toBe("warning");
  });

  // The breakpoint and generic roles share one tone, so the icon is what
  // tells the two presentations apart.
  it("gives a message-typed entry reading like a breakpoint the generic message presentation", () => {
    const entry = convertV2Entry(
      createTestV2MessageEntry({ message: "3:00 PM Breakpoint" })
    );
    const presentation = getMessageEntryPresentation(entry);

    expect(presentation.Icon).toBe(Notifications);
    expect(presentation.headline).toBe("3:00 PM Breakpoint");
  });
});

describe("getMessageEntryPresentation labels a converted talkset", () => {
  it("labels the tubafrenzy-mirrored talkset, stored as the uppercase token, Talkset", () => {
    const entry = convertV2Entry(createTestV2TalksetEntry({ message: "TALKSET" }));

    expect(getMessageEntryPresentation(entry).headline).toBe("Talkset");
  });
});

describe("getMessageEntryPresentation on a who's-on row", () => {
  it.each([
    ["performer", MusicNote, "live in the studio"],
    ["reader", MenuBook, "reading now"],
    ["dj", Album, "mixing"],
    ["guest", Person, "in the studio as a guest"],
    ["host", RecordVoiceOver, "hosting"],
  ] as const)("draws the %s role with its own icon and the neutral soft tone", (spotlight_role, Icon, caption) => {
    const entry = convertV2Entry(
      createTestV2SpotlightEntry({ spotlight_role, spotlight_name: "Porch Static" })
    );
    const presentation = getMessageEntryPresentation(entry);

    expect(presentation).toMatchObject({
      Icon,
      color: "neutral",
      textColor: "neutral",
      headline: "Porch Static",
      caption,
      editable: true,
    });
    expect({ headline: presentation.headline, caption: presentation.caption }).toEqual(
      getMarkerText(entry)
    );
  });

  it("gives the role a tone no other row type uses", () => {
    const { whosOn, ...others } = ENTRY_TONES;

    expect(whosOn).toEqual({ color: "neutral", variant: "soft" });
    expect(Object.values(others).map((tone) => tone.color)).not.toContain("neutral");
  });

  it("classifies by entry_type: a message row reading like a who's-on row stays generic", () => {
    const entry = convertV2Entry(
      createTestV2MessageEntry({ message: "Porch Static live in the studio" })
    );

    expect(getMessageEntryPresentation(entry).Icon).toBe(Notifications);
  });

  it("keeps a row with a role this build does not know a who's-on row, in the server's words", () => {
    const entry = convertV2Entry(
      createTestV2SpotlightEntry({
        spotlight_role: "emcee" as never,
        message: "Emcee: Porch Static",
      })
    );
    const presentation = getMessageEntryPresentation(entry);

    expect(presentation).toMatchObject({ color: "neutral", headline: "Emcee: Porch Static" });
    expect(presentation.Icon).toBe(Person);
  });
});
