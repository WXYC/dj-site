"use client";

import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Stack,
} from "@mui/joy";

type CatalogEntryNewArtistFieldsProps = {
  codeLetters: string;
  onCodeLettersChange: (v: string) => void;
  codeNumber: string;
  onCodeNumberChange: (v: string) => void;
  alphabeticalName: string;
  onAlphabeticalNameChange: (v: string) => void;
  onSuggestNext: () => void;
  onCreateArtist: () => void;
  creating: boolean;
  canCreate: boolean;
  locked: boolean;
};

export default function CatalogEntryNewArtistFields({
  codeLetters,
  onCodeLettersChange,
  codeNumber,
  onCodeNumberChange,
  alphabeticalName,
  onAlphabeticalNameChange,
  onSuggestNext,
  onCreateArtist,
  creating,
  canCreate,
  locked,
}: CatalogEntryNewArtistFieldsProps) {
  return (
    <Stack spacing={2}>
      <FormControl disabled={locked}>
        <FormLabel>Code letters</FormLabel>
        <Input
          value={codeLetters}
          onChange={(e) => onCodeLettersChange(e.target.value)}
          placeholder="e.g. RO"
          disabled={locked}
        />
        {locked && (
          <FormHelperText>
            Artist already in this genre — codes are assigned.
          </FormHelperText>
        )}
      </FormControl>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormControl sx={{ flex: 1 }} disabled={locked}>
          <FormLabel>Artist #</FormLabel>
          <Input
            value={codeNumber}
            onChange={(e) => onCodeNumberChange(e.target.value)}
            placeholder="number"
            disabled={locked}
          />
        </FormControl>
        <Button
          variant="outlined"
          onClick={onSuggestNext}
          disabled={locked}
          sx={{ alignSelf: { sm: "flex-end" }, mt: { sm: 2.5 } }}
        >
          Suggest next #
        </Button>
      </Stack>
      <FormControl>
        <FormLabel>Alphabetical sort name (optional)</FormLabel>
        <Input
          value={alphabeticalName}
          onChange={(e) => onAlphabeticalNameChange(e.target.value)}
        />
      </FormControl>
      <Button
        loading={creating}
        onClick={onCreateArtist}
        variant="solid"
        color="success"
        disabled={!canCreate || creating}
      >
        Create artist
      </Button>
    </Stack>
  );
}
