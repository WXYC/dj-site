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
   * A decision is already on the wire. Backdrop/Escape dismissal is
   * suppressed — hiding the dialog can't cancel a request in flight, and
   * closing early only invites the dialog's own outcome (or a fresh one) to
   * reappear over whatever the DJ/MD did next. Callers still decide for
   * themselves whether to disable their own Cancel button while pending;
   * `actions` owns its own buttons.
   *
   * Two preconditions, because this is the only dismissal route the shell
   * offers — there is no `ModalClose`, so while `pending` is true a caller
   * that also disables its Cancel button has left the DJ no way out:
   *
   * 1. `pending` MUST be scoped to *this dialog's* request and nothing else.
   *    Do not wire it to an aggregate "something is loading" flag; unrelated
   *    background work (a session refresh, a role refetch) would trap the DJ
   *    in a modal that has nothing to do with what they are waiting for.
   * 2. `pending` MUST be guaranteed to terminate — settled in a `finally`, not
   *    left to a promise that might hang. Nothing here times it out.
   */
  pending?: boolean;
  title: ReactNode;
  /** Rendered inside `DialogContent`. */
  children: ReactNode;
  /** Rendered inside `DialogActions`. The caller owns button count, order, and layout. */
  actions: ReactNode;
  /** `data-testid` on the `ModalDialog`. E2E specs and the shared page objects key off this — keep it stable once set. */
  testId?: string;
  sx?: SxProps;
};

/**
 * Shared shell for the modern experience's confirm dialogs:
 * `Modal > ModalDialog role="alertdialog" > DialogTitle/Content/Actions`.
 *
 * Deliberately does not model `onConfirm`/`onCancel` as props: the call sites
 * this was extracted from disagree on how many actions they need (two vs.
 * three) and what each one does (a single destructive confirm vs. a
 * three-way join/takeover/cancel decision), so the shared shape is the
 * dialog frame — title, content, an alertdialog role, the pending-aware
 * dismissal guard — not the decision itself. `actions` is a slot the caller
 * fills with its own `Button`s.
 */
export default function ConfirmDialog({
  open,
  onClose,
  pending = false,
  title,
  children,
  actions,
  testId,
  sx,
}: ConfirmDialogProps) {
  const titleId = useId();

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
        aria-labelledby={titleId}
        data-testid={testId}
        sx={sx}
      >
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogContent>{children}</DialogContent>
        <DialogActions>{actions}</DialogActions>
      </ModalDialog>
    </Modal>
  );
}
