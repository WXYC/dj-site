"use client";

import { Button, FormControl, FormLabel, Input, Stack } from "@mui/joy";

type CatalogEntryAlbumFieldsProps = {
  disabled: boolean;
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
};

export default function CatalogEntryAlbumFields({
  disabled,
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
}: CatalogEntryAlbumFieldsProps) {
  return (
    <Stack spacing={2} sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
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
      <Button
        loading={adding}
        onClick={onAddAlbum}
        variant="solid"
        color="primary"
        disabled={disabled || !canAdd || adding}
      >
        Add album to catalog
      </Button>
    </Stack>
  );
}
