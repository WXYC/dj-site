import type { Capability } from "@wxyc/shared/auth-client";
import type { AdminRoleTone } from "@/lib/features/experiences/modern/tokens/roles";
import { Edit, Language, RateReview, type SvgIconComponent } from "@mui/icons-material";

export type CapabilityPresentation = {
  label: string;
  Icon: SvgIconComponent;
  tone: AdminRoleTone;
  grantTooltip: string;
  removeTooltip: string;
  /** `holds` is whether the account has the capability before the toggle. */
  confirm: (name: string, holds: boolean) => string;
  toast: (name: string, holds: boolean) => string;
};

/** Exhaustive over `Capability`: a value added to or removed from
 * `@wxyc/shared` is a compile error here until its entry follows. */
export type CapabilityPresentationMap = Record<Capability, CapabilityPresentation>;

// editor and webmaster share one sentence shape; reviews_beta words its own.
const capabilityCopy = (
  capability: "editor" | "webmaster",
  label: string,
  grantHint: string,
  Icon: SvgIconComponent,
): CapabilityPresentation => ({
  label,
  Icon,
  tone: capability,
  grantTooltip: `Grant ${capability} capability (${grantHint})`,
  removeTooltip: `Remove ${capability} capability`,
  confirm: (name, holds) =>
    `Are you sure you want to ${holds ? "remove" : "grant"} the "${capability}" capability ${holds ? "from" : "to"} ${name}?`,
  toast: (name, holds) => `${capability} capability ${holds ? "removed from" : "granted to"} ${name}`,
});

export const CAPABILITY_PRESENTATION: CapabilityPresentationMap = {
  editor: capabilityCopy("editor", "Editor", "allows website editing", Edit),
  webmaster: capabilityCopy("webmaster", "Webmaster", "can delegate editor", Language),
  reviews_beta: {
    label: "Reviews beta",
    Icon: RateReview,
    tone: "reviewsBeta",
    grantTooltip: "Grant reviews beta (shows this DJ the review screens before they open to every DJ)",
    removeTooltip: "Remove reviews beta",
    confirm: (name, holds) => `Are you sure you want to ${holds ? "remove reviews beta from" : "grant reviews beta to"} ${name}?`,
    toast: (name, holds) => `Reviews beta ${holds ? "removed from" : "granted to"} ${name}`,
  },
};
