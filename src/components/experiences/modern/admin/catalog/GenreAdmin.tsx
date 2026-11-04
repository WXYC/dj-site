"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Chip, FormControl, FormHelperText, Input, Stack, Typography } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useAddGenreMutation, useGetGenresQuery } from "@/lib/features/catalog/api";
import { GENRE_TONES, STATUS_CHIP_SX, genreTone } from "@/lib/features/experiences/modern/tokens/roles";
import { formatRotationDate } from "@/lib/features/rotation/classicList";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import { tabularNumsSx } from "@/src/utilities/modern/recordTableSx";
import TermSection, { byName, sameTerm } from "./TermSection";

/** Whether the presentation table has a designed color for this genre. */
function hasDesignedTone(name: string): boolean {
  const key = name.trim().toLowerCase();
  return Object.keys(GENRE_TONES).some((genre) => genre !== "Unknown" && genre.toLowerCase() === key);
}

/**
 * A genre exactly as the catalog draws it: its server name, in the chip its
 * tone resolves to. A genre with no designed color renders neutral, which is
 * the normal case for a new one, not an error.
 */
export function GenreChip({ name }: { name: string }) {
  const tone = genreTone(name);
  return (
    <Chip size="sm" color={tone.color} variant={tone.variant} sx={STATUS_CHIP_SX}>
      {name}
    </Chip>
  );
}

function GenreAdmin() {
  const { data: genres, isLoading, isError, refetch } = useGetGenresQuery();
  const [addGenre, { isLoading: adding }] = useAddGenreMutation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const sorted = useMemo(
    () => [...(genres ?? [])].sort(byName((genre) => genre.genre_name)),
    [genres],
  );
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const duplicate = trimmedName ? sorted.find((genre) => sameTerm(genre.genre_name, trimmedName)) : undefined;
  const canAdd = trimmedName !== "" && trimmedDescription !== "" && duplicate == null && !adding;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canAdd) return;
    try {
      await addGenre({ name: trimmedName, description: trimmedDescription }).unwrap();
      toast.success(`Added ${trimmedName}.`);
      setName("");
      setDescription("");
    } catch (err) {
      // A no-status rejection is toasted here on purpose: the alternative is
      // a failed add nobody is ever told about.
      if (isUnmessagedHttpError(err)) {
        toast.error("Couldn't add the genre. Please try again.");
      }
    }
  };

  const helper = duplicate
    ? `${duplicate.genre_name} already exists.`
    : trimmedName && !hasDesignedTone(trimmedName)
      ? "No designed color yet — it shows neutral in the catalog."
      : trimmedName && !trimmedDescription
        ? "Add a short description to file it."
        : null;

  return (
    <RequireMD>
      <TermSection
        title="Genres"
        noun="genre"
        count={genres ? genres.length : null}
        loading={isLoading}
        failed={isError && genres == null}
        onRetry={() => void refetch()}
        empty="No genres yet."
        columns={[
          { label: "Shows as", width: 150 },
          { label: "Description" },
          { label: "Plays", width: 72, align: "right" },
          { label: "Added", width: 84, align: "right" },
        ]}
        composer={
          <form onSubmit={handleSubmit}>
            <Stack direction="row" spacing={1} useFlexGap alignItems="center" sx={{ flexWrap: "wrap" }}>
              {/* A FormControl holds exactly one control, so each field gets its own. */}
              <FormControl error={duplicate != null} sx={{ flex: "1 1 140px" }}>
                <Input
                  size="sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New genre"
                  slotProps={{
                    input: {
                      "aria-label": "New genre name",
                      "aria-describedby": helper ? "genre-composer-hint" : undefined,
                    },
                  }}
                />
              </FormControl>
              <FormControl sx={{ flex: "2 1 200px" }}>
                <Input
                  size="sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  slotProps={{ input: { "aria-label": "New genre description" } }}
                />
              </FormControl>
              {trimmedName && <GenreChip name={trimmedName} />}
              <Button size="sm" color="success" type="submit" loading={adding} disabled={!canAdd}>
                Add genre
              </Button>
            </Stack>
            {helper && (
              <FormHelperText
                id="genre-composer-hint"
                sx={{ mt: 0.75, color: duplicate ? "text.secondary" : "text.tertiary" }}
              >
                {helper}
              </FormHelperText>
            )}
          </form>
        }
      >
        {sorted.map((genre) => (
          <tr key={genre.id} className="record-row">
            <td>
              <GenreChip name={genre.genre_name} />
            </td>
            <td>
              <Typography level="body-sm" textColor={genre.description ? "text.secondary" : "text.tertiary"} noWrap>
                {genre.description || "—"}
              </Typography>
            </td>
            <td style={{ textAlign: "right" }}>
              <Typography level="body-sm" textColor="text.tertiary" sx={tabularNumsSx}>
                {genre.plays ? genre.plays : "—"}
              </Typography>
            </td>
            <td style={{ textAlign: "right" }}>
              <Typography level="body-xs" textColor="text.tertiary" sx={tabularNumsSx}>
                {formatRotationDate(genre.add_date?.slice(0, 10)) || "—"}
              </Typography>
            </td>
          </tr>
        ))}
      </TermSection>
    </RequireMD>
  );
}

export default GenreAdmin;
