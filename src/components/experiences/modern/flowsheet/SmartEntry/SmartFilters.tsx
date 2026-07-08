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

// The results panel Popper sits at z-index 1300; the filter dropdowns must open
// above it (tooltips are 1500, so stay under those).
const FILTER_LISTBOX_SX = { zIndex: 1400 };

// A taller input than the catalog default so the chips aren't vertically
// compressed (and the controls stay tappable on touch).
const FILTER_ROOT_SX = { "--Input-minHeight": "2rem" };

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
          listboxSx={FILTER_LISTBOX_SX}
          rootSx={FILTER_ROOT_SX}
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
          listboxSx={FILTER_LISTBOX_SX}
          rootSx={FILTER_ROOT_SX}
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
          listboxSx={FILTER_LISTBOX_SX}
          rootSx={FILTER_ROOT_SX}
        />
      </CatalogFilterSection>
    </Box>
  );
}
