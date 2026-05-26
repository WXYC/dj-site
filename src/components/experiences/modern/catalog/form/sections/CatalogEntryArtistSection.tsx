"use client";

import type { LibraryGenreRow } from "@/lib/features/catalog/types";
import CatalogEntryArtistAutocomplete from "@/src/components/experiences/modern/admin/catalog/CatalogEntryArtistAutocomplete";
import CatalogEntryNewArtistFields from "@/src/components/experiences/modern/admin/catalog/CatalogEntryNewArtistFields";
import type { useCatalogEntryForm } from "@/src/components/experiences/modern/admin/catalog/useCatalogEntryForm";
import { Box, FormControl, FormLabel, Option, Select } from "@mui/joy";
import CatalogFormFieldGroup from "../CatalogFormFieldGroup";
import { catalogFormFullWidthSx } from "../catalogFormLayout";
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
  "data-testid": dataTestId = "catalog-form-artist-section",
}: CatalogEntryArtistSectionProps) {
  return (
    <CatalogFormFieldGroup data-testid={dataTestId}>
      <FormControl required size="sm" sx={catalogFormFullWidthSx}>
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

      <Box sx={catalogFormFullWidthSx}>
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
      </Box>

      {showNewArtistFields && onSuggestArtistCode && onCreateArtist ? (
        <Box sx={catalogFormFullWidthSx}>
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
        </Box>
      ) : null}
    </CatalogFormFieldGroup>
  );
}
