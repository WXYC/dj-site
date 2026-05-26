"use client";

import type { LibraryFormatRow } from "@/lib/features/catalog/types";
import { catalogModalSelectSlotProps } from "@/src/components/experiences/modern/catalog/form/catalogModalLayers";
import { Button, FormControl, FormLabel, Input, Option, Select, Stack } from "@mui/joy";

type CatalogEntryAlbumFieldsProps = {
  disabled: boolean;
  formatId: string;
  onFormatIdChange: (value: string) => void;
  formats: LibraryFormatRow[] | undefined;
  formatsLoading?: boolean;
  albumTitle: string;
  onAlbumTitleChange: (v: string) => void;
  label: string;
  onLabelChange: (v: string) => void;
  alternateArtist: string;
  onAlternateArtistChange: (v: string) => void;
  discQuantity: string;
  onDiscQuantityChange: (v: string) => void;
  onAddAlbum: () => void;
  adding: boolean;
  canAdd: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  hideSubmitButton?: boolean;
};

export default function CatalogEntryAlbumFields({
  disabled,
  formatId,
  onFormatIdChange,
  formats,
  formatsLoading,
  albumTitle,
  onAlbumTitleChange,
  label,
  onLabelChange,
  alternateArtist,
  onAlternateArtistChange,
  discQuantity,
  onDiscQuantityChange,
  onAddAlbum,
  adding,
  canAdd,
  submitLabel = "Add album to catalog",
  submittingLabel,
  hideSubmitButton = false,
}: CatalogEntryAlbumFieldsProps) {
  return (
    <Stack spacing={2} sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <FormControl required>
        <FormLabel>Format</FormLabel>
        <Select
          placeholder="Choose format"
          value={formatId}
          onChange={(_, v) => onFormatIdChange(v as string)}
          disabled={disabled || formatsLoading}
          slotProps={catalogModalSelectSlotProps}
        >
          <Option value="">Choose format</Option>
          {formats?.map((f) => (
            <Option key={f.id} value={String(f.id)}>
              {f.format_name}
            </Option>
          ))}
        </Select>
      </FormControl>
      <FormControl required>
        <FormLabel>Album title</FormLabel>
        <Input
          value={albumTitle}
          onChange={(e) => onAlbumTitleChange(e.target.value)}
          disabled={disabled}
        />
      </FormControl>
      <FormControl required>
        <FormLabel>Label</FormLabel>
        <Input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          disabled={disabled}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Alternate artist display (optional)</FormLabel>
        <Input
          value={alternateArtist}
          onChange={(e) => onAlternateArtistChange(e.target.value)}
          disabled={disabled}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Disc quantity</FormLabel>
        <Input
          type="number"
          slotProps={{ input: { min: 1 } }}
          value={discQuantity}
          onChange={(e) => onDiscQuantityChange(e.target.value)}
          disabled={disabled}
        />
      </FormControl>
      {hideSubmitButton ? null : (
        <Button
          loading={adding}
          onClick={onAddAlbum}
          variant="solid"
          color="primary"
          disabled={disabled || !canAdd || adding}
          data-testid="catalog-album-fields-submit"
        >
          {adding && submittingLabel ? submittingLabel : submitLabel}
        </Button>
      )}
    </Stack>
  );
}
