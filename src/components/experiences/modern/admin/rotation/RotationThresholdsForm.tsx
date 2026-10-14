"use client";

import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useGetRotationThresholdsQuery,
  useUpdateRotationThresholdsMutation,
} from "@/lib/features/rotation/api";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationWindowDays,
} from "@/lib/features/rotation/types";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import ReadRetryAlert from "@/src/components/experiences/modern/admin/ReadRetryAlert";
import { Button, FormControl, FormHelperText, FormLabel, Input, LinearProgress, Stack } from "@mui/joy";

const WINDOW_MIN_DAYS = 1;
const WINDOW_MAX_DAYS = 365;

const isValidWindow = (value: string) =>
  /^\d+$/.test(value) && Number(value) >= WINDOW_MIN_DAYS && Number(value) <= WINDOW_MAX_DAYS;

function ThresholdsFields({
  stored,
  refetching,
}: {
  stored: RotationWindowDays;
  refetching: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState<Record<RotationBin, string>>(
    () => Object.fromEntries(ROTATION_BINS.map((bin) => [bin, String(stored[bin])])) as Record<RotationBin, string>,
  );
  const [updateThresholds, { isLoading: saving }] = useUpdateRotationThresholdsMutation();

  const changed = ROTATION_BINS.filter((bin) => draft[bin] !== String(stored[bin]));
  // Only a window this draft moved is held to the range: the read type has no
  // upper bound, so judging every field would strand a stored value nobody
  // touched behind a message about a field the MD never edited.
  const invalid = changed.filter((bin) => !isValidWindow(draft[bin]));

  const save = async () => {
    const window_days: Partial<Record<RotationBin, number>> = {};
    for (const bin of changed) window_days[bin] = Number(draft[bin]);
    try {
      await updateThresholds({ window_days }).unwrap();
      toast.success("Saved the rotation thresholds.");
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Couldn't save the rotation thresholds. Please try again.");
      }
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 360 }}>
      {ROTATION_BINS.map((bin) => (
        <FormControl key={bin} error={invalid.includes(bin)}>
          <FormLabel>{ROTATION_BIN_LABELS[bin]}</FormLabel>
          <Input
            size="sm"
            type="number"
            slotProps={{ input: { min: WINDOW_MIN_DAYS, max: WINDOW_MAX_DAYS, step: 1 } }}
            endDecorator="days"
            value={draft[bin]}
            disabled={saving}
            onChange={(event) => setDraft((current) => ({ ...current, [bin]: event.target.value }))}
          />
          {invalid.includes(bin) && (
            <FormHelperText>
              {ROTATION_BIN_LABELS[bin]} must be a whole number of days from {WINDOW_MIN_DAYS} to{" "}
              {WINDOW_MAX_DAYS}.
            </FormHelperText>
          )}
        </FormControl>
      ))}
      <Button
        size="sm"
        sx={{ alignSelf: "flex-start" }}
        loading={saving}
        // A save's tag invalidation refetches while the old record is still
        // on screen; saving against it would diff the draft against a stale
        // baseline.
        disabled={changed.length === 0 || invalid.length > 0 || refetching}
        onClick={() => void save()}
      >
        Save
      </Button>
    </Stack>
  );
}

/**
 * The per-bin replacement windows an MD edits. The read is a write
 * precondition, so it fails closed: the form is seeded from a successful read
 * only, never from defaults, because saving a form seeded any other way would
 * overwrite the windows the MDs set.
 */
export default function RotationThresholdsForm(): JSX.Element {
  const { data, isError, isFetching, refetch } = useGetRotationThresholdsQuery();
  if (hasNothingToShow({ isError, data })) {
    return (
      <ReadRetryAlert message="Could not load the rotation thresholds." onRetry={() => void refetch()} />
    );
  }
  if (data == null) return <LinearProgress aria-label="Loading rotation thresholds" />;

  // Keyed on the record so the draft re-seeds from what a save (or another
  // MD's save) left stored, rather than keeping inputs that no longer match.
  return (
    <ThresholdsFields
      key={ROTATION_BINS.map((bin) => data.window_days[bin]).join("-")}
      stored={data.window_days}
      refetching={isFetching}
    />
  );
}
