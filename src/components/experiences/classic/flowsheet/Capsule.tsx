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

// Minimal shape needed to compute capsules — kept structural so flowsheet
// song entries and playlist-archive search results (and any future row
// type that carries the same flags) can share `capsulesForSongEntry`.
export type Capsulable = {
  request_flag?: boolean;
  rotation?: Rotation | null;
  on_streaming?: boolean;
};

// Capsules render in priority order: REQUEST → ROTATION → EXCLUSIVE.
// Mirrors tubafrenzy's `flowsheetRadioShowModify.jsp` capsule ordering.
export function capsulesForSongEntry(entry: Capsulable): CapsuleSpec[] {
  const out: CapsuleSpec[] = [];
  if (entry.request_flag) {
    out.push({ variant: "request", label: "REQUEST" });
  }
  if (entry.rotation) {
    out.push({
      variant: "rotation",
      label: `ROTATION ${entry.rotation}`,
    });
  }
  if (entry.on_streaming === false) {
    out.push({ variant: "exclusive", label: "EXCLUSIVE" });
  }
  return out;
}
