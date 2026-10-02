import { describe, it, expect } from "vitest";
import { getMessageEntryPresentation } from "@/src/components/experiences/modern/flowsheet/Entries/entryPresentation";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import {
  createTestV2TalksetEntry,
  createTestV2MessageEntry,
} from "@/tests/fixtures/fixtures";
import { Mic, Notifications } from "@mui/icons-material";

describe("getMessageEntryPresentation classifies by entry_type, not message text", () => {
  it("gives the tubafrenzy-mirrored talkset the talkset presentation, even though its message is the legacy column's uppercase spelling", () => {
    const entry = convertV2Entry(createTestV2TalksetEntry({ message: "TALKSET" }));
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
