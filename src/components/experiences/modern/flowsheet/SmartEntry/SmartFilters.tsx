"use client";

import { Box, Divider } from "@mui/joy";
import { useMemo } from "react";
import {
  useGetFormatsQuery,
  useGetGenresQuery,
} from "@/lib/features/catalog/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import type { Rotation } from "@/lib/features/rotation/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { CatalogFilterAutocomplete } from "../../catalog/Search/CatalogFilterAutocomplete";
import { CatalogFilterSection } from "../../catalog/Search/CatalogFilterSection";
import {
  getFormatFilterChipProps,
  getGenreFilterChipProps,
  getTagFilterChipProps,
} from "../../catalog/Search/catalogFilterChipStyles";
import {
  CATALOG_ROTATION_TAG_BINS,
  getCatalogTagLabel,
} from "../../catalog/Search/catalogTagFilters";

/**
 * The flowsheet result filters — genre / format / rotation-bin — rendered in
 * the composer toolbar. Reuses the card catalog's controlled autocomplete and
 * chip styling, but reads/writes the flowsheet-owned filter state
 * (`flowsheetSlice.search.filters`); the filters are applied client-side in
 * deriveSmartResults. The rotation-bin dimension offers only H/M/L/S (the
 * catalog's exclusives/missing tags don't apply to a live entry search).
 */
export default function SmartFilters() {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(flowsheetSlice.selectors.getSearchFilters);

  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();

  const genreOptions = useMemo(
    () => genres?.map((g) => g.genre_name) ?? [],
    [genres]
  );
  const formatOptions = useMemo(
    () => formats?.map((f) => f.format_name) ?? [],
    [formats]
  );

  return (
    <Box
      data-testid="flowsheet-filters"
      sx={{ display: "flex", alignItems: "stretch", width: "100%", minWidth: 0 }}
    >
      <CatalogFilterSection>
        <CatalogFilterAutocomplete
          options={genreOptions}
          value={filters.genres}
          onChange={(genres) =>
            dispatch(
              flowsheetSlice.actions.setSearchFilters({ ...filters, genres })
            )
          }
          placeholder="All genres…"
          ariaLabel="Genre"
          isLoading={genresLoading}
          getTagChipProps={getGenreFilterChipProps}
        />
      </CatalogFilterSection>

      <Divider orientation="vertical" />

      <CatalogFilterSection>
        <CatalogFilterAutocomplete
          options={formatOptions}
          value={filters.formats}
          onChange={(formats) =>
            dispatch(
              flowsheetSlice.actions.setSearchFilters({ ...filters, formats })
            )
          }
          placeholder="All formats…"
          ariaLabel="Format"
          isLoading={formatsLoading}
          getTagChipProps={getFormatFilterChipProps}
        />
      </CatalogFilterSection>

      <Divider orientation="vertical" />

      <CatalogFilterSection>
        <CatalogFilterAutocomplete
          options={[...CATALOG_ROTATION_TAG_BINS]}
          value={filters.rotationTags}
          onChange={(tags) =>
            dispatch(
              flowsheetSlice.actions.setSearchFilters({
                ...filters,
                rotationTags: tags as Rotation[],
              })
            )
          }
          placeholder="All rotation…"
          ariaLabel="Rotation"
          isLoading={false}
          getTagChipProps={getTagFilterChipProps}
          getOptionLabel={getCatalogTagLabel}
        />
      </CatalogFilterSection>
    </Box>
  );
}
