"use client";

import { useState } from "react";
import { Button, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";
import IntakeLogForm from "./IntakeLogForm";

const COPY = REVIEW_COPY.intake;

/** The dialog's line, which describes it. A literal, because Joy bakes the id into the dialog's CSS selector. */
const LINE_ID = "add-record-line";

/**
 * The New music tab's line and its Add a record button, which opens the form in a dialog. An add leaves the dialog
 * open on what was added, to add another or to be done; `onDone` is told the last record added when the dialog
 * closes after one, whether by Done, Cancel or Escape, and even after Add another, so the tab can show it. Closing
 * before any add changes nothing.
 */
export default function AddRecordDialog({ onDone }: { onDone: (added: IntakeItem) => void }) {
  const [open, setOpen] = useState(false);
  // The last record added since the dialog opened; only an add sets it and only closing clears it.
  const [lastAdded, setLastAdded] = useState<IntakeItem | null>(null);
  // Add another shows the form again without forgetting what was added.
  const [addingAnother, setAddingAnother] = useState(false);
  const [busy, setBusy] = useState(false);
  const added = addingAnother ? null : lastAdded;

  // Joy unmounts a closed dialog, so the form is empty again on the next open.
  const close = () => {
    setOpen(false);
    setLastAdded(null);
    setAddingAnother(false);
  };
  const done = () => {
    if (lastAdded) {
      onDone(lastAdded);
    }
    close();
  };
  const onLogged = (item: IntakeItem) => {
    setLastAdded(item);
    setAddingAnother(false);
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
        describedBy={added ? undefined : LINE_ID}
        actions={
          added ? (
            <>
              <Button variant="plain" onClick={() => setAddingAnother(true)}>{COPY.addAnother}</Button>
              {/* The form that held focus is gone, and Escape reaches the dialog only from inside it. */}
              <Button autoFocus onClick={done}>{COPY.addDone}</Button>
            </>
          ) : (
            <Button variant="plain" disabled={busy} onClick={done}>{REVIEW_COPY.screen.cancel}</Button>
          )
        }
      >
        {added ? (
          <Typography role="status">{COPY.addedLine(added.artist_name, added.album_title)}</Typography>
        ) : (
          <Stack spacing={2}>
            <Typography id={LINE_ID} level="body-sm">{COPY.addRecordLine}</Typography>
            {/* After Add another the button that held focus is gone, so the new form takes it. */}
            <IntakeLogForm hideTitle autoFocus={addingAnother} onLogged={onLogged} onBusyChange={setBusy} />
          </Stack>
        )}
      </ConfirmDialog>
    </Stack>
  );
}
