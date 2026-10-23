"use client";

import { useId, useState } from "react";
import type { RequestLineMode } from "@wxyc/shared";
import { Option, Select, Stack, Typography } from "@mui/joy";
import { useGetCurrentShowQuery, useUpdateShowMutation } from "@/lib/features/flowsheet/api";
import {
  USUAL_CHOICE,
  knownMode,
  requestLineCopy,
  sourceExplanation,
} from "@/lib/features/flowsheet/request-line-copy";

/**
 * Sets the open show's request line and says why it is in effect. It shows the
 * server's mode and never re-derives it, and it is a controlled select, so a
 * refused change leaves it on the server's value. Renders nothing unless the
 * open show is the one asked about and the server reported a request line.
 */
export default function RequestLineControl({ showId }: { showId: number }) {
  const { data: show } = useGetCurrentShowQuery();
  const [updateShow, { isLoading }] = useUpdateShowMutation();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const descriptionId = useId();

  if (show?.id !== showId || !show.request_line) {
    return null;
  }
  const { mode, source } = show.request_line;
  const selected = knownMode(mode);
  const explanation = sourceExplanation(source, show.spotlight_role);

  const choose = async (choice: string) => {
    setRefusal(null);
    setConfirming(false);
    try {
      await updateShow({
        showId,
        request_mode: choice === USUAL_CHOICE ? null : knownMode(choice),
      }).unwrap();
      setConfirming(choice === "feedback");
    } catch (error) {
      // Null is a refusal for the site's general handling, which has toasted it.
      setRefusal((error as { sentence?: string }).sentence ?? null);
    }
  };

  return (
    <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
      <Select
        size="sm"
        aria-label={requestLineCopy.label}
        value={selected}
        disabled={isLoading}
        renderValue={(option) => option?.label}
        slotProps={{ button: { "aria-describedby": descriptionId } }}
        onChange={(_e, value) => value && void choose(value)}
      >
        {Object.entries(requestLineCopy.modes).map(([value, label]) => (
          <Option
            key={value}
            value={value}
            label={label}
            aria-label={label}
            aria-describedby={`${descriptionId}-${value}`}
            sx={{ alignItems: "flex-start" }}
          >
            <Stack>
              <Typography level="title-sm">{label}</Typography>
              <Typography id={`${descriptionId}-${value}`} level="body-xs">
                {requestLineCopy.descriptions[value as RequestLineMode]}
              </Typography>
            </Stack>
          </Option>
        ))}
        {source === "dj" && <Option value={USUAL_CHOICE}>{requestLineCopy.backToUsual}</Option>}
      </Select>
      <Typography id={descriptionId} level="body-sm">
        {requestLineCopy.descriptions[selected]}
      </Typography>
      {explanation && <Typography level="body-sm">{explanation}</Typography>}
      {confirming && <Typography level="body-sm">{requestLineCopy.messagesConfirmed}</Typography>}
      {refusal && (
        <Typography level="body-sm" color="danger" role="alert">
          {refusal}
        </Typography>
      )}
    </Stack>
  );
}
