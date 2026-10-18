"use client";

import { useState } from "react";
import { Button, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";
import IntakeLogForm from "./IntakeLogForm";

const COPY = REVIEW_COPY.intake;

/**
 * The New music tab's line and its Add a record button, which opens the form in a dialog. An add leaves the dialog
 * open on what was added, to add another or to be done; `onDone` is told the last record added when the dialog
 * closes after one, whether by Done or by Escape, so the tab can show it. Closing before any add changes nothing.
 */
export default function AddRecordDialog({ onDone }: { onDone: (added: IntakeItem) => void }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<IntakeItem | null>(null);
  const [busy, setBusy] = useState(false);

  // Joy unmounts a closed dialog, so the form is empty again on the next open.
  const close = () => {
    setOpen(false);
    setAdded(null);
  };
  const done = () => {
    if (added) {
      onDone(added);
    }
    close();
  };

  return (
    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
      <Typography level="body-md">{COPY.newMusicLine}</Typography>
      <Button onClick={() => setOpen(true)}>{COPY.log}</Button>
      <ConfirmDialog
        open={open}
        onClose={done}
        pending={busy}
        role="dialog"
        title={COPY.logTitle}
        titleId="add-record-title"
        actions={
          added ? (
            <>
              <Button variant="plain" onClick={() => setAdded(null)}>{COPY.addAnother}</Button>
              {/* The form that held focus is gone, and Escape reaches the dialog only from inside it. */}
              <Button autoFocus onClick={done}>{COPY.addDone}</Button>
            </>
          ) : (
            <Button variant="plain" disabled={busy} onClick={close}>{REVIEW_COPY.screen.cancel}</Button>
          )
        }
      >
        {added ? (
          <Typography role="status">{COPY.addedLine(added.artist_name, added.album_title)}</Typography>
        ) : (
          <Stack spacing={2}>
            <Typography level="body-sm">{COPY.addRecordLine}</Typography>
            <IntakeLogForm hideTitle onLogged={setAdded} onBusyChange={setBusy} />
          </Stack>
        )}
      </ConfirmDialog>
    </Stack>
  );
}
