import { describe, it, expect } from "vitest";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import {
  getMarkerText,
  messageEntryLabel,
  type MarkerText,
} from "@/lib/features/flowsheet/marker-text";
import {
  V2_ENTRY_FACTORIES_BY_TYPE,
} from "@/tests/fixtures/fixtures";

const startShow = convertV2Entry(
  V2_ENTRY_FACTORIES_BY_TYPE.show_start({ dj_name: "DJ Chowder" })
);

type MarkerType = Exclude<FlowsheetEntryType, "track">;

// Keyed by every non-track kind, so a new kind fails `tsc` here until it has
// a case. Track is left out because callers route song entries away before
// they consult the text switch.
const MARKER_CASES = {
  show_start: {
    overrides: { dj_name: "DJ Chowder" },
    expected: { headline: "DJ Chowder", caption: "started the set" },
  },
  show_end: {
    overrides: { dj_name: "DJ Chowder" },
    expected: { headline: "DJ Chowder", caption: "ended the set" },
  },
  dj_join: {
    overrides: { dj_name: "DJ Chowder" },
    expected: { headline: "DJ Chowder", caption: "started the set" },
  },
  dj_leave: {
    overrides: { dj_name: "DJ Chowder" },
    expected: { headline: "DJ Chowder", caption: "ended the set" },
  },
  talkset: {
    overrides: { message: "Talkset" },
    expected: { headline: "Talkset", caption: undefined },
  },
  breakpoint: {
    overrides: { message: "3:00 PM Breakpoint", radio_hour: null },
    expected: { headline: "3:00 PM Breakpoint", caption: undefined },
  },
  message: {
    overrides: { message: "Fund drive pitch" },
    expected: { headline: "Fund drive pitch", caption: undefined },
  },
} satisfies Record<MarkerType, { overrides: object; expected: MarkerText }>;

const markerTypes = Object.values(FlowsheetEntryType).filter(
  (type): type is MarkerType => type !== "track"
);

describe("getMarkerText", () => {
  it.each(markerTypes)("%s", (type) => {
    const { overrides, expected } = MARKER_CASES[type];
    // Built through convertV2Entry so each row has the shape the live sheet
    // hands the switch: dj_join/dj_leave only read as set markers after
    // conversion folds them into the show-marker shape.
    const entry = convertV2Entry(V2_ENTRY_FACTORIES_BY_TYPE[type](overrides));

    expect(getMarkerText(entry)).toEqual(expected);
  });
});

describe("messageEntryLabel", () => {
  it("joins headline and caption when present", () => {
    expect(messageEntryLabel(startShow)).toBe("DJ Chowder started the set");
  });

  it("returns the headline alone when there is no caption", () => {
    const talkset = convertV2Entry(
      V2_ENTRY_FACTORIES_BY_TYPE.talkset({ message: "Talkset" })
    );
    expect(messageEntryLabel(talkset)).toBe("Talkset");
  });
});
