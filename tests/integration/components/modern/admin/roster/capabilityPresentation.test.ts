import { describe, it, expect } from "vitest";
import { CAPABILITIES, type Capability } from "@wxyc/shared/auth-client";
import { ADMIN_TONES } from "@/lib/features/experiences/modern/tokens/roles";
import {
  CAPABILITY_PRESENTATION,
  type CapabilityPresentationMap,
  type CapabilityPresentation,
} from "@/src/components/experiences/modern/admin/roster/capabilityPresentation";

const NAME = "Juana Molina";

// [capability, account holds it, tooltip, confirm, toast]
const COPY: [Capability, boolean, string, string, string][] = [
  [
    "editor",
    false,
    "Grant editor capability (allows website editing)",
    `Are you sure you want to grant the "editor" capability to ${NAME}?`,
    `editor capability granted to ${NAME}`,
  ],
  [
    "editor",
    true,
    "Remove editor capability",
    `Are you sure you want to remove the "editor" capability from ${NAME}?`,
    `editor capability removed from ${NAME}`,
  ],
  [
    "webmaster",
    false,
    "Grant webmaster capability (can delegate editor)",
    `Are you sure you want to grant the "webmaster" capability to ${NAME}?`,
    `webmaster capability granted to ${NAME}`,
  ],
  [
    "webmaster",
    true,
    "Remove webmaster capability",
    `Are you sure you want to remove the "webmaster" capability from ${NAME}?`,
    `webmaster capability removed from ${NAME}`,
  ],
  [
    "reviews_beta",
    false,
    "Grant reviews beta (shows this DJ the review screens before they open to every DJ)",
    `Are you sure you want to grant reviews beta to ${NAME}?`,
    `Reviews beta granted to ${NAME}`,
  ],
  [
    "reviews_beta",
    true,
    "Remove reviews beta",
    `Are you sure you want to remove reviews beta from ${NAME}?`,
    `Reviews beta removed from ${NAME}`,
  ],
];

describe("CAPABILITY_PRESENTATION copy", () => {
  it.each(COPY)("%s (holds=%s) reads as it does in the product", (capability, holds, tooltip, confirm, toast) => {
    const entry = CAPABILITY_PRESENTATION[capability];

    expect(holds ? entry.removeTooltip : entry.grantTooltip).toBe(tooltip);
    expect(entry.confirm(NAME, holds)).toBe(confirm);
    expect(entry.toast(NAME, holds)).toBe(toast);
  });

  it.each([
    ["editor", "Editor"],
    ["webmaster", "Webmaster"],
    ["reviews_beta", "Reviews beta"],
  ] as [Capability, string][])("labels %s as %s", (capability, label) => {
    expect(CAPABILITY_PRESENTATION[capability].label).toBe(label);
  });

  // The tone keys are distinct by construction; what a manager tells apart is
  // the color and variant they resolve to.
  it("gives every capability a badge that looks different", () => {
    const looks = CAPABILITIES.map((c) => {
      const { color, variant } = ADMIN_TONES[CAPABILITY_PRESENTATION[c].tone];
      return `${color}/${variant}`;
    });

    expect(new Set(looks).size).toBe(CAPABILITIES.length);
  });
});

describe("CapabilityPresentationMap coverage", () => {
  it("has exactly one entry per capability in @wxyc/shared", () => {
    expect(Object.keys(CAPABILITY_PRESENTATION).sort()).toEqual([...CAPABILITIES].sort());
  });

  it("rejects, at compile time, a map that omits a capability", () => {
    const entry = CAPABILITY_PRESENTATION.editor;
    // @ts-expect-error reviews_beta and webmaster are missing
    const incomplete: CapabilityPresentationMap = { editor: entry };

    expect(incomplete).toBeDefined();
  });

  it("rejects, at compile time, an entry for a value @wxyc/shared does not list", () => {
    const entry: CapabilityPresentation = CAPABILITY_PRESENTATION.editor;
    const extra: CapabilityPresentationMap = {
      ...CAPABILITY_PRESENTATION,
      // @ts-expect-error not a Capability
      crm_merge: entry,
    };

    expect(extra).toBeDefined();
  });
});
