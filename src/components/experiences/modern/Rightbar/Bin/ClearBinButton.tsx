"use client";

import { useClearBin } from "@/src/hooks/binHooks";
import { DeleteSweep, WarningRounded } from "@mui/icons-material";
import { Button, IconButton, Tooltip } from "@mui/joy";
import { useState } from "react";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";

/**
 * Header action that clears the entire Mail Bin. Rendered only when the bin is
 * non-empty (see BinContent). Confirms first because the bulk delete is
 * irreversible.
 */
export default function ClearBinButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const { clearBin, loading, clearing } = useClearBin();

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
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        // `clearing`, not `loading`: the buttons below are right to disable on
        // the aggregate, but gating dismissal on it too would shut every exit
        // at once during an unrelated registry refresh.
        pending={clearing}
        title={
          <>
            <WarningRounded />
            Clear Mail Bin
          </>
        }
        titleId="clear-bin-title"
        testId="clear-bin-confirm-dialog"
        actions={
          <>
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
          </>
        }
      >
        {`Clear all ${count} ${
          count === 1 ? "album" : "albums"
        } from your Mail Bin? This can't be undone.`}
      </ConfirmDialog>
    </>
  );
}
