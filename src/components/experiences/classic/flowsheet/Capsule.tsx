import type { CapsuleVariant } from "@/lib/features/flowsheet/indicators";
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
