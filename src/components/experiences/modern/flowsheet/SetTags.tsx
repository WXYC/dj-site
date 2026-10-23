"use client";

import { useState, type ReactNode } from "react";
import { Box, Chip, Stack, Typography } from "@mui/joy";
import { useGetCurrentShowQuery } from "@/lib/features/flowsheet/api";
import { specialtyCopy } from "@/lib/features/specialty/copy";
import { specialtySubtitle } from "@/lib/features/specialty/subtitle";
import { useLiveStatus } from "@/src/hooks/flowsheetHooks";
import EditShowDetailsDialog from "@/src/components/experiences/modern/EditShowDetailsDialog";

/**
 * The open set's tag under the flowsheet header: Freeform when untagged, else
 * the program's name with the title beneath it when the title differs. Renders
 * nothing while there is no open show, so an absent set is never called freeform.
 * A DJ on the show can open the details dialog from the tag; anyone else sees it
 * as plain text.
 */
export default function SetTags() {
  const { data: show } = useGetCurrentShowQuery();
  const { live } = useLiveStatus();
  const [editing, setEditing] = useState(false);

  if (!show) {
    return null;
  }

  const subtitle = specialtySubtitle(show.specialty, show.show_name);
  const tag: ReactNode = show.specialty ? (
    <Stack>
      <Typography level="title-md">{show.specialty.name}</Typography>
      {subtitle && <Typography level="body-sm">{subtitle}</Typography>}
    </Stack>
  ) : (
    <Chip size="sm" variant="outlined" color="neutral">
      {specialtyCopy.freeform}
    </Chip>
  );

  return (
    <Stack sx={{ mb: 1, alignItems: "flex-start" }}>
      {live ? (
        <Box
          component="button"
          type="button"
          aria-label={`${specialtyCopy.editDetails}: ${show.specialty?.name ?? specialtyCopy.freeform}`}
          onClick={() => setEditing(true)}
          sx={{ p: 0, border: 0, bgcolor: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" }}
        >
          {tag}
        </Box>
      ) : (
        tag
      )}
      {editing && (
        <EditShowDetailsDialog
          showId={show.id}
          specialty={show.specialty}
          showName={show.show_name}
          onClose={() => setEditing(false)}
        />
      )}
    </Stack>
  );
}
