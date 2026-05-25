"use client";

import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";

import { CatalogFilterAutocomplete } from "./CatalogFilterAutocomplete";
import { CATALOG_TAG_FILTER_OPTIONS } from "./catalogTagFilters";
import { getTagFilterChipProps } from "./catalogFilterChipStyles";

export function TagFilterAutocomplete() {
  const { filters, setFilter } = useCatalogQuerySearch();

  return (
    <CatalogFilterAutocomplete
      options={[...CATALOG_TAG_FILTER_OPTIONS]}
      value={filters.tags}
      onChange={(tags) => setFilter({ tags })}
      placeholder="All tags..."
      ariaLabel="Tag"
      isLoading={false}
      getTagChipProps={getTagFilterChipProps}
    />
  );
}
