"use client";

import type { LibraryGenreRow } from "@/lib/features/catalog/types";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { useMemo } from "react";

import { CatalogFilterAutocomplete } from "./CatalogFilterAutocomplete";
import { getGenreFilterChipProps } from "./catalogFilterChipStyles";

type GenreFilterAutocompleteProps = {
  genres: LibraryGenreRow[] | undefined;
  isLoading: boolean;
};

export function GenreFilterAutocomplete({
  genres,
  isLoading,
}: GenreFilterAutocompleteProps) {
  const { filters, setFilter } = useCatalogQuerySearch();
  const options = useMemo(
    () => genres?.map((g) => g.genre_name) ?? [],
    [genres],
  );

  return (
    <CatalogFilterAutocomplete
      options={options}
      value={filters.genres}
      onChange={(genres) => setFilter({ genres })}
      placeholder="All genres..."
      ariaLabel="Genre"
      isLoading={isLoading}
      getTagChipProps={getGenreFilterChipProps}
    />
  );
}
