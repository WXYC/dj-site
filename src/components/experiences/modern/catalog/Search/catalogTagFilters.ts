import type { Rotation } from "@/lib/features/rotation/types";
import { ROTATION_BIN_LABELS } from "@/src/utilities/modern/rotationBinColors";

/** Status / boolean tag filters (not rotation bins). */
export const CATALOG_STATUS_TAG_OPTIONS = ["exclusives", "missing"] as const;

export type CatalogStatusTagId = (typeof CATALOG_STATUS_TAG_OPTIONS)[number];

/** Rotation bin codes stored in `filters.tags` alongside status tags. */
export const CATALOG_ROTATION_TAG_BINS = ["H", "M", "L", "S"] as const;

export type CatalogRotationTagBin = (typeof CATALOG_ROTATION_TAG_BINS)[number];

export const CATALOG_TAG_FILTER_OPTIONS = [
  ...CATALOG_STATUS_TAG_OPTIONS,
  ...CATALOG_ROTATION_TAG_BINS,
] as const;

export type CatalogTagFilterId = (typeof CATALOG_TAG_FILTER_OPTIONS)[number];

const ROTATION_TAG_BIN_SET = new Set<string>(CATALOG_ROTATION_TAG_BINS);

export function isCatalogRotationTag(tagId: string): tagId is CatalogRotationTagBin {
  return ROTATION_TAG_BIN_SET.has(tagId);
}

export function getCatalogTagLabel(tagId: string): string {
  if (tagId === "exclusives") return "Exclusives";
  if (tagId === "missing") return "Missing";
  if (isCatalogRotationTag(tagId)) {
    return `${ROTATION_BIN_LABELS[tagId]} Rotation`;
  }
  return tagId;
}

export function catalogTagsToRotationBins(tags: string[]): Rotation[] {
  return tags.filter(isCatalogRotationTag) as Rotation[];
}

export type CatalogTagQueryFlags = {
  on_streaming?: boolean;
  missing?: boolean;
  rotation_bins?: Rotation[];
};

/** Map selected tag filters to `/library/query` params. */
export function catalogTagsToQueryFlags(tags: string[]): CatalogTagQueryFlags {
  const rotation_bins = catalogTagsToRotationBins(tags);
  return {
    on_streaming: tags.includes("exclusives") ? false : undefined,
    missing: tags.includes("missing") ? true : undefined,
    rotation_bins: rotation_bins.length > 0 ? rotation_bins : undefined,
  };
}
