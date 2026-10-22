"use client";

import { Chip, Stack, Typography } from "@mui/joy";
import { useGetCurrentShowQuery } from "@/lib/features/flowsheet/api";
import { specialtyCopy } from "@/lib/features/specialty/copy";

/**
 * The open set's tag under the flowsheet header: Freeform when untagged, else
 * the program's name with the title beneath it when the title differs. Renders
 * nothing while there is no open show, so an absent set is never called freeform.
 */
export default function SetTags() {
  const { data: show } = useGetCurrentShowQuery();

  if (!show) {
    return null;
  }

  if (!show.specialty) {
    return (
      <Chip size="sm" variant="outlined" color="neutral" sx={{ mb: 1 }}>
        {specialtyCopy.freeform}
      </Chip>
    );
  }

  return (
    <Stack sx={{ mb: 1 }}>
      <Typography level="title-md">{show.specialty.name}</Typography>
      {show.show_name && show.show_name !== show.specialty.name && (
        <Typography level="body-sm">{show.show_name}</Typography>
      )}
    </Stack>
  );
}
