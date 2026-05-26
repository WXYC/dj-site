"use client";

import type { LibraryFormatRow } from "@/lib/features/catalog/types";
import CatalogEntryAlbumFields from "@/src/components/experiences/modern/admin/catalog/CatalogEntryAlbumFields";
import CatalogFormFieldGroup from "../CatalogFormFieldGroup";
import { catalogFormFullWidthSx } from "../catalogFormLayout";
import { Box } from "@mui/joy";

type CatalogEntryAlbumSectionProps = {
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
  pairAlternateAndDisc?: boolean;
  "data-testid"?: string;
};

export default function CatalogEntryAlbumSection({
  pairAlternateAndDisc = false,
  "data-testid": dataTestId = "catalog-form-album-section",
  hideSubmitButton = false,
  disabled,
  ...fieldsProps
}: CatalogEntryAlbumSectionProps) {
  return (
    <CatalogFormFieldGroup data-testid={dataTestId} disabled={disabled}>
      <Box sx={catalogFormFullWidthSx}>
        <CatalogEntryAlbumFields
          {...fieldsProps}
          hideSubmitButton={hideSubmitButton}
          pairAlternateAndDisc={pairAlternateAndDisc}
        />
      </Box>
    </CatalogFormFieldGroup>
  );
}
