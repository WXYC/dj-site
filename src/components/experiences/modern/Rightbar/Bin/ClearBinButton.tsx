"use client";

import { useClearBin } from "@/src/hooks/binHooks";
import { DeleteSweep, WarningRounded } from "@mui/icons-material";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Modal,
  ModalDialog,
  Tooltip,
} from "@mui/joy";
import { useState } from "react";

/**
 * Header action that clears the entire Mail Bin. Rendered only when the bin is
 * non-empty (see BinContent). Confirms first because the bulk delete is
 * irreversible.
 */
export default function ClearBinButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const { clearBin, loading } = useClearBin();

  const handleConfirm = async () => {
    await clearBin();
    setOpen(false);
  };

  return (
    <>
      <Tooltip title="Clear Mail Bin" placement="top" variant="outlined">
        <IconButton
          variant="soft"
          color="warning"
          size="sm"
          aria-label="Clear Mail Bin"
          onClick={() => setOpen(true)}
        >
          <DeleteSweep />
        </IconButton>
      </Tooltip>
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog variant="outlined" role="alertdialog">
          <DialogTitle>
            <WarningRounded />
            Clear Mail Bin
          </DialogTitle>
          <Divider />
          <DialogContent>
            {`Clear all ${count} ${
              count === 1 ? "album" : "albums"
            } from your Mail Bin? This can't be undone.`}
          </DialogContent>
          <DialogActions>
            <Button
              variant="solid"
              color="warning"
              loading={loading}
              onClick={handleConfirm}
            >
              Clear bin
            </Button>
            <Button
              variant="plain"
              color="neutral"
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </>
  );
}
