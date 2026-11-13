"use client";

import { Button } from "@mui/joy";
import { WarningRounded } from "@mui/icons-material";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";

interface DiscardChangesDialogProps {
  open: boolean;
  /** Throw the release editor's unsaved drafts away and carry on with the exit that was asked for. */
  onDiscard: () => void;
  /** Stay put with every draft as it was. Also fired by Escape and a backdrop click. */
  onKeepEditing: () => void;
}

/**
 * The question every exit from the release editor asks while a tab holds
 * unsaved changes: the editor's own Close editor, and the album modal's close
 * button, backdrop, Escape and in-app links. Keep editing takes focus.
 */
export default function DiscardChangesDialog({ open, onDiscard, onKeepEditing }: DiscardChangesDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onKeepEditing}
      title={
        <>
          <WarningRounded />
          Discard unsaved changes?
        </>
      }
      titleId="album-editor-discard-title"
      actions={
        <>
          <Button variant="solid" color="warning" onClick={onDiscard}>
            Discard changes
          </Button>
          <Button variant="plain" color="neutral" autoFocus onClick={onKeepEditing}>
            Keep editing
          </Button>
        </>
      }
    >
      Your changes since the last save will be lost.
    </ConfirmDialog>
  );
}
