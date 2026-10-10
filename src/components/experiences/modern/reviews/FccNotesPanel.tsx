"use client";

import { useId, useState } from "react";
import { Button, FormControl, FormLabel, Input, Stack, Textarea, Typography } from "@mui/joy";
import type { FccNote } from "@wxyc/shared";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import {
  isFccNoteAccountRemoved,
  isFccNoteInvalid,
  useGetFccNotesQuery,
  useReportFccNoteMutation,
} from "@/lib/features/reviews/fccNoteApi";
import { serverMessage, unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import FccNoteActions, { useSendToSignInWhenSessionGone } from "./FccNoteActions";
import { REVIEW_COPY } from "./copy";

const copy = REVIEW_COPY.fccNotes;

type Subject = { albumId: number } | { intakeItemId: number };

/** The record's id as the API names it. */
type SubjectIds = { album_id: number } | { intake_item_id: number };

/** Confirmed notes first, then reported ones, each newest first. */
const inPanelOrder = (notes: FccNote[]) =>
  [...notes].sort(
    (a, b) =>
      Number(b.status === "confirmed") - Number(a.status === "confirmed") ||
      b.reported_at.localeCompare(a.reported_at) ||
      b.id - a.id,
  );

/** One note and its status line. A reported note is shown in full, to every DJ, before anyone has confirmed it. */
function FccNoteRow({ note, onConfirmed }: { note: FccNote; onConfirmed: () => void }) {
  return (
    <Stack component="li" spacing={0.25} sx={{ listStyle: "none" }}>
      <Typography>{note.track}: {note.note}</Typography>
      <Typography level="body-sm">
        {note.status === "confirmed" ? copy.confirmed : copy.reportedBy(note.reported_by)}
      </Typography>
      <FccNoteActions note={note} onConfirmed={onConfirmed} />
    </Stack>
  );
}

function ReportForm({ ids, onDone }: { ids: SubjectIds; onDone: () => void }) {
  const [track, setTrack] = useState("");
  const [note, setNote] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [report, { isLoading }] = useReportFccNoteMutation();
  const sendToSignInWhenSessionGone = useSendToSignInWhenSessionGone();

  const submit = async () => {
    const trimmed = { track: track.trim(), note: note.trim() };
    if (!trimmed.track || !trimmed.note) {
      setRefusal(copy.needBoth);
      return;
    }
    setRefusal(null);
    try {
      await report({
        ...trimmed,
        ...ids,
      }).unwrap();
      onDone();
    } catch (err) {
      if (isFccNoteAccountRemoved(err) && (await sendToSignInWhenSessionGone())) return;
      const rejection = unwrapEndpointError("fccNoteWriteError", err);
      const shown = isFccNoteInvalid(err) ? serverMessage(rejection?.data) : undefined;
      setRefusal(shown ?? copy.couldNotReport);
    }
  };

  return (
    <Stack spacing={1}>
      <Typography level="body-sm">{copy.intro}</Typography>
      <FormControl>
        <FormLabel>{copy.track}</FormLabel>
        <Input placeholder={copy.trackPlaceholder} value={track} onChange={(e) => setTrack(e.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>{copy.note}</FormLabel>
        <Textarea minRows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormControl>
      {refusal && <Typography role="alert" level="body-sm">{refusal}</Typography>}
      <Stack direction="row" spacing={1}>
        <Button loading={isLoading} onClick={submit}>{copy.submit}</Button>
        <Button variant="plain" onClick={onDone}>{copy.cancel}</Button>
      </Stack>
    </Stack>
  );
}

/** The FCC notes on one record: an album's, or a logged record's. */
export default function FccNotesPanel(subject: Subject) {
  const visible = useCanSeeReviews();
  const ids: SubjectIds = "albumId" in subject ? { album_id: subject.albumId } : { intake_item_id: subject.intakeItemId };
  const notes = useGetFccNotesQuery(ids, { skip: !visible });
  const [reporting, setReporting] = useState(false);
  const [reprint, setReprint] = useState(false);
  const titleId = useId();

  if (!visible) return null;

  return (
    <Stack component="section" aria-labelledby={titleId} spacing={1}>
      <Typography id={titleId} level="title-sm">{copy.title}</Typography>
      {hasNothingToShow(notes) ? (
        <Typography role="alert">{copy.loadFailed}</Typography>
      ) : notes.data && notes.data.length === 0 ? (
        <Typography level="body-sm">{copy.empty}</Typography>
      ) : (
        <Stack component="ul" spacing={1} sx={{ p: 0, m: 0 }}>
          {inPanelOrder(notes.data ?? []).map((note) => (
            <FccNoteRow key={note.id} note={note} onConfirmed={() => setReprint(true)} />
          ))}
        </Stack>
      )}
      {reprint && <Typography role="status" level="body-sm">{copy.reprint}</Typography>}
      {reporting ? (
        <ReportForm ids={ids} onDone={() => setReporting(false)} />
      ) : (
        <Button size="sm" variant="outlined" sx={{ alignSelf: "flex-start" }} onClick={() => setReporting(true)}>
          {copy.report}
        </Button>
      )}
    </Stack>
  );
}
