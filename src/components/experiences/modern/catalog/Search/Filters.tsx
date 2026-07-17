"use client";

import {
  useGetFormatsQuery,
  useGetGenresQuery,
} from "@/lib/features/catalog/api";
import type { LibraryGenreRow } from "@/lib/features/catalog/types";
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

export const Filters = ({
  initialGenres,
}: {
  initialGenres?: LibraryGenreRow[];
}) => {
  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();

  // Seed from the server-cached genres until the client query resolves, then
  // the client query owns the value (mirrors the NowPlaying seed pattern). Only
  // show the loading affordance when neither a seed nor client data is present.
  const seededGenres = genres ?? initialGenres;
  const genresPending =
    genresLoading && genres === undefined && initialGenres === undefined;

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
        <GenreFilterAutocomplete
          genres={seededGenres}
          isLoading={genresPending}
        />
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
