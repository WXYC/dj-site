import type { Rotation } from "@/lib/features/rotation/types";
import "@/src/styles/classic/capsules.css";

export type CapsuleVariant = "request" | "rotation" | "exclusive";

export function Capsule({
  variant,
  label,
}: {
  variant: CapsuleVariant;
  label: string;
}) {
  return (
    <span className={`classic-capsule classic-capsule--${variant}`}>
      {label}
    </span>
  );
}

type CapsuleSpec = { variant: CapsuleVariant; label: string };

// Minimal shape needed to compute capsules — kept structural so live flowsheet
// song entries and archived-show playcuts (and any future row type that
// carries the same flags) can share `capsulesForSongEntry`. `rotation` is the
// live feed's own field name; the V2 wire calls the same value `rotation_bin`,
// and callers reading that shape map it here rather than renaming either side.
export type Capsulable = {
  request_flag?: boolean;
  rotation?: Rotation | null;
  on_streaming?: boolean;
};

// Capsules render ROTATION → REQUEST → EXCLUSIVE, the order tubafrenzy's
// `flowsheetRadioShowDisplayPublic.jsp` prints them in. The modify screen
// (`flowsheetRadioShowModify.jsp`) leads with REQUEST instead; that is a
// different screen, and this is the one a listener reads.
//
// `on_streaming` is three-state. Null — no linked library row — says nothing
// about streaming availability, so only an explicit `false` earns EXCLUSIVE.
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
  if (entry.on_streaming === false) {
    out.push({ variant: "exclusive", label: "EXCLUSIVE" });
  }
  return out;
}
