/** UI tag filter ids; extend as `/library/query` gains more tag dimensions. */
export const CATALOG_TAG_FILTER_OPTIONS = ["exclusives", "missing"] as const;

export type CatalogTagFilterId = (typeof CATALOG_TAG_FILTER_OPTIONS)[number];

export type CatalogTagQueryFlags = {
  on_streaming?: boolean;
  missing?: boolean;
};

/** Map selected tag filters to `/library/query` params. */
export function catalogTagsToQueryFlags(tags: string[]): CatalogTagQueryFlags {
  return {
    on_streaming: tags.includes("exclusives") ? false : undefined,
    missing: tags.includes("missing") ? true : undefined,
  };
}

