"use client";

import type { LibraryFormatRow } from "@/lib/features/catalog/types";
import CatalogEntryAlbumFields from "@/src/components/experiences/modern/admin/catalog/CatalogEntryAlbumFields";
import CatalogFormSection from "../CatalogFormSection";

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
  description?: string;
  "data-testid"?: string;
};

export default function CatalogEntryAlbumSection({
  description = "Format, title, label, and other album metadata.",
  "data-testid": dataTestId = "catalog-form-album-section",
  hideSubmitButton = false,
  ...fieldsProps
}: CatalogEntryAlbumSectionProps) {
  return (
    <CatalogFormSection
      title="Album"
      description={description}
      data-testid={dataTestId}
    >
      <CatalogEntryAlbumFields
        {...fieldsProps}
        hideSubmitButton={hideSubmitButton}
      />
    </CatalogFormSection>
  );
}
