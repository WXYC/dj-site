"use client";

import { useId, useState } from "react";
import { Button, Stack, Typography } from "@mui/joy";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";
import ReleasePicker from "./ReleasePicker";

const COPY = REVIEW_COPY.intakeItem;

/** Opens a library search under its own heading; picking a release cites it. */
export function CiteRelease({ disabled, onCite }: { disabled: boolean; onCite: (albumId: number) => void }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <Stack spacing={1}>
      <Button variant="outlined" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)} sx={{ alignSelf: "flex-start" }}>{COPY.citeRelease}</Button>
      {open && (
        <Stack component="section" aria-labelledby={headingId} spacing={1}>
          <Typography id={headingId} level="title-sm" component="h3">{COPY.citeRelease}</Typography>
          <ReleasePicker searchLabel={COPY.searchCite} onPick={(release) => release.id != null && onCite(release.id)} />
        </Stack>
      )}
    </Stack>
  );
}

/** Takes the record's citation away. It asks first (`asksFirst`) when that also takes its review off the cover. */
export function RemoveCitation({ asksFirst, disabled, onRemove }: { asksFirst: boolean; disabled: boolean; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const remove = () => {
    setConfirming(false);
    onRemove();
  };
  return (
    <>
      <Button variant="outlined" disabled={disabled} onClick={asksFirst ? () => setConfirming(true) : remove} sx={{ alignSelf: "flex-start" }}>{COPY.removeCitation}</Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={COPY.removeAsksCover}
        titleId="remove-citation-title"
        actions={
          <>
            <Button variant="plain" onClick={() => setConfirming(false)}>{REVIEW_COPY.screen.cancel}</Button>
            <Button onClick={remove}>{COPY.removeIt}</Button>
          </>
        }
      >
        {null}
      </ConfirmDialog>
    </>
  );
}
