import { describe, expect, it } from "vitest";
import type { ReviewPatch } from "@wxyc/shared";
import { patchChanged, toFieldPatch, type FieldValues } from "@/src/components/experiences/modern/reviews/SlipFields";

const LOADED: FieldValues = { buzzwords: "", review: "Warm.", recommended_tracks: "", fcc: "" };
const CONSENT = { publish_website: false, publish_apps: false, publish_instagram: false, credit: null };
const patch = (values: FieldValues, consent = CONSENT): ReviewPatch => ({ ...toFieldPatch(values), ...consent });

describe("patchChanged", () => {
  it.each<[string, ReviewPatch, ReviewPatch, boolean]>([
    ["unchanged", patch(LOADED), patch(LOADED), false],
    ["a field edited", patch(LOADED), patch({ ...LOADED, review: "Warm and slow." }), true],
    ["edited then restored", patch(LOADED), patch({ ...{ ...LOADED, review: "Warm and slow." }, review: LOADED.review }), false],
    ["whitespace typed into an empty field", patch(LOADED), patch({ ...LOADED, buzzwords: "  \n" }), false],
    ["whitespace added to a filled field", patch(LOADED), patch({ ...LOADED, review: "Warm. " }), true],
    ["a consent box ticked", patch(LOADED), patch(LOADED, { ...CONSENT, publish_website: true }), true],
    ["no consent in either patch (not the author)", toFieldPatch(LOADED), toFieldPatch(LOADED), false],
    ["after a save, going back to the loaded text is a change", patch({ ...LOADED, review: "Warm and slow." }), patch(LOADED), true],
  ])("%s", (_name, saved, current, expected) => {
    expect(patchChanged(saved, current)).toBe(expected);
  });
});
