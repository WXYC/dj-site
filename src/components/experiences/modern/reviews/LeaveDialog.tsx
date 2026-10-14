"use client";

import type { ReactNode } from "react";
import { Button } from "@mui/joy";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";

/** The "Leave without saving?" question; the caller supplies its body line and what Leave and Keep editing do. */
export default function LeaveDialog({ open, onLeave, onStay, children }: { open: boolean; onLeave: () => void; onStay: () => void; children: ReactNode }) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onStay}
      title={REVIEW_COPY.leave.title}
      actions={
        <>
          <Button variant="plain" onClick={onLeave}>{REVIEW_COPY.leave.leave}</Button>
          <Button autoFocus onClick={onStay}>{REVIEW_COPY.leave.keepEditing}</Button>
        </>
      }
    >
      {children}
    </ConfirmDialog>
  );
}
