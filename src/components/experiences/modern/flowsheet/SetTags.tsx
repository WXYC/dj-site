"use client";

import { useState, type ReactNode } from "react";
import { Button, Chip, Stack, Typography } from "@mui/joy";
import { EditOutlined } from "@mui/icons-material";
import { useGetCurrentShowQuery } from "@/lib/features/flowsheet/api";
import { specialtyCopy } from "@/lib/features/specialty/copy";
import { specialtySubtitle } from "@/lib/features/specialty/subtitle";
import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useLiveStatus } from "@/src/hooks/flowsheetHooks";
import RequestLineControl from "@/src/components/experiences/modern/RequestLineControl";
import EditShowDetailsDialog from "@/src/components/experiences/modern/EditShowDetailsDialog";

/**
 * The open set's tag under the flowsheet header: Freeform when untagged, else
 * the program's name with the title beneath it when the title differs. Renders
 * nothing while there is no open show, so an absent set is never called freeform.
 * A DJ on the show (live) or a music director or station manager (authority at
 * least MD) can open the details dialog from the tag, which is then a button
 * with an edit mark; anyone else sees it as plain text. The server is the
 * authority and refuses the rest. The request line sits on the same row.
 */
export default function SetTags() {
  const { data: show } = useGetCurrentShowQuery();
  const { live } = useLiveStatus();
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  const canEdit = live || (user?.authority ?? Authorization.NO) >= Authorization.MD;
  const [editing, setEditing] = useState(false);

  if (!show) {
    return null;
  }

  const name = show.specialty?.name ?? specialtyCopy.freeform;
  const subtitle = specialtySubtitle(show.specialty, show.show_name);
  const tag: ReactNode = canEdit ? (
    <Button
      size="sm"
      variant="outlined"
      color="neutral"
      endDecorator={<EditOutlined fontSize="small" />}
      aria-label={`${specialtyCopy.editDetails}: ${name}`}
      onClick={() => setEditing(true)}
    >
      {name}
    </Button>
  ) : show.specialty ? (
    <Typography level="title-md">{name}</Typography>
  ) : (
    <Chip size="sm" variant="outlined" color="neutral">
      {name}
    </Chip>
  );

  return (
    <Stack sx={{ mb: 1 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <Stack sx={{ alignItems: "flex-start" }}>
          {tag}
          {subtitle && <Typography level="body-sm">{subtitle}</Typography>}
        </Stack>
        {live && <RequestLineControl showId={show.id} />}
      </Stack>
      {editing && (
        <EditShowDetailsDialog
          showId={show.id}
          specialty={show.specialty}
          showName={show.show_name}
          startTime={show.start_time}
          onClose={() => setEditing(false)}
        />
      )}
    </Stack>
  );
}
