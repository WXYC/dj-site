"use client";

import type { LibraryGenreRow } from "@/lib/features/catalog/types";
import CatalogEntryArtistAutocomplete from "@/src/components/experiences/modern/admin/catalog/CatalogEntryArtistAutocomplete";
import CatalogEntryNewArtistFields from "@/src/components/experiences/modern/admin/catalog/CatalogEntryNewArtistFields";
import type { useCatalogEntryForm } from "@/src/components/experiences/modern/admin/catalog/useCatalogEntryForm";
import { FormControl, FormLabel, Option, Select } from "@mui/joy";
import CatalogFormSection from "../CatalogFormSection";
import { catalogModalSelectSlotProps } from "../catalogModalLayers";

type FormApi = ReturnType<typeof useCatalogEntryForm>;

type CatalogEntryArtistSectionProps = {
  form: FormApi;
  genres: LibraryGenreRow[] | undefined;
  genresLoading: boolean;
  showNewArtistFields?: boolean;
  allowCreateArtist?: boolean;
  onSuggestArtistCode?: () => void;
  onCreateArtist?: () => void;
  creatingArtist?: boolean;
  description?: string;
  "data-testid"?: string;
};

export default function CatalogEntryArtistSection({
  form,
  genres,
  genresLoading,
  showNewArtistFields = false,
  allowCreateArtist = true,
  onSuggestArtistCode,
  onCreateArtist,
  creatingArtist = false,
  description = "Choose a genre, then find or create an artist.",
  "data-testid": dataTestId = "catalog-form-artist-section",
}: CatalogEntryArtistSectionProps) {
  return (
    <CatalogFormSection
      title="Artist"
      description={description}
      data-testid={dataTestId}
    >
      <FormControl required size="sm">
        <FormLabel>Genre</FormLabel>
        <Select
          size="sm"
          placeholder="Choose genre"
          value={form.genreId}
          onChange={(_, v) => form.setGenreId(v as string)}
          disabled={genresLoading}
          slotProps={catalogModalSelectSlotProps}
        >
          <Option value="">Choose genre</Option>
          {genres?.map((g) => (
            <Option key={g.id} value={String(g.id)}>
              {g.genre_name}
            </Option>
          ))}
        </Select>
      </FormControl>

      <CatalogEntryArtistAutocomplete
        genreIdNum={form.genreIdNum}
        inputValue={form.artistInputValue}
        onInputChange={form.setArtistInputValue}
        value={form.artistOption}
        onSelectExisting={form.selectExistingArtist}
        onSelectNew={form.selectNewArtist}
        onClear={form.resetArtist}
        allowCreateArtist={allowCreateArtist}
      />

      {showNewArtistFields && onSuggestArtistCode && onCreateArtist ? (
        <CatalogEntryNewArtistFields
          codeLetters={form.codeLetters}
          onCodeLettersChange={form.setCodeLetters}
          codeNumber={form.codeNumber}
          onCodeNumberChange={form.setCodeNumber}
          alphabeticalName={form.alphabeticalName}
          onAlphabeticalNameChange={form.setAlphabeticalName}
          onSuggestNext={onSuggestArtistCode}
          onCreateArtist={onCreateArtist}
          creating={creatingArtist}
          canCreate={form.canCreateArtist}
          locked={form.codeFieldsLocked}
        />
      ) : null}
    </CatalogFormSection>
  );
}
