"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, FormControl, FormHelperText, FormLabel, Input, Option, Radio, RadioGroup, Select, Stack, Typography } from "@mui/joy";
import type { NewReviewRequest } from "@wxyc/shared";
import { isReviewAccountGone, useCreateReviewMutation, useGetReviewersQuery, useSubmitReviewMutation } from "@/lib/features/reviews/reviewApi";
import { serverMessage, unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useMounted } from "@/src/hooks/useRowWrite";
import { REVIEW_COPY } from "./copy";
import { AUTHOR_MAX, EMPTY_START, type RecordFormStart } from "@/lib/features/reviews/formReviewStart";
import SlipFields, { patchChanged, toFieldPatch, type FieldValues } from "./SlipFields";

const COPY = REVIEW_COPY.record;

/**
 * Records a review of the logged record `itemId` on someone's behalf, or a handwritten one, onto the cover in
 * one create, or, with the box unticked, as one of the record's other reviews: a create then a submit. Either
 * reloads through the page's review-write path (`onWritten`). If the submit fails, the form closes like a success
 * but says the draft was saved and waits under My reviews: there is no second Save to create another review.
 * Names (the author, the picked account) are real names: station display only, never telemetry.
 * `hasCover` is whether a review is on the cover now or another write is putting one there; the helper line under
 * the checkbox reads it, but a ticked save keeps the line it had at the press, so its own save never changes it.
 * `disabled` is the page's hold on every review write (another write is in flight or rereading): Save is out of reach.
 * `start` is what the form opens with (its author, fields, medium and which copied-from lines to show); without one it opens empty.
 * `onDirtyChange` hears whether the form holds unsaved text (its values differ from `start`), and false once it closes or a create has succeeded, whatever is typed while the reread is out.
 * `onHold` takes the page's hold at the press and returns its release: a save hands it to `onWritten` on success and releases it itself if the write fails, even when the form has closed meanwhile.
 */
export default function RecordReviewForm({ itemId, hasCover, start = EMPTY_START, disabled, onHold, onWritten, onNotice, onDirtyChange, onClose }: {
  itemId: number;
  hasCover: boolean;
  start?: RecordFormStart;
  disabled: boolean;
  onHold: (movesCover: boolean) => () => void;
  onWritten: (release: () => void) => Promise<void>;
  onNotice: (line: string | null) => void;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const { data: auth } = useAuthentication();
  const me = "user" in auth ? auth.user?.id : undefined;
  const reviewers = useGetReviewersQuery();
  const [create] = useCreateReviewMutation();
  const [submit] = useSubmitReviewMutation();
  const mounted = useMounted();
  const [author, setAuthor] = useState(start.author);
  const [values, setValues] = useState<FieldValues>(start.values);
  const [medium, setMedium] = useState<NonNullable<NewReviewRequest["medium"]>>(start.medium);
  const [linked, setLinked] = useState(""); // the picked account's id; "" is Not linked
  const [onCover, setOnCover] = useState(true);
  const [tried, setTried] = useState(false);
  // From a valid press until the page's reread settles, so a second press cannot record the review twice.
  const [saving, setSaving] = useState(false);
  // What the helper line said when a ticked save was pressed, so that save's own hold on the page does not change it.
  const [coverAtPress, setCoverAtPress] = useState<boolean | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Set when the create resolves, not read from the handler's closure, so text typed while the request is out cannot keep the guard armed.
  const [created, setCreated] = useState(false);
  const dirty =
    !created &&
    (patchChanged(toFieldPatch(start.values), toFieldPatch(values)) || author !== start.author || medium !== start.medium || linked !== "" || !onCover);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const name = author.trim();
  const authorBlank = name === "";
  const textBlank = medium === "typed" && values.review.trim() === "";
  const emailed = linked !== "" && linked !== me ? reviewers.data?.find((r) => r.id === linked)?.name : undefined;

  const record = async () => {
    setTried(true);
    setFailure(null);
    // Each of these would be a 400; the field itself stops typing at the author limit.
    if (saving || authorBlank || textBlank || [...name].length > AUTHOR_MAX) return;
    setSaving(true);
    onNotice(null);
    // Only a ticked save moves the cover; either save holds the page's review buttons until its write settles.
    if (onCover) setCoverAtPress(hasCover);
    const release = onHold(onCover);
    const body: NewReviewRequest = {
      intake_item_id: itemId,
      author: name,
      medium,
      accept: onCover,
      ...(linked !== "" && { author_user_id: linked }),
      ...toFieldPatch(values),
    };
    try {
      const made = await create(body).unwrap();
      setCreated(true);
      let line: string = COPY.recorded;
      if (!onCover) {
        try {
          await submit(made.id).unwrap();
        } catch {
          // The draft exists and is finished from My reviews; the form closes so no second Save can create another.
          line = COPY.draftNotSubmitted;
        }
      }
      await onWritten(release);
      if (!mounted.current) return;
      onNotice(line);
      onClose();
    } catch (err) {
      release();
      if (!mounted.current) return;
      setSaving(false);
      setCoverAtPress(null);
      const refusal = unwrapEndpointError("reviewWriteError", err);
      // The server's own words only for a 400 that named no account; with one, the page's line says it.
      setFailure(
        isReviewAccountGone(err, linked !== "")
          ? COPY.accountGone
          : (refusal?.status === 400 ? serverMessage(refusal.data) : undefined) ?? COPY.couldNotRecord,
      );
    }
  };

  return (
    <Stack spacing={2}>
      <Typography level="title-sm" component="h3">{COPY.title}</Typography>
      {start.copied === "form" && <Typography level="body-sm">{start.author === "" ? COPY.copiedNoName : COPY.copiedFromForm}</Typography>}
      <FormControl>
        <FormLabel>{COPY.author}</FormLabel>
        <Input value={author} onChange={(e) => setAuthor(e.target.value)} slotProps={{ input: { maxLength: AUTHOR_MAX } }} />
        {start.copied === "form" && start.author !== "" && <FormHelperText>{COPY.copiedAuthor}</FormHelperText>}
        {tried && authorBlank && <FormHelperText>{COPY.authorBlank}</FormHelperText>}
      </FormControl>
      <FormControl>
        <FormLabel>{COPY.account}</FormLabel>
        <Select value={linked} onChange={(_e, id) => setLinked(id ?? "")}>
          <Option value="">{COPY.notLinked}</Option>
          {reviewers.data?.map((r) => <Option key={r.id} value={r.id}>{r.name}</Option>)}
        </Select>
        {reviewers.isError && <FormHelperText>{COPY.accountsFailed}</FormHelperText>}
        {emailed && <FormHelperText>{COPY.emailed(emailed)}</FormHelperText>}
      </FormControl>
      <FormControl>
        <FormLabel>{COPY.medium}</FormLabel>
        <RadioGroup orientation="horizontal" value={medium} onChange={(e) => setMedium(e.target.value as typeof medium)}>
          <Radio value="typed" label={COPY.typed} />
          <Radio value="handwritten" label={COPY.handwritten} />
        </RadioGroup>
      </FormControl>
      {medium === "handwritten" && <Typography level="body-sm">{COPY.handwrittenNote}</Typography>}
      {start.copied === "paper" && <Typography level="body-sm">{COPY.byHand}</Typography>}
      <SlipFields values={values} onChange={setValues} />
      {tried && textBlank && <Typography level="body-sm">{COPY.textBlank}</Typography>}
      <Typography level="body-sm">{COPY.noConsent}</Typography>
      <Checkbox label={COPY.useAsCover} checked={onCover} onChange={(e) => setOnCover(e.target.checked)} />
      <Typography level="body-sm">{!onCover ? COPY.otherReview : (coverAtPress ?? hasCover) ? COPY.coverReplaces : COPY.coverNone}</Typography>
      <Button loading={saving} disabled={disabled} onClick={record} sx={{ alignSelf: "flex-start" }}>{REVIEW_COPY.save}</Button>
      {failure && <Typography role="alert">{failure}</Typography>}
    </Stack>
  );
}
