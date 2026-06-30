"use client";

import Close from "@mui/icons-material/Close";
import Autocomplete, {
  type AutocompleteRenderGetTagProps,
} from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import Chip from "@mui/joy/Chip";
import Skeleton from "@mui/joy/Skeleton";
import type { Key, ReactNode } from "react";

import { catalogFilterAutocompleteSx } from "./catalogFilterStyles";
import {
  catalogFilterTagFontSx,
  type CatalogFilterTagChipProps,
} from "./catalogFilterChipStyles";

type CatalogFilterAutocompleteProps = {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  ariaLabel: string;
  isLoading: boolean;
  getTagChipProps?: (item: string) => CatalogFilterTagChipProps;
  getOptionLabel?: (option: string) => string;
  renderTags?: (
    tags: string[],
    getTagProps: AutocompleteRenderGetTagProps,
  ) => ReactNode;
};

export function CatalogFilterAutocomplete({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  isLoading,
  getTagChipProps,
  getOptionLabel = (option) => option,
  renderTags: renderTagsProp,
}: CatalogFilterAutocompleteProps) {
  if (isLoading) {
    return <Skeleton variant="rectangular" width="100%" height={28} sx={{ borderRadius: "sm" }} />;
  }

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      size="sm"
      variant="plain"
      placeholder={value.length === 0 ? placeholder : undefined}
      options={options}
      value={value}
      loading={isLoading}
      aria-label={ariaLabel}
      limitTags={3}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(a, b) => a === b}
      onChange={(_, newValue) => onChange(newValue ?? [])}
      renderOption={
        getTagChipProps
          ? (props, option) => {
              const chipStyle = getTagChipProps(option);
              const { key, ...optionProps } = props as typeof props & {
                key: Key;
              };
              return (
                <AutocompleteOption key={key} {...optionProps}>
                  <Chip
                    size="sm"
                    variant={chipStyle.variant ?? "soft"}
                    {...(chipStyle.color ? { color: chipStyle.color } : {})}
                    sx={chipStyle.sx}
                  >
                    {getOptionLabel(option)}
                  </Chip>
                </AutocompleteOption>
              );
            }
          : undefined
      }
      renderTags={
        renderTagsProp ??
        ((tags, getTagProps) =>
          tags.map((item, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            const chipStyle = getTagChipProps?.(item) ?? {
              color: "neutral" as const,
              variant: "soft" as const,
            };
            return (
              <Chip
                key={key}
                {...tagProps}
                variant={chipStyle.variant ?? "soft"}
                {...(chipStyle.color ? { color: chipStyle.color } : {})}
                size="sm"
                endDecorator={<Close sx={{ fontSize: "0.875rem" }} />}
                sx={{
                  minWidth: 0,
                  ...catalogFilterTagFontSx,
                  ...chipStyle.sx,
                }}
              >
                {getOptionLabel(item)}
              </Chip>
            );
          }))
      }
      slotProps={{
        input: {
          sx: catalogFilterTagFontSx,
        },
        listbox: {
          sx: catalogFilterTagFontSx,
        },
      }}
      sx={catalogFilterAutocompleteSx}
    />
  );
}
