import type { Rotation } from "@/lib/features/rotation/types";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
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

// Capsules render in priority order: REQUEST → ROTATION → EXCLUSIVE.
// Mirrors tubafrenzy's `flowsheetRadioShowModify.jsp` capsule ordering.
export function capsulesForSongEntry(entry: FlowsheetSongEntry): CapsuleSpec[] {
  const out: CapsuleSpec[] = [];
  if (entry.request_flag) {
    out.push({ variant: "request", label: "REQUEST" });
  }
  if (entry.rotation) {
    out.push({
      variant: "rotation",
      label: `ROTATION ${entry.rotation as Rotation}`,
    });
  }
  if (entry.on_streaming === false) {
    out.push({ variant: "exclusive", label: "EXCLUSIVE" });
  }
  return out;
}
