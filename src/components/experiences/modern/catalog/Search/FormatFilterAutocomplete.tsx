"use client";

import type { LibraryFormatRow } from "@/lib/features/catalog/types";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { useMemo } from "react";

import { CatalogFilterAutocomplete } from "./CatalogFilterAutocomplete";
import { getFormatFilterChipProps } from "./catalogFilterChipStyles";

type FormatFilterAutocompleteProps = {
  formats: LibraryFormatRow[] | undefined;
  isLoading: boolean;
};

export function FormatFilterAutocomplete({
  formats,
  isLoading,
}: FormatFilterAutocompleteProps) {
  const { filters, setFilter } = useCatalogQuerySearch();
  const options = useMemo(
    () => formats?.map((f) => f.format_name) ?? [],
    [formats],
  );

  return (
    <CatalogFilterAutocomplete
      options={options}
      value={filters.formats}
      onChange={(formats) => setFilter({ formats })}
      placeholder="All formats..."
      ariaLabel="Format"
      isLoading={isLoading}
      getTagChipProps={getFormatFilterChipProps}
    />
  );
}
