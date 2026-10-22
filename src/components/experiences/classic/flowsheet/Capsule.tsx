import { Fragment } from "react";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import {
  capsulesForSongEntry,
  type CapsuleVariant,
} from "@/lib/features/flowsheet/indicators";
import "@/src/styles/classic/wxyc.css";

/**
 * A REQUEST / ROTATION / EXCLUSIVE badge, wearing tubafrenzy's own class for
 * the variant rather than a parallel one of ours. The three rules live in
 * `wxyc.css` as part of the verbatim port and are already what the Classic
 * catalog's EXCLUSIVE badge uses, so naming them here is what keeps one badge
 * from looking like two on adjacent screens.
 */
export function Capsule({
  variant,
  label,
}: {
  variant: CapsuleVariant;
  label: string;
}) {
  return <span className={`${variant}-capsule`}>{label}</span>;
}

/** A range row's badges in the JSP's order, as both archive tables print them. */
export function EntryCapsules({ entry }: { entry: FlowsheetRangeEntryWire }) {
  const capsules = capsulesForSongEntry({
    request_flag: entry.request_flag,
    rotation: entry.rotation_bin,
    on_streaming: entry.on_streaming,
  });
  return capsules.map((capsule, position) => (
    <Fragment key={capsule.variant}>
      {/* The gap between adjacent capsules is the space the JSP prints after
          each one; neither badge carries a margin of its own. */}
      {position > 0 ? " " : null}
      <Capsule variant={capsule.variant} label={capsule.label} />
    </Fragment>
  ));
}
