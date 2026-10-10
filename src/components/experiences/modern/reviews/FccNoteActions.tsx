"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack, Typography } from "@mui/joy";
import type { FccNote } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { authClient } from "@/lib/features/authentication/client";
import {
  isFccNoteAccountRemoved,
  isFccNoteGone,
  isFccNoteTakeBackRefused,
  useConfirmFccNoteMutation,
  useDeleteFccNoteMutation,
} from "@/lib/features/reviews/fccNoteApi";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";

const copy = REVIEW_COPY.fccNotes;
const SESSION_READ_TIMEOUT_MS = 2000;

/** The signed-in account's id and whether it is a music director. */
export function useFccNoteViewer() {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  return { id: user?.id, isMD: (user?.authority ?? Authorization.NO) >= Authorization.MD };
}

/**
 * For a write refused because the account behind a still-valid token was removed: re-reads the
 * session uncached and, with none left, sends the person to sign-in. Resolves `true` when it did.
 * A failed read is not "no session": the person stays where they are and sees the write's failure line.
 */
export function useSendToSignInWhenSessionGone() {
  const router = useRouter();
  return async () => {
    // As authenticationHooks' session re-read: the read gets a timeout (better-auth's fetch has none), and only a `user` is a session.
    const unread = { data: null, error: true };
    const { data, error } = await Promise.race([
      authClient.getSession({ query: { disableCookieCache: true } }).catch(() => unread),
      new Promise<typeof unread>((resolve) => setTimeout(() => resolve(unread), SESSION_READ_TIMEOUT_MS)),
    ]);
    if (data?.user || error) return false;
    router.replace("/login?bounced=no-session");
    return true;
  };
}

type Props = {
  note: FccNote;
  /** Called once each time this note is confirmed, for the caller's one-per-confirm reprint line. */
  onConfirmed: () => void;
  /** Screen-reader names that say which note, for a list of notes on many records. */
  spoken?: { confirm: string; remove: string };
};

/**
 * What the signed-in account may do with one note: a music director confirms or removes it, and
 * the reporter takes their own back until it is confirmed. The server is the authority; a refusal
 * is a notice, and the tag invalidation reloads every list a write touches.
 */
export default function FccNoteActions({ note, onConfirmed, spoken }: Props) {
  const viewer = useFccNoteViewer();
  const sendToSignInWhenSessionGone = useSendToSignInWhenSessionGone();
  const [confirmNote, confirming] = useConfirmFccNoteMutation();
  const [deleteNote, removing] = useDeleteFccNoteMutation();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const reported = note.status === "reported";
  const mine = !viewer.isMD && reported && viewer.id != null && viewer.id === note.reported_by_user_id;
  const failureLine = failure ? <Typography role="alert" level="body-sm">{failure}</Typography> : null;
  // A refetch can end the controls (a music director confirmed the note first); only the refusal that explains it stays.
  if (!viewer.isMD && !mine) return failure === copy.confirmedByMd ? failureLine : null;

  const confirm = async () => {
    setFailure(null);
    try {
      await confirmNote(note.id).unwrap();
      onConfirmed();
    } catch (err) {
      if (isFccNoteGone(err)) return;
      if (isFccNoteAccountRemoved(err) && (await sendToSignInWhenSessionGone())) return;
      setFailure(copy.couldNotConfirm);
    }
  };

  const remove = async () => {
    setAsking(false);
    setFailure(null);
    try {
      await deleteNote(note.id).unwrap();
    } catch (err) {
      if (isFccNoteGone(err)) return;
      setFailure(mine && isFccNoteTakeBackRefused(err) ? copy.confirmedByMd : copy.couldNotRemove);
    }
  };

  const question = mine
    ? copy.removeMineQuestion
    : reported
      ? copy.removeQuestion(note.reported_by)
      : copy.removeConfirmedQuestion;

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1}>
        {viewer.isMD && reported && (
          <Button size="sm" loading={confirming.isLoading} aria-label={spoken?.confirm} onClick={confirm}>
            {copy.confirm}
          </Button>
        )}
        <Button
          size="sm"
          variant="outlined"
          disabled={confirming.isLoading || removing.isLoading}
          aria-label={spoken?.remove}
          onClick={() => setAsking(true)}
        >
          {mine ? copy.removeMine : copy.remove}
        </Button>
      </Stack>
      {failureLine}
      <ConfirmDialog
        open={asking}
        onClose={() => setAsking(false)}
        title={question}
        actions={
          <>
            <Button onClick={remove}>{copy.remove}</Button>
            <Button variant="plain" onClick={() => setAsking(false)}>{copy.cancel}</Button>
          </>
        }
      >
        {null}
      </ConfirmDialog>
    </Stack>
  );
}
