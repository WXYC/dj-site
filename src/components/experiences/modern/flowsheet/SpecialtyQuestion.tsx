"use client";

import { useState } from "react";
import { Alert, Box, Button, FormControl, FormLabel, Input, Stack, Typography } from "@mui/joy";
import type { SpecialtyShow } from "@wxyc/shared";
import { useUpdateShowMutation } from "@/lib/features/flowsheet/api";
import { describeSlot, showTagRefusal, specialtyCopy } from "@/lib/features/specialty/copy";
import { useSpecialtyQuestion } from "@/src/hooks/specialtyQuestionHooks";
import SpecialtyTile from "../SpecialtyTile";

type Confirmation = { showId: number; program: SpecialtyShow; afterEntryId: number | null };

/** The card a yes gives listeners: the program's tile, name and one-line tagline. */
function ProgramCard({ program }: { program: SpecialtyShow }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <SpecialtyTile specialty={program} size={56} />
      <Box>
        <Typography level="title-md">{program.name}</Typography>
        {program.tagline && <Typography level="body-sm">{program.tagline}</Typography>}
      </Box>
    </Stack>
  );
}

/**
 * Asks, under the flowsheet header, whether an open set that began inside a
 * catalog slot is that slot's program. The slot only suggests: nothing is
 * tagged until a DJ says yes, and the question never blocks logging.
 */
export default function SpecialtyQuestion() {
  const { showId, newestEntryId, matches, decline } = useSpecialtyQuestion();
  const [updateShow, { isLoading }] = useUpdateShowMutation();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [title, setTitle] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  const write = async (body: { specialty_id?: number; show_name?: string }) => {
    setRefusal(null);
    try {
      await updateShow({ showId: showId!, ...body }).unwrap();
      return true;
    } catch (error) {
      // Null is a refusal for the site's general handling, which has toasted it.
      setRefusal(showTagRefusal(error as { status?: unknown; data?: unknown }));
      return false;
    }
  };

  const finish = async () => {
    if (title.trim() && !(await write({ show_name: title.trim() }))) {
      return;
    }
    setConfirmation(null);
    setTitle("");
  };

  // The tag lands before the next poll, so the confirmation outlives `matches`;
  // it closes on Done or when the next row is logged on the set.
  if (confirmation?.showId === showId && confirmation.afterEntryId === newestEntryId) {
    return (
      <Stack spacing={1.5} sx={{ mb: 1.5 }}>
        <ProgramCard program={confirmation.program} />
        <Typography level="body-sm">{specialtyCopy.tagged(confirmation.program.name)}</Typography>
        <FormControl>
          <FormLabel>{specialtyCopy.titleLabel}</FormLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            slotProps={{ input: { maxLength: 128 } }}
          />
        </FormControl>
        {refusal && <Alert color="danger">{refusal}</Alert>}
        <Box>
          <Button size="sm" loading={isLoading} onClick={finish}>
            {specialtyCopy.done}
          </Button>
        </Box>
      </Stack>
    );
  }

  if (showId === null || matches.length === 0) {
    return null;
  }

  const slot = describeSlot(matches[0].slot);
  const names = matches.map(({ program }) => program.name);
  return (
    <Stack spacing={1.5} sx={{ mb: 1.5 }}>
      <Typography level="title-sm">
        {matches.length === 1
          ? specialtyCopy.askOne(slot, names[0])
          : specialtyCopy.askShared(slot, names)}
      </Typography>
      {matches.map(({ program }) => (
        <Stack key={program.id} direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <ProgramCard program={program} />
          <Button
            size="sm"
            loading={isLoading}
            onClick={async () => {
              if (await write({ specialty_id: program.id })) {
                setConfirmation({ showId, program, afterEntryId: newestEntryId });
              }
            }}
          >
            {specialtyCopy.yes(program.name)}
          </Button>
        </Stack>
      ))}
      {refusal && <Alert color="danger">{refusal}</Alert>}
      <Box>
        <Button size="sm" variant="plain" color="neutral" onClick={() => decline(showId)}>
          {specialtyCopy.notThisTime}
        </Button>
      </Box>
    </Stack>
  );
}
