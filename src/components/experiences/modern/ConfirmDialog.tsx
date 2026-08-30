"use client";

import { useId, type ReactNode } from "react";
import {
  DialogActions,
  DialogContent,
  DialogTitle,
  Modal,
  ModalDialog,
} from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

export type ConfirmDialogProps = {
  open: boolean;
  /** Fired by a backdrop click or Escape. Suppressed while `pending`. */
  onClose: () => void;
  /**
   * A decision is already on the wire, so dismissal is suppressed — hiding the
   * dialog cannot cancel the request, and the outcome would land over whatever
   * the DJ did next.
   *
   * Must be scoped to this dialog's own request, and must be guaranteed to
   * settle (a `finally`, never a promise that may hang). Nothing here times it
   * out and the shell renders no `ModalClose`, so a caller that also disables
   * its own Cancel button while pending leaves no way out but a reload.
   */
  pending?: boolean;
  title: ReactNode;
  /** Rendered inside `DialogContent`. */
  children: ReactNode;
  /** Rendered inside `DialogActions`. The caller owns button count, order, and layout. */
  actions: ReactNode;
  /**
   * Id for the title element. Joy bakes `aria-labelledby` into the emitted
   * `ModalDialogRoot` CSS selector, so a value that differs per mount mints a
   * fresh emotion class (~3KB) that is never reclaimed. Call sites behind a
   * conditional remount often and should pass a literal; the `useId()` fallback
   * labels correctly but grows the stylesheet.
   */
  titleId?: string;
  /** `data-testid` on the `ModalDialog`. */
  testId?: string;
  sx?: SxProps;
};

/**
 * Shared shell for the modern experience's confirm dialogs.
 *
 * No `onConfirm`/`onCancel`: the call sites disagree on how many actions they
 * need and what each one means, so `actions` is a slot the caller fills with
 * its own `Button`s rather than a decision this models.
 */
export default function ConfirmDialog({
  open,
  onClose,
  pending = false,
  title,
  children,
  actions,
  titleId,
  testId,
  sx,
}: ConfirmDialogProps) {
  const generatedId = useId();
  const labelId = titleId ?? generatedId;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <ModalDialog
        variant="outlined"
        role="alertdialog"
        aria-labelledby={labelId}
        data-testid={testId}
        sx={sx}
      >
        <DialogTitle id={labelId}>{title}</DialogTitle>
        <DialogContent>{children}</DialogContent>
        <DialogActions>{actions}</DialogActions>
      </ModalDialog>
    </Modal>
  );
}
