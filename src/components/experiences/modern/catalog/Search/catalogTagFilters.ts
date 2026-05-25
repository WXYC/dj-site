/** UI tag filter ids; extend as `/library/query` gains more tag dimensions. */
export const CATALOG_TAG_FILTER_OPTIONS = ["exclusives"] as const;

export type CatalogTagFilterId = (typeof CATALOG_TAG_FILTER_OPTIONS)[number];

/** Map selected tag filters to API query params (v1: exclusives → off-streaming). */
export function catalogTagsToOnStreaming(tags: string[]): boolean | undefined {
  return tags.includes("exclusives") ? false : undefined;
}
