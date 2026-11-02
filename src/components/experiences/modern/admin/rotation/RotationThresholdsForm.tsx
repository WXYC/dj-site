"use client";

import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useGetRotationThresholdsQuery,
  useUpdateRotationThresholdsMutation,
} from "@/lib/features/rotation/api";
import { isPastWindow } from "@/lib/features/rotation/age";
import { rotationRowPresentation } from "@/lib/features/rotation/adminList";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationListRow,
  type RotationWindowDays,
} from "@/lib/features/rotation/types";
import { rotationBinSx } from "@/lib/features/experiences/modern/tokens/roles";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import ReadRetryAlert from "@/src/components/experiences/modern/admin/ReadRetryAlert";
import { tabularNumsSx } from "@/src/utilities/modern/recordTableSx";
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Skeleton,
  Stack,
  Typography,
} from "@mui/joy";

const WINDOW_MIN_DAYS = 1;
const WINDOW_MAX_DAYS = 365;

const isValidWindow = (value: string) =>
  /^\d+$/.test(value) && Number(value) >= WINDOW_MIN_DAYS && Number(value) <= WINDOW_MAX_DAYS;

/** How many active records a window of `days` would mark overdue in `bin`. */
function pastCount(rows: RotationListRow[], bin: RotationBin, days: number, now: Date): number {
  return rows.filter(
    (row) =>
      row.rotation_bin === bin &&
      rotationRowPresentation(row) === "active" &&
      isPastWindow(row, days, now),
  ).length;
}

function ThresholdsFields({
  stored,
  refetching,
  readFailed,
  onRetry,
  rows,
  now,
  actions,
  onSaved,
}: {
  stored: RotationWindowDays;
  refetching: boolean;
  readFailed: boolean;
  onRetry: () => void;
  rows: RotationListRow[] | null;
  now: Date;
  actions?: (save: JSX.Element) => JSX.Element;
  onSaved?: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState<Record<RotationBin, string>>(
    () => Object.fromEntries(ROTATION_BINS.map((bin) => [bin, String(stored[bin])])) as Record<RotationBin, string>,
  );
  const [updateThresholds, { isLoading: saving }] = useUpdateRotationThresholdsMutation();

  // A save's tag invalidation refetches while the old record is still on
  // screen; saving against it would diff the draft against a stale baseline.
  const locked = refetching || readFailed;
  const changed = ROTATION_BINS.filter((bin) => draft[bin] !== String(stored[bin]));
  const invalid = changed.filter((bin) => !isValidWindow(draft[bin]));

  const save = async () => {
    const window_days: Partial<Record<RotationBin, number>> = {};
    for (const bin of changed) window_days[bin] = Number(draft[bin]);
    try {
      await updateThresholds({ window_days }).unwrap();
      toast.success("Saved the replacement windows.");
      onSaved?.();
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Couldn't save the replacement windows. Please try again.");
      }
    }
  };

  const saveButton = (
    <Button
      color="success"
      loading={saving}
      disabled={changed.length === 0 || invalid.length > 0 || locked}
      onClick={() => void save()}
    >
      Save windows
    </Button>
  );

  return (
    <Stack spacing={1.5}>
      {readFailed && <ReadRetryAlert message="Could not load the replacement windows." onRetry={onRetry} />}
      {ROTATION_BINS.map((bin) => {
        const days = isValidWindow(draft[bin]) ? Number(draft[bin]) : null;
        const past = rows != null && days != null ? pastCount(rows, bin, days, now) : null;
        return (
          <FormControl key={bin} error={invalid.includes(bin)}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                aria-hidden
                sx={{
                  ...rotationBinSx(bin, "solid"),
                  width: 28,
                  height: 28,
                  borderRadius: "sm",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: "md",
                  flexShrink: 0,
                }}
              >
                {bin}
              </Box>
              <FormLabel sx={{ m: 0, width: 72 }}>{ROTATION_BIN_LABELS[bin]}</FormLabel>
              <Input
                size="sm"
                type="number"
                slotProps={{ input: { min: WINDOW_MIN_DAYS, max: WINDOW_MAX_DAYS, step: 1 } }}
                endDecorator="days"
                value={draft[bin]}
                disabled={saving || locked}
                onChange={(event) => setDraft((current) => ({ ...current, [bin]: event.target.value }))}
                sx={{ width: 120, ...tabularNumsSx }}
              />
              <Typography
                level="body-sm"
                textColor="text.tertiary"
                sx={{ ...tabularNumsSx, minWidth: 64, textAlign: "right" }}
              >
                {past != null ? `${past} past` : ""}
              </Typography>
            </Stack>
            {invalid.includes(bin) && (
              <FormHelperText>
                {ROTATION_BIN_LABELS[bin]} must be a whole number of days from {WINDOW_MIN_DAYS} to{" "}
                {WINDOW_MAX_DAYS}.
              </FormHelperText>
            )}
          </FormControl>
        );
      })}
      {actions ? actions(saveButton) : <Box sx={{ alignSelf: "flex-start" }}>{saveButton}</Box>}
    </Stack>
  );
}

/**
 * The per-bin replacement windows an MD edits, each beside how many active
 * records it would mark past. The read is a write precondition, so it fails
 * closed: the form is seeded from a successful read only, never from
 * defaults, because saving a form seeded any other way would overwrite the
 * windows the MDs set.
 */
export default function RotationThresholdsForm({
  rows = null,
  now = new Date(),
  actions,
  onSaved,
}: {
  /** The shelf's rows, for the "N past" consequence beside each window. */
  rows?: RotationListRow[] | null;
  now?: Date;
  /** Places the Save button, e.g. into a dialog's action row beside Cancel. */
  actions?: (save: JSX.Element) => JSX.Element;
  onSaved?: () => void;
} = {}): JSX.Element {
  const { data, isError, isFetching, refetch } = useGetRotationThresholdsQuery();
  const retry = () => void refetch();
  if (hasNothingToShow({ isError, data })) {
    return <ReadRetryAlert message="Could not load the replacement windows." onRetry={retry} />;
  }
  if (data == null) {
    return (
      <Stack spacing={1.5} aria-busy="true" aria-label="Loading replacement windows">
        {ROTATION_BINS.map((bin) => (
          <Skeleton key={bin} variant="rectangular" height={32} sx={{ borderRadius: "sm" }} />
        ))}
      </Stack>
    );
  }

  // Keyed on the record so the draft re-seeds from what a save (or another
  // MD's save) left stored, rather than keeping inputs that no longer match.
  return (
    <ThresholdsFields
      key={ROTATION_BINS.map((bin) => data.window_days[bin]).join("-")}
      stored={data.window_days}
      refetching={isFetching}
      readFailed={isError}
      onRetry={retry}
      rows={rows}
      now={now}
      actions={actions}
      onSaved={onSaved}
    />
  );
}
