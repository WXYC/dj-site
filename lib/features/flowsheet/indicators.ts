import type { Rotation } from "../rotation/types";

export type CapsuleVariant = "request" | "rotation" | "exclusive";

export type CapsuleSpec = { variant: CapsuleVariant; label: string };

// Minimal shape needed to compute capsules — structural so any row type
// carrying these flags can use it. `rotation` is the live feed's own field
// name; the V2 wire calls the same value `rotation_bin`, and a caller reading
// that shape maps it at the call site rather than either name moving.
export type Capsulable = {
  request_flag?: boolean;
  rotation?: Rotation | null;
  on_streaming?: boolean | null;
};

// `on_streaming` is three-state. Null — no linked library row — says nothing
// about streaming availability, so only an explicit `false` earns EXCLUSIVE.
export function isExclusive(entry: Pick<Capsulable, "on_streaming">): boolean {
  return entry.on_streaming === false;
}

// Capsules render ROTATION → REQUEST → EXCLUSIVE, the order tubafrenzy's
// `flowsheetRadioShowDisplayPublic.jsp` prints them in. The modify screen
// (`flowsheetRadioShowModify.jsp`) leads with REQUEST instead; that is a
// different screen, and the display one is what this reproduces. This is
// classic's own resolver — a caller wanting a different order or wording
// (modern's live flowsheet chips) reads `isExclusive` directly instead.
export function capsulesForSongEntry(entry: Capsulable): CapsuleSpec[] {
  const out: CapsuleSpec[] = [];
  if (entry.rotation) {
    out.push({
      variant: "rotation",
      label: `ROTATION ${entry.rotation}`,
    });
  }
  if (entry.request_flag) {
    out.push({ variant: "request", label: "REQUEST" });
  }
  if (isExclusive(entry)) {
    out.push({ variant: "exclusive", label: "EXCLUSIVE" });
  }
  return out;
}
