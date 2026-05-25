"use client";

import {
  useGetFormatsQuery,
  useGetGenresQuery,
} from "@/lib/features/catalog/api";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { Box, Divider } from "@mui/joy";

import { CatalogFilterSection } from "./CatalogFilterSection";
import { FormatFilterAutocomplete } from "./FormatFilterAutocomplete";
import { GenreFilterAutocomplete } from "./GenreFilterAutocomplete";
import { TagFilterAutocomplete } from "./TagFilterAutocomplete";

export function catalogFiltersActive(filters: {
  genres: string[];
  formats: string[];
  tags: string[];
}): boolean {
  return (
    filters.genres.length > 0 ||
    filters.formats.length > 0 ||
    filters.tags.length > 0
  );
}

export const Filters = () => {
  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();

  return (
    <Box
      data-testid="catalog-search-filters"
      sx={{
        display: "flex",
        alignItems: "stretch",
        width: "100%",
      }}
    >
      <CatalogFilterSection>
        <GenreFilterAutocomplete genres={genres} isLoading={genresLoading} />
      </CatalogFilterSection>

      <Divider orientation="vertical" />

      <CatalogFilterSection>
        <FormatFilterAutocomplete formats={formats} isLoading={formatsLoading} />
      </CatalogFilterSection>

      <Divider orientation="vertical" />

      <CatalogFilterSection>
        <TagFilterAutocomplete />
      </CatalogFilterSection>
    </Box>
  );
};
